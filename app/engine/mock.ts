import { buildChecklist, PHASE_GROUPS } from '../core/checklist.ts';
import { decidePhase } from '../core/decidePhase.ts';
import { redactQuestion } from '../core/prompt.ts';
import { decideAi } from '../services/power.ts';
import { deriveHousehold } from '../core/deriveHousehold.ts';
import { COPY, COPY_EN } from './copy.ts';
import { fixtureProfile, fixtureDamageDrafts } from './fixtures/households.ts';
import {
  FIXTURE_SOURCES, FIXTURE_PASSAGES, FIXTURE_CHECKLIST, FIXTURE_WARNINGS,
  FIXTURE_HOTLINES, FIXTURE_INTENTS, FIXTURE_PHASE_RULES, FIXTURE_PLACES,
} from './fixtures/content.ts';
import {
  FIXTURE_BULLETIN, FIXTURE_CENTERS, DEMO_SOURCED_RULES, fixtureStorm, fixtureFeedState,
} from './fixtures/feed.ts';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval.ts';
import type {
  AccountState, ActiveWarnings, AnswerEvent, AskOptions, BulletinCardView, ChecklistTick, Context,
  CopyKey, DamageDraft, EngineChange, EngineInfo, EngineStatus, EvalSummary,
  FaceBox, FaceDetection, FeedError, FeedState, HouseholdLocation, ImportPreview, InstalledPack,
  Member, MemberPhoto, MockEngine,
  MockOptions, MockScenario, ModelInstallError, Phase, PhotoDraft, PhotoError, Result, Settings,
  PhaseInputKey, SourceRef, UiLanguage, UpdatePlan, WarningCard, WarningInput, PlanField,
} from '../types/index.ts';

const MS_HOUR = 3_600_000;
const SOURCE_DATE = '2026-10-09';
const MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const resultOk = <T>(value: T): Result<T, never> => ({ ok: true, value });
const resultErr = <T = never, E extends string = string>(code: E): Result<T, E> => ({
  ok: false,
  error: { code, message: code },
});
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const toManilaIso = (date: Date) => `${new Date(date.getTime() + 8 * MS_HOUR).toISOString().slice(0, -1)}+08:00`;

function makePackPreview(
  packs: ImportPreview['packs'] = [{
    packId: 'sample-core-pack',
    kind: 'core',
    toVersion: 2,
    sizeBytes: 1024,
    guideDate: '2026-10-10',
    upserts: 1,
    deletes: 0,
  }],
): ImportPreview {
  const previewId = id('preview');
  return { previewId, signedBy: 'SAMPLE key (placeholder)', packs };
}

function makeUpdatePlan(): UpdatePlan {
  return {
    planId: id('update'),
    items: [{
      packId: 'sample-core-pack',
      kind: 'core',
      fromVersion: 1,
      toVersion: 2,
      blob: { sha256: '0'.repeat(64), size: 1024, path: 'SAMPLE (placeholder)' },
      delta: false,
    }],
    totalBytes: 1024,
    guideDate: '2026-10-10',
  };
}

function defaultContext(now: Date): Context {
  return {
    phase: 'before', phaseSource: 'manual', changedAt: toManilaIso(now), recommended: null,
    reason: { source: 'manual', text: 'Manwal na pinili.' }, warnings: {}, suppressed: [],
  };
}

function sourceRef(sourceId: string, locator?: string): SourceRef {
  const source = FIXTURE_SOURCES.find((item) => item.id === sourceId) ?? FIXTURE_SOURCES[0]!;
  const ref: SourceRef = {
    sourceId: source.id,
    agency: source.agency,
    title: source.title,
    date: source.date,
    url: source.url,
  };
  if (locator !== undefined) ref.locator = locator;
  return ref;
}

function copyText(key: CopyKey, lang: UiLanguage, vars: Record<string, string> = {}): string {
  let text = (lang === 'en' ? COPY_EN : COPY)[key] ?? key;
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, value);
  return text;
}

function validateMemberInput(input: { name: string; phone?: string; note?: string }, field: string) {
  const errors: { code: 'name_required' | 'too_long' | 'phone_invalid'; field: string }[] = [];
  const name = input.name.trim();
  if (!name) errors.push({ code: 'name_required', field: `${field}.name` });
  else if (name.length > 40) errors.push({ code: 'too_long', field: `${field}.name` });
  if (input.note && input.note.length > 80) errors.push({ code: 'too_long', field: `${field}.note` });
  if (input.phone?.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(input.phone.trim())) {
    errors.push({ code: 'phone_invalid', field: `${field}.phone` });
  }
  return errors;
}

function cardView(now: Date, bulletin = FIXTURE_BULLETIN): BulletinCardView {
  const issuedHoursAgo = Math.max(0, Math.floor((now.getTime() - Date.parse(bulletin.issuedAt)) / MS_HOUR));
  const fetchedHoursAgo = Math.max(0, Math.floor((now.getTime() - Date.parse(bulletin.fetchedAt)) / MS_HOUR));
  return {
    bulletin,
    issuedHoursAgo,
    fetchedHoursAgo,
    stale: issuedHoursAgo >= 3,
    ageText: `Inilabas ${issuedHoursAgo} oras na ang nakalipas`,
  };
}

function keywordScenario(question: string): MockScenario {
  const q = question.toLocaleLowerCase('tl');
  if (q.includes('lumulubog')) return 'emergency_then_guide';
  if (q.includes('nasaan')) return 'live_data_bulletin';
  if (q.includes('pasok')) return 'live_data';
  if (q.includes('dosis')) return 'medical_dose';
  if (q.includes('evacuation center')) return 'plan_center';
  if (q.includes('magkikita')) return 'plan_empty';
  if (q.includes('bigas')) return 'refusal';
  if (q.includes('lumikas')) return 'guide_critical';
  if (q.includes('na dito')) return 'phase_cue_during';
  if (q.includes('humupa')) return 'phase_cue_after';
  if (q.includes('litro')) return 'ai_rejected';
  if (q.includes('baterya')) return 'low_battery';
  if (q.includes('model')) return 'no_model';
  return 'guide_full';
}

