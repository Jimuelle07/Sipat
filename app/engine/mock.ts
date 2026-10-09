import type {
  AiSkipReason,
  AnswerEvent,
  ApplyResult,
  AskApi,
  AskOptions,
  ChecklistApi,
  ChecklistTick,
  ChecklistView,
  Context,
  ContextApi,
  CopyKey,
  EmergencyApi,
  EmergencyCardView,
  Engine,
  EngineChange,
  EngineInfo,
  EngineStatus,
  EvalSummary,
  EvaluationApi,
  FaceBox,
  FaceCheck,
  FamilyApi,
  GuideApi,
  HistoryApi,
  Hotline,
  ImportPreview,
  InstalledPack,
  Member,
  MemberCardView,
  MemberErrorCode,
  MemberInput,
  MemberPhoto,
  MemberTag,
  MockEngine,
  MockOptions,
  MockScenario,
  NewHouseholdInput,
  NormalizedQuery,
  Outcome,
  PackError,
  PacksApi,
  PhotoDraft,
  PhotoError,
  PhotosApi,
  PlanApi,
  PlanField,
  Profile,
  ProfileErrorCode,
  ProfileInput,
  QuestionLogEntry,
  Result,
  RollCallView,
  SaveMemberResult,
  SaveProfileResult,
  SearchResult,
  Settings,
  SettingsApi,
  SourceRef,
  TextKind,
  Timings,
  TopicGroup,
  UpdatesApi,
  VerifierFailure,
  WarningInput,
  WarningKind,
} from '../types';
import { ENGINE_API_VERSION } from '../types';
import type { BundledContent } from '../types';
import { bundledContent, rawContent } from '../content/index';
import { validateContent } from '../core/validateContent';
import { buildChecklist } from '../core/checklist';
import { deriveHousehold, memberTags } from '../core/deriveHousehold';
import { normalize } from '../core/normalize';
import { route } from '../core/route';
import { toManilaIso } from '../core/time';
import { createIndex, search } from '../core/search';
import { DEFAULT_SEARCH_CONFIG } from '../core/config';
import { COPY, COPY_EN } from './copy';
import { fixtureHouseholds } from './fixtures/households';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval';

const MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const GUIDE_DATE = '2026-10-09';
const FALLBACK_PASSAGE_ID = 'before-gobag-01';
const CRITICAL_PASSAGE_ID = 'during-flood-river-01';
const PHONE_RE = /^\+?\d{7,15}$/;

const DEFAULT_SETTINGS: Settings = {
  language: 'tl',
  lowBatteryThreshold: 15,
  aiEnabled: true,
  staleWarningHours: 3,
  autoCheckUpdates: true,
  wifiOnly: true,
  topicReportsOptIn: false,
};

const ALL_CHANGES: EngineChange[] = [
  'profiles', 'family', 'context', 'checklist', 'settings', 'status', 'history', 'packs', 'updates',
];

const KEYWORDS: readonly (readonly [MockScenario, readonly string[]])[] = [
  ['emergency_then_guide', ['lumulubog']],
  ['live_data', ['nasaan', 'pasok']],
  ['medical_dose', ['dosis', 'dose', 'ilang tableta', 'ilang ml', 'gaano karami ang gamot']],
  ['plan_center', ['evacuation center']],
  ['plan_empty', ['magkikita']],
  ['refusal', ['bigas']],
  ['guide_critical', ['lumikas']],
  ['ai_rejected', ['litro']],
  ['low_battery', ['baterya', 'battery']],
  ['no_model', ['model']],
];

const NO_SEARCH: readonly MockScenario[] = ['live_data', 'medical_dose', 'plan_center', 'plan_empty', 'refusal'];

const VULNERABLE_TL: readonly { tag: MemberTag; label: string }[] = [
  { tag: 'infant', label: 'sanggol' },
  { tag: 'child', label: 'bata' },
  { tag: 'pregnant', label: 'buntis' },
  { tag: 'senior', label: 'senior' },
  { tag: 'pwd', label: 'PWD' },
  { tag: 'maintenance_meds', label: 'may maintenance na gamot' },
];

const PHOTO_ERROR_MESSAGE: Record<PhotoError, string> = {
  permission_denied: 'Walang pahintulot sa camera.',
  no_camera: 'Walang camera ang phone na ito.',
  unreadable: 'Hindi mabuksan ang litrato.',
  draft_expired: 'Nag-expire na ang litrato.',
  not_found: 'Wala ang hinahanap.',
  io: 'Hindi na-save.',
};

type ErrList = { code: ProfileErrorCode | MemberErrorCode; field: string }[];
type MemberErrList = { code: MemberErrorCode; field: string }[];
type PhotoFixture = 'one_face' | 'no_face' | 'many_faces' | 'group_3';
type PhotoResultSetting = PhotoFixture | PhotoError;

interface DraftEntry { draft: PhotoDraft; source: MemberPhoto['source'] }
interface RunState { cancelled: boolean; wake?: () => void }

function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

function err<E extends string>(code: E, message: string): { ok: false; error: { code: E; message: string } } {
  return { ok: false, error: { code, message } };
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s()\-]/g, '');
}

function squareCrop(f: FaceBox): FaceBox {
  const size = Math.min(1, Math.max(f.width, f.height));
  const x = Math.max(0, Math.min(1 - size, f.x + f.width / 2 - size / 2));
  const y = Math.max(0, Math.min(1 - size, f.y + f.height / 2 - size / 2));
  return { x, y, width: size, height: size };
}

function scenarioLog(scenario: MockScenario): { outcome: Outcome; failures: VerifierFailure[]; aiSkipReason?: AiSkipReason } {
  switch (scenario) {
    case 'live_data':
    case 'medical_dose':
      return { outcome: 'fixed_reply', failures: [] };
    case 'plan_center':
    case 'plan_empty':
      return { outcome: 'plan_answer', failures: [] };
    case 'refusal':
      return { outcome: 'refused', failures: [] };
    case 'guide_full':
    case 'guide_critical':
    case 'emergency_then_guide':
      return { outcome: 'answered_ai', failures: [] };
    case 'ai_rejected':
      return { outcome: 'answered_summary', failures: ['unknown_number'] };
    case 'low_battery':
      return { outcome: 'answered_summary', failures: [], aiSkipReason: 'low_battery' };
    case 'no_model':
      return { outcome: 'answered_summary', failures: [], aiSkipReason: 'no_model' };
  }
}

/**
 * The mock Engine (docs/api-layer.md section 3.6): the same `Engine` interface over fixture
 * households, the real bundled content and scripted answer streams. Runs fully in Node.
 */