// After the documented section 3.6 keyword table, the mock also routes "kontak"/"tawagan" to contacts
// and "hotline" to hotlines so every plan_answer field can be exercised in the UI.

export function createMockEngine(opts: MockOptions = {}): MockEngine {
  const now = () => new Date();
  const speed = opts.speed ?? 'realistic';
  const listeners = new Set<(change: EngineChange) => void>();
  const emit = (change: EngineChange) => {
    for (const listener of listeners) listener(change);
  };
  let profile = fixtureProfile();
  let hasProfile = true;
  let context = defaultContext(now());
  let settings: Settings = {
    language: 'tl', lowBatteryThreshold: 15, aiEnabled: true, lowBatteryMode: false,
    staleWarningHours: 3, feedEnabled: true, autoCheckUpdates: false, wifiOnly: true,
    topicReportsOptIn: false, damageReportsOptIn: false,
  };
  let ticks: Record<string, ChecklistTick> = {};
  let history: import('../types/index.ts').QuestionLogEntry[] = [];
  let statusPatch: Partial<EngineStatus> = {};
  let statusAiOverride: EngineStatus['ai'] | undefined;
  let scenario: MockScenario | null = opts.scenario ?? null;
  let photoResult: FaceDetection | PhotoError = 'one_face';
  let locationResult: 'ok' | import('../types/index.ts').LocationError = 'ok';
  let pendingFeedError: FeedError | null = null;
  let feedState: FeedState = fixtureFeedState('fresh');
  let feedChoice:
    | 'off' | 'empty' | 'fresh' | 'stale'
    | 'near' | 'signal_here' | 'track_approach' | 'left'
    | null = 'fresh';
  let feedVariant: ReturnType<typeof fixtureStorm> | null = fixtureStorm();
  let demoFeedVariant = false;
  let modelInstallResult: 'installed' | ModelInstallError = 'installed';
  let modelPresent = true;
  let undo: { state: Context; cause?: PhaseInputKey } | null = null;
  let currentCancel: (() => void) | null = null;
  let damage = fixtureDamageDrafts();
  let photoDrafts = new Map<string, PhotoDraft>();
  let photoDraftSources = new Map<string, 'camera' | 'gallery'>();
  let installedPacks: InstalledPack[] = [];
  let packPreviews = new Map<string, ImportPreview>();
  let packRollback = new Map<string, InstalledPack[]>();
  let pendingUpdate: UpdatePlan | null = null;
  const registerPackPreview = (preview: ImportPreview): ImportPreview => {
    packPreviews.set(preview.previewId, preview);
    return preview;
  };
  const areaValues = (): string[] => {
    const values: string[] = [];
    let psgc = profile.location?.psgc;
    const seen = new Set<string>();
    while (psgc && !seen.has(psgc)) {
      seen.add(psgc);
      const place = FIXTURE_PLACES.items.find((item) => item.psgc === psgc);
      if (!place) break;
      values.push(place.name, place.psgc);
      psgc = place.parent ?? undefined;
    }
    return values;
  };
  const logQuestion = (question: string): string =>
    redactQuestion(question, profile, areaValues()).slice(0, 200);

  const phaseRules = () => demoFeedVariant ? DEMO_SOURCED_RULES : FIXTURE_PHASE_RULES;
  const storm = () => feedVariant;
  const profileLocation = (): HouseholdLocation | null => hasProfile ? profile.location : null;
  const checklistView = () => {
    const view = buildChecklist(
      profile, context, FIXTURE_CHECKLIST, FIXTURE_WARNINGS, ticks, now(), settings.staleWarningHours,
    );
    const preferred = PHASE_GROUPS[context.phase];
    const order = context.warnings.barangay_order
      ? ['now', 'evacuate', ...preferred.filter((group) => group !== 'now' && group !== 'evacuate')]
      : preferred;
    view.groups.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    });
    return view;
  };
  const stale = (): EngineStatus['stale'] => {
    const item = checklistView().stale;
    return item ? { kind: item.kind, hoursSinceSet: item.hoursSinceSet } : undefined;
  };
  const status = (): EngineStatus => {
    const effectiveModelPresent = statusPatch.model === undefined ? modelPresent : statusPatch.model !== 'absent';
    const base: EngineStatus = {
      tier: 'full', model: modelPresent ? 'ready' : 'absent',
      ai: decideAi({ settings, tier: statusPatch.tier ?? 'full', modelPresent: effectiveModelPresent,
        battery: statusPatch.battery ?? { level: 80, charging: false, saver: false } }),
      battery: { level: 80, charging: false, saver: false },
    };
    const merged = { ...base, ...statusPatch, ai: statusAiOverride ?? base.ai };
    const staleValue = stale();
    if (merged.stale === undefined && staleValue !== undefined) merged.stale = staleValue;
    return merged;
  };
  const info = (): EngineInfo => ({
    appVersion: '0.0.0-mock', engineApiVersion: 2, guideDate: SOURCE_DATE,
    passagesCount: FIXTURE_PASSAGES.length, sourcesCount: FIXTURE_SOURCES.length,
    packs: installedPacks, online: false,
    model: { fileName: MODEL_FILE, sizeBytes: 810_000_000, present: modelPresent, attribution: 'Built with Llama' },
  });
  const warningCards = (): WarningCard[] => {
    const view = checklistView();
    return view.warningCards.map((warning) => ({ ...warning,
      hoursSinceSet: Math.floor((now().getTime() - Date.parse(warning.setAt)) / MS_HOUR),
      stale: Math.floor((now().getTime() - Date.parse(warning.setAt)) / MS_HOUR) >= settings.staleWarningHours,
    }));
  };
  const decide = (ask?: { questionId: string; cue: import('../types/index.ts').PhaseCue | null; hint: Phase | null }) =>
    decidePhase({ context, rules: phaseRules(), storm: storm(), ask, now: toManilaIso(now()) });
  const applyDecision = (decision: ReturnType<typeof decidePhase>, captureUndo = true, notifyPhase = true) => {
    const previous = { ...context, warnings: { ...context.warnings } };
    const changed = decision.state.phase !== context.phase || decision.state.phaseSource !== context.phaseSource
      || JSON.stringify(decision.state.reason) !== JSON.stringify(context.reason)
      || JSON.stringify(decision.state.recommended) !== JSON.stringify(context.recommended)
      || JSON.stringify(decision.state.lastSwitch) !== JSON.stringify(context.lastSwitch);
    if (captureUndo && decision.switched) undo = { state: previous, cause: decision.switched.input };
    context = { ...decision.state, warnings: context.warnings };
    if (changed && notifyPhase) emit('phase');
    emit('context');
    emit('checklist');
    emit('status');
    return decision;
  };
  const mutateWarning = (input: WarningInput) => {
    const previous = { ...context, warnings: { ...context.warnings } };
    const at = toManilaIso(now());
    if (input.kind === 'tcws') context.warnings.tcws = { level: input.level, setAt: at };
    else if (input.kind === 'rainfall' || input.kind === 'surge') {
      context.warnings[input.kind] = { level: input.level, setAt: at };
    } else context.warnings[input.kind] = { setAt: at };
    const decision = decide();
    if (decision.switched) undo = {
      state: { ...previous, warnings: { ...context.warnings } },
      cause: decision.switched.input,
    };
    applyDecision(decision, false);
    if (decision.switched) {
      context.undo = {
        phase: previous.phase,
        phaseSource: previous.phaseSource,
        reason: previous.reason,
        warnings: { ...context.warnings },
        cause: decision.switched.input,
      };
    }
    return context;
  };
  const feedApi = {
    get: () => feedState,
    refresh: async (): Promise<Result<FeedState, FeedError>> => {
      if (pendingFeedError) {
        const error = pendingFeedError;
        pendingFeedError = null;
        return resultErr(error);
      }
      if (!settings.feedEnabled || feedChoice === 'off') return resultErr('disabled');
      if (feedChoice === 'empty' || feedChoice === 'stale' || feedChoice === null) return resultErr('offline');
      const choice = feedChoice;
      const variant = choice === 'near' || choice === 'signal_here' || choice === 'track_approach' || choice === 'left'
        ? choice
        : undefined;
      feedState = fixtureFeedState('fresh');
      if (variant) {
        feedVariant = fixtureStorm(variant);
        feedState = { ...feedState, latest: cardView(now(), feedVariant.bulletin) };
        demoFeedVariant = true;
      } else {
        feedVariant = choice === 'fresh' ? fixtureStorm() : null;
        demoFeedVariant = false;
      }
      applyDecision(decide());
      emit('feed');
      return resultOk(feedState);
    },
  };

  async function* run(question: string, askOpts?: AskOptions): AsyncIterable<AnswerEvent> {
    currentCancel?.();
    let cancelled = false;
    currentCancel = () => { cancelled = true; };
    const signal = askOpts?.signal;
    const wait = async (ms: number) => {
      if (speed === 'fast' || ms <= 0) {
        await Promise.resolve();
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, ms));
    };
    const emitEvent = async function* (event: AnswerEvent, ms = 0): AsyncGenerator<AnswerEvent> {
      await wait(ms);
      if (!cancelled && !signal?.aborted) yield event;
    };
    const normalizedQuestion = question.toLocaleLowerCase('tl');
    const extraPlanField: PlanField | null = scenario === null && /\b(hotline|hotlines)\b/.test(normalizedQuestion)
      ? 'hotlines'
      : scenario === null && /(kontak|tawagan)\b/.test(normalizedQuestion) ? 'contacts' : null;
    const chosen = scenario ?? keywordScenario(question);
    const logId = id('q');
    const isEmergency = chosen === 'emergency_then_guide';
    const route: import('../types/index.ts').RouteResult['primary'] =
      chosen === 'live_data' || chosen === 'live_data_bulletin' ? 'live_data' :
      chosen === 'medical_dose' ? 'medical_dose' :
      chosen === 'plan_center' || chosen === 'plan_empty' || extraPlanField !== null ? 'plan' : 'guide';
    if (isEmergency) {
      yield* emitEvent({ type: 'emergency_card', card: engine.emergency.card(), matched: ['lumulubog'] });
    }
    let outcome: import('../types/index.ts').Outcome = 'answered_ai';
    const phasePassages = FIXTURE_PASSAGES.filter((item) => item.phase.includes(context.phase));
    const ignoredWords = new Set(['ano', 'ang', 'ng', 'sa', 'na', 'kami', 'dapat', 'ito', 'ba', 'kung', 'mga', 'at']);
    const words = normalizedQuestion.split(/[^\p{L}\p{N}]+/u).filter((word) => word && !ignoredWords.has(word));
    const titleMatch = phasePassages.find((item) => words.some((word) =>
      `${item.title} ${item.topic}`.toLocaleLowerCase('tl').includes(word)));
    const passage = (chosen === 'guide_critical'
      ? phasePassages.find((item) => item.critical) ?? titleMatch ?? phasePassages[0]
      : titleMatch ?? phasePassages[0]) ?? FIXTURE_PASSAGES[0]!;
    const guide = async function* (forceCritical = false): AsyncGenerator<AnswerEvent> {
      const p = passage;
      yield* emitEvent({
        type: 'summary',
        passageId: p.id,
        title: p.title,
        text: p.summary,
        pinned: forceCritical || p.critical,
        source: sourceRef(p.source_id, p.locator),
      }, 300);
      const ai = status().ai;
      const skipReason =
        chosen === 'low_battery' ? 'low_battery'
          : chosen === 'no_model' ? 'no_model'
            : chosen === 'ai_rejected' ? null
              : ai.allowed ? null : ai.reason;
      if (skipReason) {
        outcome = 'answered_summary';
        yield* emitEvent({ type: 'ai_status', status: 'skipped', reason: skipReason });
        return;
      }
      yield* emitEvent({ type: 'ai_status', status: 'loading_model' }, 100);
      yield* emitEvent({ type: 'ai_status', status: 'thinking' }, 1100);
      // The AI answer follows settings.language, like the real engine's prompt.
      const answer = settings.language === 'en'
        ? 'According to the guide, prepare a go bag with water, food, medicine and important documents.'
          + ' Keep it near the door and follow the official advisories of the barangay. (SAMPLE answer)'
        : 'Ayon sa gabay, ihanda ang go bag na may tubig, pagkain, gamot at mahahalagang dokumento.'
          + ' Ilagay ito malapit sa pinto at sundin ang mga opisyal na abiso ng barangay. (SAMPLE na sagot)';
      const partials = answer.split(/(?= )/);
      for (let index = 0; index < partials.length; index++) {
        // Section 3.6: first ai_partial at 3 s, then one every 0.12 s.
        yield* emitEvent({ type: 'ai_partial', text: partials.slice(0, index + 1).join('') }, index === 0 ? 1500 : 120);
      }
      if (chosen === 'ai_rejected') {
        outcome = 'answered_summary';
        yield* emitEvent({ type: 'ai_rejected', code: 'unknown_number', fallbackPassageId: p.id });
      } else {
        outcome = 'answered_ai';
        yield* emitEvent({
          type: 'ai_final',
          text: answer,
          used: [p.id],
          timings: { routeMs: 1, searchMs: 1, totalMs: 7000 },
        }, 500);
      }
    };
    switch (chosen) {
      case 'live_data_bulletin':
        outcome = 'bulletin_card';
        yield* emitEvent({ type: 'bulletin_card', card: feedState.latest ?? cardView(now()) });
        break;
      case 'live_data':
        outcome = 'fixed_reply';
        yield* emitEvent({
          type: 'fixed_reply',
          route: 'live_data',
          copyKey: 'no_live_data',
          text: copyText('no_live_data', settings.language),
        });
        break;
      case 'medical_dose':
        outcome = 'fixed_reply';
        yield* emitEvent({
          type: 'fixed_reply',
          route: 'medical_dose',
          copyKey: 'medical_dose',
          text: copyText('medical_dose', settings.language),
        });
        break;
      case 'plan_center': {
        const center = profile.plan.evacuationCenter;
        outcome = 'plan_answer';
        yield* emitEvent({
          type: 'plan_answer',
          field: 'evacuation_center',
          empty: !center,
          ...(center ? { center } : {}),
        });
        break;
      }
      case 'plan_empty':
        outcome = 'plan_answer';
        yield* emitEvent({
          type: 'plan_answer',
          field: 'meeting_place',
          empty: !profile.plan.meetingPlace,
          ...(profile.plan.meetingPlace ? { text: profile.plan.meetingPlace } : {}),
        });
        break;
      case 'guide_full':
        if (extraPlanField === 'contacts') {
          outcome = 'plan_answer';
          yield* emitEvent({
            type: 'plan_answer',
            field: 'contacts',
            empty: profile.plan.contacts.length === 0,
            contacts: profile.plan.contacts,
          });
          break;
        }
        if (extraPlanField === 'hotlines') {
          outcome = 'plan_answer';
          yield* emitEvent({
            type: 'plan_answer',
            field: 'hotlines',
            empty: FIXTURE_HOTLINES.length === 0,
            hotlines: FIXTURE_HOTLINES,
          });
          break;
        }
        yield* guide();
        break;
      case 'refusal':
        outcome = 'refused';
        yield* emitEvent({
          type: 'refusal',
          copyKey: 'refusal',
          text: copyText('refusal', settings.language),
          suggestions: ['go_bag', 'home_prep', 'evacuation'],
        });
        break;
      default: yield* guide(chosen === 'guide_critical');
    }
    if (cancelled || signal?.aborted) {
      history.push({ id: logId, at: toManilaIso(now()), question: logQuestion(question), route, emergency: isEmergency,
        phaseCue: null, phaseHint: null, hint: 'none', topIds: [], topScore: 0, gatePassed: false, outcome: 'cancelled',
        failures: [], timings: { routeMs: 1, searchMs: 0, totalMs: 1 } });
      emit('history');
      currentCancel = null;
      yield { type: 'done', logId, outcome: 'cancelled' };
      return;
    }
    if (chosen === 'phase_cue_during' || chosen === 'phase_cue_after') {
      const to: Phase = chosen === 'phase_cue_during' ? 'during' : 'after';
      const from = context.phase;
      const previousRecommendation = context.recommended?.phase ?? null;
      const questionId = id('question');
      const decision = decide({
        questionId,
        cue: { phase: to, strong: true, matched: [to === 'during' ? 'na dito' : 'humupa'] },
        hint: null,
      });
      const switched = decision.switched;
      const recommendation = decision.state.recommended;
      applyDecision(decision);
      const isNewRecommendation = recommendation?.phase === to && previousRecommendation !== to && from !== to;
      if (switched || (to === 'after' && isNewRecommendation)) {
        const kind = switched ? 'switched' : 'recommended';
        const copyKey = kind === 'switched' ? 'phase_switched' : 'phase_after';
        yield {
          type: 'phase_change',
          kind,
          from,
          to,
          source: 'ask',
          copyKey,
          text: copyText(copyKey, settings.language, {
            phase: copyText(`phase_${to}` as CopyKey, settings.language),
          }),
        };
      }
    }
    yield { type: 'closing', copyKey: 'closing', text: copyText('closing', settings.language) };
    history.push({ id: logId, at: toManilaIso(now()), question: logQuestion(question), route, emergency: isEmergency,
      phaseCue: null, phaseHint: null, hint: 'none', topIds: [], topScore: 0, gatePassed: true, outcome,
      failures: [], timings: { routeMs: 1, searchMs: 1, totalMs: 1 } });
    emit('history');
    yield { type: 'done', logId, outcome };
    currentCancel = null;
  }

  const engine: MockEngine = {
    init: async () => resultOk(info()),
    info,
    status,
    copy: (key, options) => copyText(key, options?.lang ?? settings.language, options?.vars),
    onChange: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    profiles: {
      active: () => hasProfile ? profile : null,
      create: (input) => {
        const errors = validateMemberInput(input.owner, 'owner');
        const name = input.name.trim();
        if (!name) errors.push({ code: 'name_required', field: 'name' });
        else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
        if (errors.length) return { ok: false, errors };
        const owner: Member = {
          ...input.owner,
          id: id('member'),
          relation: 'self',
          photoStatus: 'pending',
          updatedAt: toManilaIso(now()),
        };
        const derived = deriveHousehold([owner], 0);
        profile = {
          id: id('household'),
          name,
          ownerId: owner.id,
          people: [owner],
          petsCount: 0,
          headcount: derived.headcount,
          members: derived.members,
          home: [],
          location: null,
          plan: { contacts: [] },
          updatedAt: toManilaIso(now()),
        };
        ticks = {};
        photoDrafts.clear();
        photoDraftSources.clear();
        hasProfile = true;
        emit('profiles');
        emit('family');
        emit('checklist');
        return { ok: true, value: profile };
      },
      save: (input) => {
        if (!hasProfile || input.id !== profile.id) {
          return { ok: false, errors: [{ code: 'name_required', field: 'id' }] };
        }
        const errors: {
          code: 'name_required' | 'too_long' | 'pets_range' | 'too_many_contacts' | 'contact_phone_invalid';
          field: string;
        }[] = [];
        const name = input.name.trim();
        if (!name) errors.push({ code: 'name_required', field: 'name' });
        else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
        if (!Number.isInteger(input.petsCount) || input.petsCount < 0 || input.petsCount > 20) {
          errors.push({ code: 'pets_range', field: 'petsCount' });
        }
        if (input.plan.contacts.length > 5) {
          errors.push({ code: 'too_many_contacts', field: 'plan.contacts' });
        }
        input.plan.contacts.forEach((contact, index) => {
          if (contact.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(contact.phone.trim())) {
            errors.push({ code: 'contact_phone_invalid', field: `plan.contacts.${index}.phone` });
          }
        });
        if (errors.length) return { ok: false, errors };
        profile = {
          ...profile,
          ...input,
          name,
          members: deriveHousehold(profile.people, input.petsCount).members,
          headcount: profile.people.length,
          updatedAt: toManilaIso(now()),
        };
        emit('profiles');
        emit('checklist');
        return { ok: true, value: profile };
      },
      remove: (profileId) => {
        if (!hasProfile || profileId !== profile.id) return resultErr('not_found');
        for (const member of profile.people) delete member.photo;
        profile.people = [];
        profile.location = null;
        hasProfile = false;
        ticks = {};
        photoDrafts.clear();
        photoDraftSources.clear();
        emit('profiles');
        emit('family');
        emit('checklist');
        return resultOk(undefined);
      },
    },
    family: {
      members: () => hasProfile ? profile.people : [],
      pending: () => hasProfile ? profile.people.filter((member) => member.photoStatus === 'pending') : [],
      saveMember: (input) => {
        if (!hasProfile) return { ok: false, errors: [{ code: 'name_required', field: 'member.name' }] };
        const errors: { code: import('../types/index.ts').MemberErrorCode; field: string }[] =
          validateMemberInput(input, 'member');
        const oldMember = input.id ? profile.people.find((member) => member.id === input.id) : undefined;
        if (input.relation === 'self' && (oldMember?.id ?? '') !== profile.ownerId) {
          errors.push({ code: 'owner_relation', field: 'member.relation' });
        }
        if (!oldMember && profile.people.length >= 30) errors.push({ code: 'too_many_members', field: 'member' });
        if (errors.length) return { ok: false, errors };
        const old = oldMember;
        const member: Member = {
          ...input,
          id: old?.id ?? id('member'),
          photoStatus: old?.photoStatus ?? 'pending',
          updatedAt: toManilaIso(now()),
        };
        if (old?.photo) member.photo = old.photo;
        const people = old
          ? profile.people.map((value) => value.id === old.id ? member : value)
          : [...profile.people, member];
        const derived = deriveHousehold(people, profile.petsCount);
        profile = { ...profile, people, headcount: derived.headcount, members: derived.members };
        emit('family');
        emit('checklist');
        return { ok: true, value: member };
      },
      removeMember: (memberId) => {
        if (!hasProfile || !profile.people.some((member) => member.id === memberId)) return resultErr('not_found');
        if (memberId === profile.ownerId) return resultErr('owner_required');
        profile.people = profile.people.filter((member) => member.id !== memberId);
        profile.headcount = profile.people.length;
        emit('family');
        emit('checklist');
        return resultOk(undefined);
      },
      photos: {
        start: async ({ memberId }, source) => {
          const nextPhotoResult = photoResult;
          photoResult = 'one_face';
          const isPhotoError =
            nextPhotoResult === 'permission_denied' ||
            nextPhotoResult === 'no_camera' ||
            nextPhotoResult === 'unreadable' ||
            nextPhotoResult === 'draft_expired' ||
            nextPhotoResult === 'not_found' ||
            nextPhotoResult === 'io';
          if (isPhotoError) {
            const error = nextPhotoResult as PhotoError;
            return resultErr(error);
          }
          if (!hasProfile || !profile.people.some((member) => member.id === memberId)) return resultErr('not_found');
          const detection: FaceDetection = nextPhotoResult as FaceDetection;
          const count = detection === 'one_face' ? 1 : detection === 'many_faces' ? 2 : 0;
          const faces: FaceBox[] = Array.from({ length: count }, (_, index) => ({
            x: 0.2 + index * 0.3,
            y: 0.2,
            width: 0.2,
            height: 0.2,
          }));
          const draft: PhotoDraft = {
            draftId: id('photo'),
            memberId,
            previewUri: 'fixture://photo-preview',
            detection,
            faces,
            suggestedCrop: faces[0] ?? { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
            expiresAt: toManilaIso(new Date(now().getTime() + 30 * 60_000)),
          };
          photoDrafts.set(draft.draftId, draft);
          photoDraftSources.set(draft.draftId, source);
          return resultOk(draft);
        },
        save: async (draftId, _crop) => {
          const draft = photoDrafts.get(draftId);
          if (!draft) return resultErr('draft_expired');
          const member = hasProfile ? profile.people.find((value) => value.id === draft.memberId) : undefined;
          if (!member) return resultErr('not_found');
          const photo: MemberPhoto = {
            uri: 'fixture://saved-photo',
            bytes: 0,
            source: photoDraftSources.get(draftId) ?? 'gallery',
            faceCheck: draft.detection === 'one_face' ? 'one_face' : 'manual',
            takenAt: toManilaIso(now()),
            version: (member.photo?.version ?? 0) + 1,
          };
          member.photo = photo;
          member.photoStatus = 'done';
          photoDrafts.delete(draftId);
          photoDraftSources.delete(draftId);
          emit('family');
          return resultOk(photo);
        },
        discard: (draftId) => {
          photoDrafts.delete(draftId);
          photoDraftSources.delete(draftId);
        },
        remove: (memberId) => {
          const member = hasProfile ? profile.people.find((value) => value.id === memberId) : undefined;
          if (!member) return resultErr('not_found');
          delete member.photo;
          member.photoStatus = 'pending';
          emit('family');
          return resultOk(undefined);
        },
        removeAll: () => {
          if (hasProfile) {
            for (const member of profile.people) {
              delete member.photo;
              member.photoStatus = 'pending';
            }
          }
          emit('family');
        },
      },
      location: {
        get: profileLocation,
        places: (parent) => {
          const items = FIXTURE_PLACES.items;
          const regionPsgc = new Set(items
            .filter((place) => place.level === 'region')
            .map((place) => place.psgc));
          const topLevel = parent === undefined
            ? items.filter((place) => place.level === 'province'
              || ((place.level === 'city' || place.level === 'municipality')
                && place.parent !== null && regionPsgc.has(place.parent)))
            : items.filter((place) => place.parent === parent);
          return topLevel
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((place) => ({
              psgc: place.psgc,
              name: place.name,
              level: place.level,
              hasChildren: items.some((child) => child.parent === place.psgc),
            }));
        },
        setArea: (psgc) => {
          const place = FIXTURE_PLACES.items.find((item) => item.psgc === psgc && item.level === 'barangay');
          if (!hasProfile || !place) return resultErr('unknown_place');
          profile.location = { psgc };
          applyDecision(decide());
          emit('profiles');
          return resultOk(profile.location);
        },
        useGps: async () => {
          if (!hasProfile) return resultErr('unavailable');
          if (locationResult !== 'ok') return resultErr(locationResult);
          const place = FIXTURE_PLACES.items.find((item) => item.level === 'barangay')!;
          profile.location = {
            psgc: place.psgc,
            coords: { lat: 14.5, lon: 121, accuracyM: 100, at: toManilaIso(now()) },
          };
          emit('profiles');
          return resultOk(profile.location);
        },
      },
      card: (memberId) => {
        const member = hasProfile ? profile.people.find((value) => value.id === memberId) : undefined;
        return member
          ? {
            member,
            ownerName: profile.people[0]?.name ?? '',
            ...(profile.plan.evacuationCenter ? { evacuationCenter: profile.plan.evacuationCenter } : {}),
            ...(profile.plan.meetingPlace ? { meetingPlace: profile.plan.meetingPlace } : {}),
          }
          : null;
      },
      shareCard: async (memberId) => hasProfile && profile.people.some((member) => member.id === memberId)
        ? resultOk(undefined)
        : resultErr('not_found'),
    },
    context: {
      get: () => context, options: () => FIXTURE_WARNINGS, cards: warningCards,
      setPhase: (phase) => {
        const previous = { ...context, warnings: { ...context.warnings } };
        const candidates: PhaseInputKey[] = decide().candidates.map((candidate): PhaseInputKey => candidate.key);
        undo = { state: previous };
        context.undo = {
          phase: previous.phase,
          phaseSource: previous.phaseSource,
          reason: previous.reason,
          warnings: { ...previous.warnings },
        };
        context.phase = phase;
        context.phaseSource = 'manual';
        context.changedAt = toManilaIso(now());
        context.reason = { source: 'manual', text: 'Manwal na pinili.' };
        context.suppressed = [...new Set<PhaseInputKey>([...context.suppressed, ...candidates])];
        if (phase === 'after') context.warnings = {};
        emit('phase');
        emit('context');
        emit('checklist');
        emit('status');
        return context;
      },
      undoPhase: () => {
        if (!undo) return resultErr('nothing_to_undo');
        const previous = undo;
        context = {
          ...previous.state,
          warnings: { ...previous.state.warnings },
          suppressed: [...previous.state.suppressed],
        };
        delete context.undo;
        if (previous.cause) {
          context.suppressed = [...new Set<PhaseInputKey>([...context.suppressed, previous.cause])];
        }
        undo = null;
        emit('phase');
        emit('context');
        emit('checklist');
        emit('status');
        return resultOk(context);
      },
      setWarning: mutateWarning,
      clearWarning: (kind) => {
        delete context.warnings[kind];
        const prefix = kind === 'barangay_order' ? 'warning:barangay-order' : `warning:${kind}`;
        context.suppressed = context.suppressed.filter((key) => !key.startsWith(prefix));
        const decision = decide();
        applyDecision(decision);
        return context;
      },
      reconfirmWarning: (kind) => {
        const warning = context.warnings[kind];
        if (warning) warning.setAt = toManilaIso(now());
        emit('context');
        emit('checklist');
        emit('status');
        return context;
      },
    },
    checklist: {
      view: checklistView,
      tick: (itemId, ticked) => {
        if (!FIXTURE_CHECKLIST.some((item) => item.id === itemId)) return resultErr('unknown_item');
        ticks[itemId] = { ticked, updatedAt: toManilaIso(now()) };
        emit('checklist');
        return resultOk(checklistView());
      },
      reset: () => {
        ticks = {};
        emit('checklist');
        return checklistView();
      },
    },
    ask: { maxLength: 200, run, cancel: () => { currentCancel?.(); }, warm: () => undefined },
    guide: {
      topics: () => {
        const active = FIXTURE_PASSAGES.filter((p) => p.phase.includes(context.phase));
        return [...new Set(active.map((p) => p.topic))].map((topic) => ({
          topic,
          count: active.filter((p) => p.topic === topic).length,
        }));
      },
      byTopic: (topic) => FIXTURE_PASSAGES
        .filter((p) => p.phase.includes(context.phase) && p.topic === topic)
        .map(({ id: passageId, title, summary, critical }) => ({ id: passageId, title, summary, topic, critical })),
      passage: (passageId) => {
        const p = FIXTURE_PASSAGES.find((item) => item.id === passageId);
        return p
          ? {
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
          }
          : null;
      },
      sources: () => FIXTURE_SOURCES,
      reviewers: () => [...new Set(FIXTURE_PASSAGES.map((p) => p.reviewed_by))]
        .map((name) => ({ name, passages: FIXTURE_PASSAGES.filter((p) => p.reviewed_by === name).length })),
    },
    emergency: {
      card: (cardId) => {
        const c = FIXTURE_INTENTS.emergency_cards.find((item) => item.id === cardId)
          ?? FIXTURE_INTENTS.emergency_cards[0]!;
        return {
          id: c.id,
          title: c.title,
          steps: c.steps,
          hotlines: FIXTURE_HOTLINES.filter((hotline) => c.hotline_ids.includes(hotline.id)),
          source: sourceRef(c.source_id),
        };
      },
    },
    plan: {
      hotlines: () => FIXTURE_HOTLINES,
      call: async (value) => FIXTURE_HOTLINES.some((hotline) => hotline.id === value)
        || profile.people.some((member) => member.phone === value)
        || profile.plan.contacts.some((contact) => contact.phone === value)
        ? resultOk(undefined)
        : resultErr('not_found'),
    },
    feed: feedApi,
    evacuation: {
      view: () => ({
        ...(hasProfile && profile.plan.evacuationCenter ? { householdCenter: profile.plan.evacuationCenter } : {}),
        bulletin: feedState.latest,
        storm: hasProfile && profile.location ? feedVariant?.measure ?? null : null,
        centers: feedVariant && hasProfile && profile.location
          ? FIXTURE_CENTERS.map((center, i) => ({ center, distanceKm: i + 1, direction: 'N' as const }))
          : [],
        centersFirst: false,
        barangayCopyKey: 'barangay_decides',
        needsLocation: !profileLocation(),
      }),
    },
    account: {
      state: (): AccountState => ({ signedIn: false }),
      signUp: async () => resultErr('demo_only'),
      signIn: async () => resultErr('demo_only'),
      signOut: () => resultErr('not_signed_in'),
      sendReset: async () => resultErr('demo_only'),
      setSync: () => resultErr('not_signed_in'),
    },
    model: {
      installFromPicker: async (onProgress, signal) => {
        if (status().tier === 'none') return resultErr('tier');
        const result = modelInstallResult;
        modelInstallResult = 'installed';
        if (result === 'cancelled') return resultOk(null);
        if (result !== 'installed') return resultErr(result);
        const total = 810_000_000;
        const steps = speed === 'fast' ? 1 : 30;
        for (let step = 1; step <= steps; step++) {
          if (signal?.aborted) return resultErr('cancelled');
          if (speed === 'fast') await Promise.resolve();
          else await new Promise<void>((resolve) => setTimeout(resolve, 100));
          onProgress(Math.floor(total * step / steps), total);
        }
        modelPresent = true;
        statusAiOverride = undefined;
        emit('status');
        return resultOk('installed');
      },
      remove: async () => {
        modelPresent = false;
        statusAiOverride = undefined;
        emit('status');
      },
    },
    screen: { sosOn: async () => undefined, sosOff: async () => undefined },
    damage: {
      list: () => damage,
      save: (input) => {
        if (!Number.isInteger(input.affectedMembers) || input.affectedMembers < 0 || (input.notes?.length ?? 0) > 300) {
          return resultErr('invalid');
        }
        const draft: DamageDraft = {
          id: input.id ?? id('damage'),
          createdAt: toManilaIso(now()),
          damageType: input.damageType,
          severity: input.severity,
          affectedMembers: input.affectedMembers,
          photoPaths: [],
          sentAt: null,
          ...(input.notes ? { notes: input.notes } : {}),
        };
        damage = [...damage.filter((item) => item.id !== draft.id), draft];
        emit('damage');
        return resultOk(draft);
      },
      addPhoto: async (damageId) => {
        const draft = damage.find((item) => item.id === damageId && item.sentAt === null);
        if (!draft) return resultErr('not_found');
        if (draft.photoPaths.length >= 5) return resultErr('too_many_photos');
        draft.photoPaths.push(`fixture://damage/${draft.id}/${draft.photoPaths.length + 1}.jpg`);
        emit('damage');
        return resultOk(draft);
      },
      removePhoto: (damageId, index) => {
        const draft = damage.find((item) => item.id === damageId);
        if (!draft || !draft.photoPaths[index]) return resultErr('not_found');
        draft.photoPaths.splice(index, 1);
        emit('damage');
        return resultOk(draft);
      },
      send: async (damageId) => !damage.some((item) => item.id === damageId)
        ? resultErr('not_found')
        : !settings.damageReportsOptIn ? resultErr('not_opted_in') : resultErr('offline'),
      remove: (damageId) => {
        damage = damage.filter((item) => item.id !== damageId);
        emit('damage');
      },
    },
    settings: {
      get: () => settings,
      update: (patch) => {
        if (
          (patch.lowBatteryThreshold !== undefined && (patch.lowBatteryThreshold < 5 || patch.lowBatteryThreshold > 50))
          || (patch.staleWarningHours !== undefined && (patch.staleWarningHours < 1 || patch.staleWarningHours > 12))
        ) {
          return resultErr('out_of_range');
        }
        settings = { ...settings, ...patch };
        statusAiOverride = undefined;
        if (patch.feedEnabled === false) {
          feedChoice = 'off';
          feedState = fixtureFeedState('off');
          emit('feed');
        } else if (patch.feedEnabled === true && feedState.status === 'off') {
          feedChoice = 'fresh';
          feedState = fixtureFeedState('fresh');
          emit('feed');
        }
        emit('settings');
        emit('status');
        return resultOk(settings);
      },
    },
    history: {
      list: (limit) => limit === undefined
        ? history.slice().reverse()
        : history.slice().reverse().slice(0, limit),
      clear: () => {
        history = [];
        emit('history');
      },
    },
    evaluation: { summary: (): EvalSummary => EVAL_SUMMARY_FIXTURE },
    packs: {
      installed: () => installedPacks,
      importFromPicker: async () => resultOk(registerPackPreview(makePackPreview())),
      importFile: async () => resultOk(registerPackPreview(makePackPreview())),
      apply: async (previewId) => {
        const preview = packPreviews.get(previewId);
        if (!preview) return resultErr('schema');
        const previous = installedPacks.map((pack) => ({ ...pack }));
        const applied = preview.packs.map((pack) => {
          const old = installedPacks.find((item) => item.packId === pack.packId);
          packRollback.set(pack.packId, previous);
          const installed: InstalledPack = {
            packId: pack.packId,
            kind: pack.kind,
            version: pack.toVersion,
            installedAt: toManilaIso(now()),
            ...(old ? { previousVersion: old.version } : {}),
            ...(pack.guideDate ? { guideDate: pack.guideDate } : {}),
          };
          installedPacks = [...installedPacks.filter((item) => item.packId !== pack.packId), installed];
          return { packId: pack.packId, version: pack.toVersion };
        });
        packPreviews.delete(previewId);
        emit('packs');
        return resultOk({ applied, guideDate: '2026-10-10' });
      },
      rollback: async (packId) => {
        const previous = packRollback.get(packId);
        if (!previous) return resultErr('nothing_to_roll_back');
        installedPacks = previous.map((pack) => ({ ...pack }));
        packRollback.delete(packId);
        emit('packs');
        return resultOk(undefined);
      },
    },
    updates: {
      pending: () => pendingUpdate,
      check: async () => {
        pendingUpdate = makeUpdatePlan();
        emit('updates');
        return resultOk(pendingUpdate);
      },
      download: async (planId, onProgress, signal) => {
        if (signal?.aborted) return resultErr('cancelled');
        const plan = pendingUpdate?.planId === planId ? pendingUpdate : makeUpdatePlan();
        const steps = speed === 'fast' ? 1 : 3;
        for (let step = 1; step <= steps; step++) {
          if (signal?.aborted) return resultErr('cancelled');
          if (speed === 'fast') await Promise.resolve();
          else await new Promise<void>((resolve) => setTimeout(resolve, 100));
          onProgress(Math.floor(plan.totalBytes * step / steps), plan.totalBytes);
        }
        pendingUpdate = null;
        emit('updates');
        return resultOk(registerPackPreview(makePackPreview(plan.items.map((item) => ({
          packId: item.packId,
          kind: item.kind,
          toVersion: item.toVersion,
          sizeBytes: item.blob.size,
          ...(plan.guideDate ? { guideDate: plan.guideDate } : {}),
          upserts: 1,
          deletes: 0,
        })))));
      },
      networkLog: () => [],
    },
    debug: {
      setScenario: (value) => { scenario = value; },
      setStatus: (patch) => {
        statusPatch = { ...statusPatch, ...patch };
        statusAiOverride = patch.ai;
        emit('status');
      },
      emit,
      setPhotoResult: (value) => { photoResult = value; },
      setLocationResult: (value) => { locationResult = value; },
      setFeed: (value) => {
        if (
          value === 'disabled' || value === 'offline' || value === 'http'
          || value === 'unknown_key' || value === 'key_expired' || value === 'bad_signature'
          || value === 'app_too_old' || value === 'rollback' || value === 'hash_mismatch'
          || value === 'schema'
        ) {
          pendingFeedError = value;
          emit('feed');
          return;
        }
        pendingFeedError = null;
        feedChoice = value;
        const isStormVariant =
          value === 'near' || value === 'signal_here' || value === 'track_approach' || value === 'left';
        if (isStormVariant) {
          feedVariant = fixtureStorm(value);
          demoFeedVariant = true;
          feedState = { ...fixtureFeedState('fresh'), latest: cardView(now(), feedVariant.bulletin) };
        } else {
          feedState = fixtureFeedState(value);
          feedVariant = value === 'fresh' || value === 'stale' ? fixtureStorm() : null;
          demoFeedVariant = false;
        }
        const previousPhase = context.phase;
        applyDecision(decide(), true, false);
        emit('feed');
        if (context.phase !== previousPhase) emit('phase');
      },
      setModelInstallResult: (value) => { modelInstallResult = value; },
      reset: () => {
        profile = fixtureProfile();
        hasProfile = true;
        context = defaultContext(now());
        settings = {
          language: 'tl',
          lowBatteryThreshold: 15,
          aiEnabled: true,
          lowBatteryMode: false,
          staleWarningHours: 3,
          feedEnabled: true,
          autoCheckUpdates: false,
          wifiOnly: true,
          topicReportsOptIn: false,
          damageReportsOptIn: false,
        };
        ticks = {};
        history = [];
        statusPatch = {};
        statusAiOverride = undefined;
        scenario = opts.scenario ?? null;
        photoResult = 'one_face';
        locationResult = 'ok';
        pendingFeedError = null;
        feedChoice = 'fresh';
        feedState = fixtureFeedState('fresh');
        feedVariant = fixtureStorm();
        demoFeedVariant = false;
        modelInstallResult = 'installed';
        modelPresent = true;
        damage = fixtureDamageDrafts();
        undo = null;
        photoDrafts.clear();
        photoDraftSources.clear();
        installedPacks = [];
        packPreviews.clear();
        packRollback.clear();
        pendingUpdate = null;
        const changes = [
          'profiles', 'family', 'phase', 'context', 'checklist', 'settings', 'status', 'feed',
          'history', 'damage', 'packs', 'updates',
        ] as const;
        for (const change of changes) emit(change);
      },
    },
  };
  return engine;
}