export function createMockEngine(opts: MockOptions = {}): MockEngine {
  const speed = opts.speed ?? 'realistic';
  const listeners = new Set<(change: EngineChange) => void>();

  let content: BundledContent = bundledContent;
  let passagesById = new Map(content.passages.map((p) => [p.id, p]));
  let sourcesById = new Map(content.sources.map((s) => [s.id, s]));
  let hotlinesById = new Map(content.hotlines.map((h) => [h.id, h]));
  let index = createIndex(content.passages);

  const counters: Record<string, number> = {};
  const newId = (prefix: string): string => {
    const n = (counters[prefix] ?? 0) + 1;
    counters[prefix] = n;
    return `${prefix}-${n}`;
  };

  let profiles: Profile[] = [];
  let activeProfileId: string | null = null;
  let context: Context = { phase: 'before', warnings: {} };
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let history: QuestionLogEntry[] = [];
  let ticks = new Map<string, Record<string, ChecklistTick>>();
  let rollCall = new Map<string, Record<string, { present: boolean; at: string }>>();
  let statusPatch: Partial<EngineStatus> = {};
  let scenario: MockScenario | null = opts.scenario ?? null;
  let photoResult: PhotoResultSetting = 'one_face';
  let drafts = new Map<string, DraftEntry>();
  let knownPreviews = new Set<string>();
  let currentRun: RunState | null = null;

  const now = (): Date => new Date();

  function emit(change: EngineChange): void {
    for (const listener of [...listeners]) listener(change);
  }

  function emitAll(): void {
    for (const change of ALL_CHANGES) emit(change);
  }

  function rebuildDerived(): void {
    passagesById = new Map(content.passages.map((p) => [p.id, p]));
    sourcesById = new Map(content.sources.map((s) => [s.id, s]));
    hotlinesById = new Map(content.hotlines.map((h) => [h.id, h]));
    index = createIndex(content.passages);
  }

  function resetState(): void {
    profiles = fixtureHouseholds();
    activeProfileId = profiles[0]?.id ?? null;
    context = { phase: 'before', warnings: {} };
    settings = { ...DEFAULT_SETTINGS };
    history = [];
    ticks = new Map();
    rollCall = new Map();
    statusPatch = {};
    scenario = opts.scenario ?? null;
    photoResult = 'one_face';
    drafts = new Map();
    knownPreviews = new Set();
    for (const key of Object.keys(counters)) delete counters[key];
    currentRun = null;
  }

  function activeProfile(): Profile | null {
    return profiles.find((p) => p.id === activeProfileId) ?? null;
  }

  function sourceRef(sourceId: string, locator?: string): SourceRef {
    const s = sourcesById.get(sourceId);
    const ref: SourceRef = {
      sourceId,
      agency: s?.agency ?? '',
      title: s?.title ?? '',
      date: s?.date ?? '',
      url: s?.url ?? '',
    };
    if (locator !== undefined) ref.locator = locator;
    return ref;
  }

  function pickScenario(q: NormalizedQuery): MockScenario {
    for (const [name, words] of KEYWORDS) {
      if (words.some((w) => q.text.includes(w))) return name;
    }
    return 'guide_full';
  }

  function summaryPassageId(result: SearchResult | null): string {
    const first = result?.selected[0];
    if (first !== undefined && passagesById.has(first)) return first;
    return FALLBACK_PASSAGE_ID;
  }

  function zeroTimings(): Timings {
    return { routeMs: 0, searchMs: 0, totalMs: 0 };
  }

  function partialTexts(passageId: string): string[] {
    const p = passagesById.get(passageId) ?? passagesById.get(FALLBACK_PASSAGE_ID);
    const text = p?.summary ?? '';
    if (text.length === 0) return ['', '', ''];
    return [0.4, 0.7, 1].map((f) => text.slice(0, Math.max(1, Math.round(text.length * f))));
  }

  function summaryEvent(passageId: string): AnswerEvent {
    const p = passagesById.get(passageId) ?? passagesById.get(FALLBACK_PASSAGE_ID)!;
    return {
      type: 'summary',
      passageId: p.id,
      title: p.title,
      text: p.summary,
      pinned: p.critical,
      source: sourceRef(p.source_id, p.locator),
    };
  }

  function emergencyCardView(id?: string): EmergencyCardView {
    const cards = content.rules.emergency_cards;
    const wanted = id ?? content.rules.emergency.card_id;
    const card =
      cards.find((c) => c.id === wanted) ??
      cards.find((c) => c.id === content.rules.emergency.card_id) ??
      cards[0];
    if (!card) {
      return { id: 'emergency-default', title: '', steps: [], hotlines: [], source: sourceRef('') };
    }
    return {
      id: card.id,
      title: card.title,
      steps: [...card.steps],
      hotlines: card.hotline_ids
        .map((hid) => hotlinesById.get(hid))
        .filter((h): h is Hotline => h !== undefined),
      source: sourceRef(card.source_id),
    };
  }

  function planAnswer(field: PlanField, profile: Profile | null): AnswerEvent {
    const plan = profile?.plan;
    const value =
      field === 'evacuation_center' ? plan?.evacuationCenter :
      field === 'meeting_place' ? plan?.meetingPlace : undefined;
    const empty = value === undefined || value.trim().length === 0;
    return empty
      ? { type: 'plan_answer', field, empty: true }
      : { type: 'plan_answer', field, empty: false, text: value };
  }

  function buildEvents(
    name: MockScenario,
    args: { result: SearchResult | null; matched: string[]; profile: Profile | null; logId: string },
  ): AnswerEvent[] {
    const events: AnswerEvent[] = [];
    const closing = (): void => {
      events.push({ type: 'closing', copyKey: 'closing', text: COPY.closing });
    };
    const done = (outcome: Outcome): void => {
      events.push({ type: 'done', logId: args.logId, outcome });
    };
    const aiFull = (passageId: string): void => {
      events.push({ type: 'ai_status', status: 'loading_model' });
      events.push({ type: 'ai_status', status: 'thinking' });
      for (const text of partialTexts(passageId)) events.push({ type: 'ai_partial', text });
      const answer = passagesById.get(passageId)?.summary ?? '';
      events.push({ type: 'ai_final', text: answer, used: [passageId], timings: zeroTimings() });
    };

    switch (name) {
      case 'emergency_then_guide': {
        events.push({ type: 'emergency_card', card: emergencyCardView(), matched: args.matched });
        const pid = summaryPassageId(args.result);
        events.push(summaryEvent(pid));
        aiFull(pid);
        closing();
        done('answered_ai');
        break;
      }
      case 'guide_full': {
        const pid = summaryPassageId(args.result);
        events.push(summaryEvent(pid));
        aiFull(pid);
        closing();
        done('answered_ai');
        break;
      }
      case 'guide_critical': {
        events.push(summaryEvent(CRITICAL_PASSAGE_ID));
        aiFull(CRITICAL_PASSAGE_ID);
        closing();
        done('answered_ai');
        break;
      }
      case 'ai_rejected': {
        const pid = summaryPassageId(args.result);
        events.push(summaryEvent(pid));
        events.push({ type: 'ai_status', status: 'loading_model' });
        events.push({ type: 'ai_status', status: 'thinking' });
        for (const text of partialTexts(pid)) events.push({ type: 'ai_partial', text });
        events.push({ type: 'ai_rejected', code: 'unknown_number', fallbackPassageId: pid });
        closing();
        done('answered_summary');
        break;
      }
      case 'low_battery': {
        const pid = summaryPassageId(args.result);
        events.push(summaryEvent(pid));
        events.push({ type: 'ai_status', status: 'skipped', reason: 'low_battery' });
        closing();
        done('answered_summary');
        break;
      }
      case 'no_model': {
        const pid = summaryPassageId(args.result);
        events.push(summaryEvent(pid));
        events.push({ type: 'ai_status', status: 'skipped', reason: 'no_model' });
        closing();
        done('answered_summary');
        break;
      }
      case 'live_data':
        events.push({ type: 'fixed_reply', route: 'live_data', copyKey: 'no_live_data', text: COPY.no_live_data });
        closing();
        done('fixed_reply');
        break;
      case 'medical_dose':
        events.push({ type: 'fixed_reply', route: 'medical_dose', copyKey: 'medical_dose', text: COPY.medical_dose });
        closing();
        done('fixed_reply');
        break;
      case 'plan_center':
        events.push(planAnswer('evacuation_center', args.profile));
        closing();
        done('plan_answer');
        break;
      case 'plan_empty':
        events.push(planAnswer('meeting_place', args.profile));
        closing();
        done('plan_answer');
        break;
      case 'refusal':
        events.push({
          type: 'refusal',
          copyKey: 'refusal',
          text: COPY.refusal,
          suggestions: ['signals', 'go_bag', 'evacuation'],
        });
        closing();
        done('refused');
        break;
    }
    return events;
  }

  function targetMs(ev: AnswerEvent, partialIndex: number): number {
    switch (ev.type) {
      case 'summary':
        return 300;
      case 'ai_status':
        if (ev.status === 'loading_model') return 400;
        if (ev.status === 'thinking') return 1500;
        return 400;
      case 'ai_partial':
        return 3000 + partialIndex * 120;
      case 'ai_final':
        return 7000;
      case 'closing':
        return 7000;
      default:
        return 300;
    }
  }

  function delay(ms: number, run: RunState): Promise<void> {
    return new Promise((resolve) => {
      if (run.cancelled || ms <= 0) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        run.wake = undefined;
        resolve();
      }, ms);
      run.wake = () => {
        clearTimeout(timer);
        run.wake = undefined;
        resolve();
      };
    });
  }

  async function* runAsk(question: string, askOpts?: AskOptions): AsyncIterable<AnswerEvent> {
    const run: RunState = { cancelled: false };
    if (currentRun) currentRun.cancelled = true;
    currentRun = run;

    const normalized = normalize(question, content.synonyms);
    const profile =
      (askOpts?.profileId ? profiles.find((p) => p.id === askOpts.profileId) : undefined) ??
      activeProfile();
    const routed = route(normalized, content.rules);
    const name = scenario ?? pickScenario(normalized);
    const usesSearch = !NO_SEARCH.includes(name);
    let result: SearchResult | null = null;
    if (usesSearch) {
      result = search(normalized, context, profile, index, DEFAULT_SEARCH_CONFIG);
    }

    const meta = scenarioLog(name);
    const logEntry: QuestionLogEntry = {
      id: newId('log'),
      at: toManilaIso(now()),
      question: normalized.raw,
      route: routed.primary,
      emergency: routed.emergency,
      topIds: result ? result.hits.slice(0, 2).map((h) => h.id) : [],
      topScore: result ? result.gate.topScore : 0,
      gatePassed: result ? result.gate.passed : false,
      outcome: meta.outcome,
      failures: meta.failures,
      timings: zeroTimings(),
    };
    if (meta.aiSkipReason !== undefined) logEntry.aiSkipReason = meta.aiSkipReason;

    const events = buildEvents(name, { result, matched: routed.matched, profile, logId: logEntry.id });
    history.push(logEntry);
    emit('history');

    const start = Date.now();
    let partialIndex = 0;
    for (const ev of events) {
      if (run.cancelled) {
        logEntry.outcome = 'cancelled';
        if (currentRun === run) currentRun = null;
        yield { type: 'done', logId: logEntry.id, outcome: 'cancelled' };
        return;
      }
      if (speed === 'realistic') {
        const wait = Math.max(0, targetMs(ev, partialIndex) - (Date.now() - start));
        await delay(wait, run);
      }
      if (ev.type === 'ai_partial') partialIndex++;
      yield ev;
    }
    if (currentRun === run) currentRun = null;
  }

  function checklistView(): ChecklistView {
    const profile = activeProfile();
    if (!profile) return { warningCards: [], groups: [], progress: { done: 0, total: 0 } };
    return buildChecklist(
      profile,
      context,
      content.checklist,
      content.warnings,
      ticks.get(profile.id) ?? {},
      now(),
      settings.staleWarningHours,
    );
  }

  function rollCallView(): RollCallView {
    const profile = activeProfile();
    if (!profile) return { entries: [], presentCount: 0, total: 0 };
    const state = rollCall.get(profile.id) ?? {};
    const entries: RollCallView['entries'] = profile.people.map((m) => {
      const r = state[m.id];
      return r ? { member: m, present: r.present, at: r.at } : { member: m, present: false };
    });
    return { entries, presentCount: entries.filter((e) => e.present).length, total: entries.length };
  }

  function validateMember(input: MemberInput, path: string): MemberErrList {
    const errors: MemberErrList = [];
    const name = input.name.trim();
    if (name.length === 0) errors.push({ code: 'name_required', field: `${path}.name` });
    else if (name.length > 40) errors.push({ code: 'too_long', field: `${path}.name` });
    if (input.note !== undefined && input.note.length > 80) errors.push({ code: 'too_long', field: `${path}.note` });
    if (input.phone !== undefined && input.phone.trim().length > 0 && !PHONE_RE.test(normalizePhone(input.phone)))
      errors.push({ code: 'phone_invalid', field: `${path}.phone` });
    return errors;
  }

  function buildMember(input: MemberInput, id: string, relation: Member['relation']): Member {
    const m: Member = {
      id,
      name: input.name.trim(),
      relation,
      ageGroup: input.ageGroup,
      needs: [...input.needs],
      updatedAt: toManilaIso(now()),
    };
    if (input.note !== undefined) m.note = input.note;
    if (input.phone !== undefined) m.phone = input.phone;
    return m;
  }

  function recompute(profile: Profile): void {
    const { members, headcount } = deriveHousehold(profile.people, profile.petsCount);
    profile.members = members;
    profile.headcount = headcount;
    profile.updatedAt = toManilaIso(now());
  }

  function vulnerableText(profile: Profile): string {
    const counts = new Map<MemberTag, number>();
    for (const m of profile.people) {
      for (const t of memberTags(m)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const parts = VULNERABLE_TL
      .filter(({ tag }) => (counts.get(tag) ?? 0) > 0)
      .map(({ tag, label }) => `${counts.get(tag)} ${label}`);
    return parts.length > 0 ? parts.join(', ') : 'wala';
  }

  function textPreviewBody(kind: TextKind, previewOpts: { where?: string }): string {
    const profile = activeProfile();
    if (!profile) return '';
    const where = previewOpts.where ?? profile.plan.evacuationCenter ?? '';
    if (kind === 'need_help') {
      return `TULONG: ${profile.headcount} tao sa ${where}. May ${vulnerableText(profile)}. - ${profile.name} ${toManilaIso(now())}`;
    }
    return `Ligtas kami, ${profile.headcount} tao. Nasa ${where}. - ${profile.name}`;
  }

  function emptyProfile(): Profile {
    return {
      id: '', name: '', ownerId: '', people: [], petsCount: 0, headcount: 0, members: [], home: [],
      livelihood: [], plan: { contacts: [] }, updatedAt: '',
    };
  }

  function contextStale(): EngineStatus['stale'] {
    const view = buildChecklist(
      activeProfile() ?? emptyProfile(),
      context,
      [],
      content.warnings,
      {},
      now(),
      settings.staleWarningHours,
    );
    return view.stale ? { kind: view.stale.kind, hoursSinceSet: view.stale.hoursSinceSet } : undefined;
  }

  function engineInfo(): EngineInfo {
    return {
      appVersion: '0.0.0-mock',
      engineApiVersion: ENGINE_API_VERSION,
      guideDate: GUIDE_DATE,
      passagesCount: content.passages.length,
      sourcesCount: content.sources.length,
      packs: [],
      model: { fileName: MODEL_FILE, sizeBytes: 0, present: false, attribution: 'Built with Llama' },
    };
  }

  function engineStatus(): EngineStatus {
    const merged: EngineStatus = {
      tier: 'full',
      model: 'unloaded',
      ai: { allowed: true },
      battery: { level: 80, charging: false, saver: false },
      ...statusPatch,
    };
    const stale = contextStale();
    if (merged.stale === undefined && stale !== undefined) merged.stale = stale;
    return merged;
  }

  const profilesApi: Engine['profiles'] = {
    list: () => profiles,
    active: () => activeProfile(),
    create: (input: NewHouseholdInput): SaveProfileResult => {
      const errors: ErrList = [];
      const name = input.name.trim();
      if (name.length === 0) errors.push({ code: 'name_required', field: 'name' });
      else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
      errors.push(...validateMember(input.owner, 'owner'));
      if (errors.length > 0) return { ok: false, errors };
      const owner = buildMember({ ...input.owner, relation: 'self' }, newId('member'), 'self');
      const profile: Profile = {
        id: newId('household'),
        name,
        ownerId: owner.id,
        people: [owner],
        petsCount: 0,
        headcount: 1,
        members: memberTags(owner),
        home: [],
        livelihood: [],
        plan: { contacts: [] },
        updatedAt: toManilaIso(now()),
      };
      recompute(profile);
      profiles.push(profile);
      activeProfileId = profile.id;
      emit('profiles');
      emit('family');
      emit('checklist');
      return { ok: true, value: profile };
    },
    save: (input: ProfileInput): SaveProfileResult => {
      const profile = profiles.find((p) => p.id === input.id);
      if (!profile) return { ok: false, errors: [{ code: 'name_required', field: 'id' }] };
      const errors: ErrList = [];
      const name = input.name.trim();
      if (name.length === 0) errors.push({ code: 'name_required', field: 'name' });
      else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
      if (!Number.isInteger(input.petsCount) || input.petsCount < 0 || input.petsCount > 20)
        errors.push({ code: 'pets_range', field: 'petsCount' });
      const contacts = input.plan.contacts ?? [];
      if (contacts.length > 5) errors.push({ code: 'too_many_contacts', field: 'plan.contacts' });
      contacts.forEach((c, i) => {
        if (c.name.length > 60) errors.push({ code: 'too_long', field: `plan.contacts.${i}.name` });
        if (c.relation !== undefined && c.relation.length > 60)
          errors.push({ code: 'too_long', field: `plan.contacts.${i}.relation` });
        if (c.phone.trim().length > 0 && !PHONE_RE.test(normalizePhone(c.phone)))
          errors.push({ code: 'contact_phone_invalid', field: `plan.contacts.${i}.phone` });
      });
      if (input.plan.evacuationCenter !== undefined && input.plan.evacuationCenter.length > 60)
        errors.push({ code: 'too_long', field: 'plan.evacuationCenter' });
      if (input.plan.meetingPlace !== undefined && input.plan.meetingPlace.length > 60)
        errors.push({ code: 'too_long', field: 'plan.meetingPlace' });
      if (errors.length > 0) return { ok: false, errors };
      profile.name = name;
      profile.petsCount = input.petsCount;
      profile.home = [...input.home];
      if (input.livelihood !== undefined) profile.livelihood = [...input.livelihood];
      if (input.area !== undefined) profile.area = input.area;
      profile.plan = { ...input.plan, contacts: [...contacts] };
      recompute(profile);
      emit('profiles');
      emit('checklist');
      return { ok: true, value: profile };
    },
    setActive: (id: string): Result<void, 'not_found'> => {
      const profile = profiles.find((p) => p.id === id);
      if (!profile) return err('not_found', `Walang profile ${id}`);
      activeProfileId = id;
      emit('profiles');
      emit('family');
      emit('checklist');
      return ok(undefined);
    },
    remove: (id: string): Result<void, 'not_found' | 'last_profile'> => {
      const i = profiles.findIndex((p) => p.id === id);
      if (i < 0) return err('not_found', `Walang profile ${id}`);
      if (profiles.length <= 1) return err('last_profile', 'Kailangan ng kahit isang profile');
      profiles.splice(i, 1);
      ticks.delete(id);
      rollCall.delete(id);
      if (activeProfileId === id) activeProfileId = profiles[0]?.id ?? null;
      emit('profiles');
      emit('family');
      emit('checklist');
      return ok(undefined);
    },
  };

  const photosApi: PhotosApi = {
    start: async (target, source): Promise<Result<PhotoDraft | null, PhotoError>> => {
      const r = photoResult;
      if (r !== 'one_face' && r !== 'no_face' && r !== 'many_faces' && r !== 'group_3') {
        return err(r, PHOTO_ERROR_MESSAGE[r]);
      }
      const count = r === 'no_face' ? 0 : r === 'many_faces' ? 2 : r === 'group_3' ? 3 : 1;
      const faces: FaceBox[] = [];
      for (let i = 0; i < count; i++) {
        faces.push({ x: 0.1 + i * 0.2, y: 0.2, width: 0.15, height: 0.15 });
      }
      const faceCheck: FaceCheck = count === 0 ? 'no_face' : count === 1 ? 'one_face' : 'many_faces';
      const draftId = newId('draft');
      const draft: PhotoDraft = {
        draftId,
        previewUri: `fixture://photos/${draftId}.jpg`,
        faces,
        faceCheck,
        suggestedCrop: faces[0] ? squareCrop(faces[0]) : { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        expiresAt: toManilaIso(new Date(now().getTime() + 30 * 60 * 1000)),
      };
      drafts.set(draftId, { draft, source: target === 'group' ? 'group' : source });
      return ok(draft);
    },
    save: async (draftId, memberId, crop): Promise<Result<MemberPhoto, PhotoError>> => {
      void crop;
      const entry = drafts.get(draftId);
      if (!entry) return err('draft_expired', PHOTO_ERROR_MESSAGE.draft_expired);
      const member = activeProfile()?.people.find((m) => m.id === memberId);
      if (!member) return err('not_found', PHOTO_ERROR_MESSAGE.not_found);
      const photo: MemberPhoto = {
        uri: `fixture://photos/${memberId}.jpg`,
        bytes: 0,
        source: entry.source,
        faceCheck: entry.draft.faceCheck,
        takenAt: toManilaIso(now()),
        version: (member.photo?.version ?? 0) + 1,
      };
      member.photo = photo;
      emit('family');
      return ok(photo);
    },
    discard: (draftId: string): void => {
      drafts.delete(draftId);
    },
    remove: (memberId: string): Result<void, 'not_found'> => {
      const member = activeProfile()?.people.find((m) => m.id === memberId);
      if (!member) return err('not_found', PHOTO_ERROR_MESSAGE.not_found);
      delete member.photo;
      emit('family');
      return ok(undefined);
    },
    removeAll: (): void => {
      for (const profile of profiles) for (const member of profile.people) delete member.photo;
      emit('family');
    },
  };

  const familyApi: FamilyApi = {
    members: () => activeProfile()?.people ?? [],
    saveMember: (input: MemberInput): SaveMemberResult => {
      const profile = activeProfile();
      if (!profile) return { ok: false, errors: [{ code: 'name_required', field: 'member.name' }] };
      const errors: MemberErrList = validateMember(input, 'member');
      const existing = input.id === undefined ? undefined : profile.people.find((m) => m.id === input.id);
      const adding = existing === undefined;
      if (adding && profile.people.length >= 30) errors.push({ code: 'too_many_members', field: 'member' });
      const isOwnerEdit = existing !== undefined && existing.id === profile.ownerId;
      if (input.relation === 'self' && !isOwnerEdit) errors.push({ code: 'owner_relation', field: 'member.relation' });
      if (errors.length > 0) return { ok: false, errors };
      let member: Member;
      if (existing) {
        member = buildMember(input, existing.id, input.relation);
        if (existing.photo !== undefined) member.photo = existing.photo;
        profile.people[profile.people.indexOf(existing)] = member;
      } else {
        member = buildMember(input, newId('member'), input.relation);
        profile.people.push(member);
      }
      recompute(profile);
      emit('family');
      emit('checklist');
      return { ok: true, value: member };
    },
    removeMember: (memberId: string): Result<void, 'not_found' | 'owner_required'> => {
      const profile = activeProfile();
      if (!profile) return err('not_found', 'Wala ang miyembro');
      const i = profile.people.findIndex((m) => m.id === memberId);
      if (i < 0) return err('not_found', 'Wala ang miyembro');
      if (memberId === profile.ownerId) return err('owner_required', 'Hindi puwedeng burahin ang pangunahing tao');
      profile.people.splice(i, 1);
      recompute(profile);
      emit('family');
      emit('checklist');
      return ok(undefined);
    },
    photos: photosApi,
    card: (memberId: string): MemberCardView | null => {
      const profile = activeProfile();
      if (!profile) return null;
      const member = profile.people.find((m) => m.id === memberId);
      if (!member) return null;
      const owner = profile.people.find((m) => m.id === profile.ownerId);
      const view: MemberCardView = { member, ownerName: owner?.name ?? '' };
      if (owner?.phone !== undefined) view.ownerPhone = owner.phone;
      if (profile.plan.evacuationCenter !== undefined) view.evacuationCenter = profile.plan.evacuationCenter;
      if (profile.plan.meetingPlace !== undefined) view.meetingPlace = profile.plan.meetingPlace;
      return view;
    },
    shareCard: async (memberId): Promise<Result<void, 'not_found' | 'cancelled' | 'failed'>> => {
      const member = activeProfile()?.people.find((m) => m.id === memberId);
      if (!member) return err('not_found', 'Wala ang miyembro');
      return ok(undefined);
    },
    rollCall: () => rollCallView(),
    markPresent: (memberId: string, present: boolean): Result<RollCallView, 'not_found'> => {
      const profile = activeProfile();
      if (!profile || !profile.people.some((m) => m.id === memberId))
        return err('not_found', 'Wala ang miyembro');
      const state = rollCall.get(profile.id) ?? {};
      state[memberId] = { present, at: toManilaIso(now()) };
      rollCall.set(profile.id, state);
      return ok(rollCallView());
    },
    resetRollCall: (): RollCallView => {
      const profile = activeProfile();
      if (profile) rollCall.delete(profile.id);
      return rollCallView();
    },
  };

  const contextApi: ContextApi = {
    get: () => context,
    options: () => content.warnings,
    setPhase: (phase) => {
      context.phase = phase;
      if (phase === 'after') context.warnings = {};
      emit('context');
      emit('checklist');
      emit('status');
      return context;
    },
    setWarning: (input: WarningInput) => {
      const setAt = toManilaIso(now());
      if (input.kind === 'gale') context.warnings.gale = { setAt };
      else if (input.kind === 'tcws') context.warnings.tcws = { level: input.level, setAt };
      else context.warnings[input.kind] = { level: input.level, setAt };
      emit('context');
      emit('checklist');
      emit('status');
      return context;
    },
    clearWarning: (kind: WarningKind) => {
      delete context.warnings[kind];
      emit('context');
      emit('checklist');
      emit('status');
      return context;
    },
    reconfirmWarning: (kind: WarningKind) => {
      const active = context.warnings[kind];
      if (active) active.setAt = toManilaIso(now());
      emit('context');
      emit('checklist');
      emit('status');
      return context;
    },
  };

  const checklistApi: ChecklistApi = {
    view: () => checklistView(),
    tick: (itemId: string, ticked: boolean): Result<ChecklistView, 'unknown_item'> => {
      const profile = activeProfile();
      if (!profile || !content.checklist.some((i) => i.id === itemId))
        return err('unknown_item', `Walang item ${itemId}`);
      const state = ticks.get(profile.id) ?? {};
      state[itemId] = { ticked, updatedAt: toManilaIso(now()) };
      ticks.set(profile.id, state);
      emit('checklist');
      return ok(checklistView());
    },
    reset: (): ChecklistView => {
      const profile = activeProfile();
      if (profile) ticks.delete(profile.id);
      emit('checklist');
      return checklistView();
    },
  };

  const askApi: AskApi = {
    maxLength: 200,
    run: (question: string, askOpts?: AskOptions) => runAsk(question, askOpts),
    cancel: (): void => {
      if (currentRun) {
        currentRun.cancelled = true;
        currentRun.wake?.();
      }
    },
    warm: (): void => {
      /* the mock has no model to warm */
    },
  };

  const guideApi: GuideApi = {
    topics: () => {
      const counts = new Map<TopicGroup, number>();
      for (const p of content.passages) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
      return [...counts.entries()].map(([topic, count]) => ({ topic, count }));
    },
    byTopic: (topic: TopicGroup) =>
      content.passages
        .filter((p) => p.topic === topic)
        .map((p) => ({ id: p.id, title: p.title, summary: p.summary, topic: p.topic, critical: p.critical })),
    passage: (id: string) => {
      const p = passagesById.get(id);
      if (!p) return null;
      return {
        id: p.id,
        title: p.title,
        summary: p.summary,
        topic: p.topic,
        critical: p.critical,
        text: p.text,
        source: sourceRef(p.source_id, p.locator),
        reviewedBy: p.reviewed_by,
        reviewedAt: p.reviewed_at,
        version: p.version,
      };
    },
    sources: () => content.sources,
  };

  const emergencyApi: EmergencyApi = {
    card: (id?: string) => emergencyCardView(id),
  };

  const planApi: PlanApi = {
    hotlines: () => content.hotlines.filter((h) => h.scope === 'national'),
    evacuationCenters: () => [],
    call: async (hotlineId): Promise<Result<void, 'not_found' | 'no_dialer'>> => {
      if (!content.hotlines.some((h) => h.id === hotlineId)) return err('not_found', 'Wala ang hotline');
      return ok(undefined);
    },
    textPreview: (kind: TextKind, previewOpts: { where?: string }) => textPreviewBody(kind, previewOpts),
    composeText: async (kind, composeOpts): Promise<Result<void, 'no_recipients' | 'no_sms_app'>> => {
      void kind;
      if (composeOpts.to.length === 0) return err('no_recipients', 'Pumili ng padadalhan');
      return ok(undefined);
    },
    exportPlan: async (): Promise<Result<void, 'cancelled' | 'failed'>> => ok(undefined),
  };

  const settingsApi: SettingsApi = {
    get: () => settings,
    update: (patch: Partial<Settings>): Result<Settings, 'out_of_range'> => {
      if (patch.language !== undefined && patch.language !== 'tl' && patch.language !== 'en')
        return err('out_of_range', 'language must be tl or en');
      if (patch.lowBatteryThreshold !== undefined &&
        (!Number.isFinite(patch.lowBatteryThreshold) || patch.lowBatteryThreshold < 5 || patch.lowBatteryThreshold > 50))
        return err('out_of_range', 'lowBatteryThreshold 5-50');
      if (patch.staleWarningHours !== undefined &&
        (!Number.isFinite(patch.staleWarningHours) || patch.staleWarningHours < 1 || patch.staleWarningHours > 12))
        return err('out_of_range', 'staleWarningHours 1-12');
      settings = { ...settings, ...patch, language: patch.language ?? settings.language ?? 'tl' };
      emit('settings');
      emit('status');
      return ok(settings);
    },
  };

  const historyApi: HistoryApi = {
    list: (limit?: number): QuestionLogEntry[] => {
      const newestFirst = [...history].reverse();
      return limit === undefined ? newestFirst : newestFirst.slice(0, limit);
    },
    clear: (): void => {
      history = [];
      emit('history');
    },
  };

  const evaluationApi: EvaluationApi = {
    summary: (): EvalSummary => EVAL_SUMMARY_FIXTURE,
  };

  const packsApi: PacksApi = {
    installed: (): InstalledPack[] => [],
    importFromPicker: async (): Promise<Result<ImportPreview | null, PackError>> => ok(null),
    importFile: async (uri): Promise<Result<ImportPreview, PackError>> => {
      void uri;
      const preview: ImportPreview = { previewId: newId('preview'), signedBy: 'fixture-key', packs: [] };
      knownPreviews.add(preview.previewId);
      return ok(preview);
    },
    apply: async (previewId): Promise<Result<ApplyResult, PackError | 'io'>> => {
      if (!knownPreviews.has(previewId)) return err('io', 'Hindi na-save');
      return ok({ applied: [{ packId: 'core-tl', version: 1 }], guideDate: GUIDE_DATE });
    },
    rollback: async (): Promise<Result<void, 'io' | 'nothing_to_roll_back'>> =>
      err('nothing_to_roll_back', 'Walang naunang bersyon'),
    share: async (): Promise<Result<void, 'no_pack' | 'cancelled'>> =>
      err('no_pack', 'Wala pang gabay na maibabahagi'),
  };

  const updatesApi: UpdatesApi = {
    pending: () => null,
    check: async () => ok(null),
    download: async () => err('not_allowed', 'Hindi pinapayagan'),
    networkLog: () => [],
  };

  const debugApi: MockEngine['debug'] = {
    setScenario: (s: MockScenario | null): void => {
      scenario = s;
    },
    setStatus: (patch: Partial<EngineStatus>): void => {
      Object.assign(statusPatch, patch);
      emit('status');
    },
    emit: (change: EngineChange): void => emit(change),
    setPhotoResult: (r): void => {
      photoResult = r;
    },
    reset: (): void => {
      resetState();
      emitAll();
    },
  };

  const engine: MockEngine = {
    init: async (): Promise<Result<EngineInfo, 'content_invalid' | 'storage_failed'>> => {
      const checked = validateContent(rawContent);
      if (!checked.ok) return { ok: false, error: checked.error };
      content = checked.value;
      rebuildDerived();
      resetState();
      return ok(engineInfo());
    },
    info: () => engineInfo(),
    status: () => engineStatus(),
    copy: (key: CopyKey, lang = 'tl') => lang === 'en' ? COPY_EN[key] : COPY[key],
    onChange: (listener: (change: EngineChange) => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    profiles: profilesApi,
    family: familyApi,
    context: contextApi,
    checklist: checklistApi,
    ask: askApi,
    guide: guideApi,
    emergency: emergencyApi,
    plan: planApi,
    settings: settingsApi,
    history: historyApi,
    evaluation: evaluationApi,
    packs: packsApi,
    updates: updatesApi,
    debug: debugApi,
  };

  return engine;
}
