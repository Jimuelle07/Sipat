import type {
  AccountState, AiDecision, AnswerEvent, AskOptions, Bulletin, ChecklistTick, ChecklistView, Context, Engine,
  EngineChange, EngineOverrides, EngineInfo, EngineStatus, EvalSummary, FaceBox, FeedError, FeedState, Member,
  MemberPhoto, FaceDetection, HomePoint, LocationService, PhotoDraft, PhotoError, Phase, PickedPhoto, Profile, Result,
  SaveMemberResult, SaveProfileResult, ScreenService, Settings, Store, StoreSchema, StormMeasure, UpdateClient,
  WarningInput, WarningKind, TopicGroup,
} from '../types/index.ts';
import type { ContentFileName, EvacuationCenter, PhaseRules, Place } from '../types/content.ts';
import { ENGINE_API_VERSION } from '../types/engine.ts';
import { bundledContent, rawContent } from '../content/index.ts';
import { buildChecklist } from '../core/checklist.ts';
import { deriveHousehold } from '../core/deriveHousehold.ts';
import { decidePhase } from '../core/decidePhase.ts';
import { haversineKm, measureStorm } from '../core/measureStorm.ts';
import { rankCenters } from '../core/rankCenters.ts';
import { createIndex } from '../core/search.ts';
import { toManilaIso } from '../core/time.ts';
import { validateContent } from '../core/validateContent.ts';
import { createPowerPolicy, type PowerPolicyService } from '../services/power.ts';
import { createModelManager, defaultLlamaBackend, defaultModelFiles } from '../services/model.ts';
import { BUNDLED_MODEL } from '../services/modelEntry.ts';
import { createPhotoService } from '../services/photos.ts';
import { createShareService } from '../services/share.ts';
import { createFilePicker, readFileBytes } from '../services/files.ts';
import { createLocationService } from '../services/location.ts';
import { createPackManager } from '../services/packs.ts';
import { createScreenService } from '../services/screen.ts';
import { createStore } from '../services/store.ts';
import { updateHost } from '../services/updateConfig.ts';
import { appendNetworkLog, createUpdateClient, type FetchLike } from '../services/updates.ts';
import { runAskPipeline } from './askPipeline.ts';
import { copyText } from './copy.ts';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval.ts';
import { createDemoUpdateClient, demoContent, demoSeedEnabled, demoStore } from './demoSeed.ts';
// The laptop evaluation report, bundled at build time (`npm run eval` writes it). Never read at runtime.
import evalReport from '../../eval/results/latest.json';

// Keep in step with `version` in app.config.ts; manifests compare it with `min_app_version`.
const APP_VERSION = '0.1.0';

const DEFAULT_SETTINGS: Settings = {
  language: 'tl', lowBatteryThreshold: 15, aiEnabled: true, lowBatteryMode: false,
  staleWarningHours: 3, feedEnabled: true, autoCheckUpdates: true, wifiOnly: true,
  topicReportsOptIn: false, damageReportsOptIn: false,
};
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E extends string>(code: E, message: string = code): Result<never, E> => ({
  ok: false,
  error: { code, message },
});
const iso = (date: Date) => toManilaIso(date);
const keyFor = (id: string) => `checklist:${id}` as `checklist:${string}`;
const phoneRe = /^\+?\d{7,15}$/;
const cleanPhone = (value: string) => value.replace(/[\s()\-]/g, '');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
// Used only to read rankCenters' `centersFirst` flag when the household has no location.
const FALLBACK_HOME: HomePoint = { point: { lat: 0, lon: 0 }, from: 'area', areaCodes: [] };
// How many ranked centers the Evacuation screen lists (proposal; the doc sets no number).
const CENTERS_LIMIT = 5;
// The latest Node evaluation report; the placeholder fixture only when the bundled file has none.
// `scripts/eval.ts` writes `summary` as an EvalSummary; the record check guards a hand-edited file.
const evalReportFile: unknown = evalReport;
const BUNDLED_EVAL: EvalSummary = isRecord(evalReportFile) && isRecord(evalReportFile.summary)
  ? evalReportFile.summary as unknown as EvalSummary
  : EVAL_SUMMARY_FIXTURE;

/** The evacuation centers carried by the merged content (the bundled set or an applied area pack). */
function evacuationCentersFrom(file: unknown): EvacuationCenter[] {
  if (!isRecord(file) || !Array.isArray(file.items)) return [];
  return file.items.filter((item): item is EvacuationCenter => isRecord(item)
    && typeof item.id === 'string' && typeof item.name === 'string'
    && isRecord(item.coords) && typeof item.coords.lat === 'number' && typeof item.coords.lon === 'number');
}

function emptyContext(at: string): Context {
  return {
    phase: 'before', phaseSource: 'manual', reason: { source: 'manual', text: '' }, changedAt: at,
    recommended: null, suppressed: [], warnings: {},
  };
}

function fallbackRules() {
  const source = { placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null };
  return {
    warning_to_phase: { any_active_warning: 'during' as const, basis: 'product_rule' as const },
    bands: { near: { ...source, max_km: null }, approach: { ...source, max_km: null } },
    evacuation_threshold: { ...source, category_min: null, tcws_min: null },
  };
}

function profileFrom(owner: Member, id: string, name: string, at: string): Profile {
  const people = [{ ...owner, relation: 'self' as const }];
  return {
    id, name, ownerId: owner.id, people, petsCount: 0, ...deriveHousehold(people, 0), home: [],
    location: null, plan: { contacts: [] }, updatedAt: at,
  };
}

function cloneProfile(profile: Profile): Profile {
  return JSON.parse(JSON.stringify(profile)) as Profile;
}

function p50(values: number[]): number | undefined {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function createEngine(overrides: EngineOverrides = {}): Engine {
  const store: Store = overrides.store ?? createStore();
  const now = overrides.now ?? (() => new Date());
  let content = bundledContent;
  let rawMap: Partial<Record<ContentFileName, unknown>> = rawContent;
  let index = createIndex(content.passages);
  let profiles: Profile[] = [];
  let activeId: string | null = null;
  let context = emptyContext(iso(now()));
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let history: StoreSchema['questionLog'] = [];
  // The feed cache is the store's `feed` entry, read through this helper so a seeded, refreshed or
  // cleared cache (including the contract harness's) is always observed (docs section 6: the latest
  // bulletin comes "from the feed cache").
  const storedFeed = (): StoreSchema['feed'] | undefined => {
    try { return store.get('feed'); } catch { return undefined; }
  };
  const initialFeed = storedFeed();
  let lastFeedCheckAt: string | undefined =
    typeof initialFeed?.checkedAt === 'string' ? initialFeed.checkedAt : undefined;
  let installedModel = false;
  let cachedTier: EngineStatus['tier'] = 'none';
  let battery: EngineStatus['battery'] = null;
  let ai: AiDecision = { allowed: false, reason: 'no_model' };
  let refreshing = false;
  let activeController: AbortController | null = null;
  let idSeq = 0;
  const listeners = new Set<(change: EngineChange) => void>();
  const emit = (change: EngineChange) => {
    for (const listener of [...listeners]) {
      try { listener(change); } catch { /* a throwing listener must not break the engine */ }
    }
  };
  const newId = (kind: string) => `${kind}-${now().getTime()}-${++idSeq}`;
  const activeRef = () => profiles.find((profile) => profile.id === activeId) ?? null;
  const active = () => { const profile = activeRef(); return profile ? cloneProfile(profile) : null; };
  // Production services. `overrides.*` stays a test seam. The build has the online stretch only when
  // a pinned host is configured: otherwise `info().online` is false, no update client exists and
  // every online call is `disabled` (docs section 3.2 and section 11.a).
  const location: LocationService = overrides.location ?? createLocationService();
  const screen: ScreenService = overrides.screen ?? createScreenService();
  const packs = createPackManager({ store, now: () => iso(now()), readFile: readFileBytes, appVersion: APP_VERSION });
  const pinnedHost = updateHost();
  const online = pinnedHost !== null;
  // Demo builds (`EXPO_PUBLIC_DEMO_SEED=1`) get seeded data and an in-memory feed; see docs/seed_data.md.
  const demo = demoSeedEnabled();
  const realFetch: FetchLike = (url, init) => (globalThis.fetch as unknown as FetchLike)(url, init);
  const updates: UpdateClient | undefined = overrides.updates ?? (pinnedHost
    ? createUpdateClient({
      host: pinnedHost, fetch: realFetch, store, now, appVersion: APP_VERSION,
      province: () => provincePsgc(),
      importArchive: (files) => packs.importArchive(files),
    })
    : demo ? createDemoUpdateClient(now) : undefined);
  // The household's province PSGC, or null (e.g. NCR has none). At most the province code ever
  // reaches a request (AGENTS rule 6); names, notes, photos and coordinates never do.
  function provincePsgc(): string | null {
    const household = activeRef()?.location;
    if (!household) return null;
    const places = getPlaces();
    let place = places.find((item) => item.psgc === household.psgc);
    const seen = new Set<string>();
    while (place && !seen.has(place.psgc)) {
      if (place.level === 'province') return place.psgc;
      seen.add(place.psgc);
      place = places.find((item) => item.psgc === place?.parent);
    }
    return null;
  }
  // The barangay with the nearest places.json centroid to a one-shot GPS reading.
  function nearestBarangay(reading: { lat: number; lon: number }): Place | undefined {
    let best: Place | undefined;
    let bestKm = Infinity;
    for (const place of getPlaces()) {
      if (place.level !== 'barangay' || !place.centroid) continue;
      const km = haversineKm(reading, place.centroid);
      if (km < bestKm) { bestKm = km; best = place; }
    }
    return best;
  }
  const phaseRules = (): PhaseRules => content.phaseRules ?? fallbackRules();
  // A malformed cached feed or bulletin degrades to null instead of throwing.
  const cachedBulletin = (): Bulletin | null => {
    const bulletins = storedFeed()?.bulletins;
    if (!Array.isArray(bulletins) || bulletins.length === 0) return null;
    const bulletin = bulletins[0] as Partial<Bulletin> | undefined;
    if (!bulletin || typeof bulletin !== 'object') return null;
    if (typeof bulletin.id !== 'string' || typeof bulletin.stormId !== 'string') return null;
    if (typeof bulletin.issuedAt !== 'string' || typeof bulletin.fetchedAt !== 'string') return null;
    if (!bulletin.storm || typeof bulletin.storm.category !== 'string') return null;
    if (!bulletin.position || typeof bulletin.position.lat !== 'number'
      || typeof bulletin.position.lon !== 'number' || typeof bulletin.position.at !== 'string') return null;
    if (!Array.isArray(bulletin.forecast) || !Array.isArray(bulletin.signalAreas)) return null;
    return bulletin as Bulletin;
  };
  const currentFeed = () => {
    if (!settings.feedEnabled || !updates) {
      return { status: 'off' as const, refreshing, latest: null, serverStale: false };
    }
    try {
      const feed = storedFeed();
      const fetchedAt = typeof feed?.fetchedAt === 'string' ? feed.fetchedAt : undefined;
      const checkedAt = typeof lastFeedCheckAt === 'string' ? lastFeedCheckAt : undefined;
      const serverStale = feed?.serverStale === true;
      const bulletin = cachedBulletin();
      if (!bulletin) {
        return {
          status: 'empty' as const,
          refreshing,
          latest: null,
          ...(fetchedAt ? { fetchedAt } : {}),
          ...(checkedAt ? { checkedAt } : {}),
          serverStale,
        };
      }
      const nowMs = now().getTime();
      const issuedHoursAgo = Math.max(0, Math.floor((nowMs - Date.parse(bulletin.issuedAt)) / 3_600_000));
      const fetchedHoursAgo = Math.max(0, Math.floor((nowMs - Date.parse(bulletin.fetchedAt)) / 3_600_000));
      const stale = serverStale || issuedHoursAgo >= settings.staleWarningHours;
      return {
        status: stale ? 'stale' as const : 'fresh' as const, refreshing,
        latest: { bulletin, issuedHoursAgo, fetchedHoursAgo, stale,
          ageText: copyText('bulletin_age', { vars: { issuedAt: bulletin.issuedAt, fetchedAt: bulletin.fetchedAt } }) },
        ...(fetchedAt ? { fetchedAt } : {}),
        ...(checkedAt ? { checkedAt } : {}),
        serverStale,
      };
    } catch {
      return { status: 'empty' as const, refreshing, latest: null, serverStale: false };
    }
  };
  const powerService: PowerPolicyService | null = overrides.power ? null : createPowerPolicy({
    getSettings: () => settings,
    modelPresent: () => installedModel,
  });
  const power = overrides.power ?? powerService!;
  const model = overrides.model ?? createModelManager({
    backend: defaultLlamaBackend(),
    files: defaultModelFiles(),
    readTier: async () => powerService?.tier() ?? 'none',
  });
  const photosService = overrides.photos ?? createPhotoService();
  const shareService = overrides.share ?? createShareService();
  const filePicker = overrides.files ?? createFilePicker();
  const powerUpdate = async () => {
    cachedTier = powerService
      ? await powerService.tier().catch(() => 'none')
      : await model.tier().catch(() => 'none');
    battery = powerService?.battery() ?? null;
    ai = await power.aiAllowed().catch(() => ({ allowed: false, reason: 'no_model' as const }));
    emit('status');
  };
  // After either install path: re-read the model file, recompute the AI decision, refresh Settings.
  const markModelInstalled = async (): Promise<void> => {
    const present = (model as typeof model & { present?: () => Promise<boolean> }).present;
    installedModel = present ? await present().catch(() => true) : true;
    await powerUpdate();
    emit('status');
  };
  power.onChange((decision) => {
    ai = decision;
    battery = powerService?.battery() ?? null;
    emit('status');
  });
  model.onStateChange(() => emit('status'));

  const save = <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): boolean => {
    try { store.set(key, value); return true; } catch { return false; }
  };
  const drop = (key: Parameters<Store['delete']>[0]): void => {
    try { store.delete(key); } catch { /* a failed delete must not throw */ }
  };
  const applyDecision = (next: Context) => {
    const phaseChanged = next.phase !== context.phase || next.phaseSource !== context.phaseSource
      || JSON.stringify(next.reason) !== JSON.stringify(context.reason)
      || JSON.stringify(next.recommended) !== JSON.stringify(context.recommended)
      || JSON.stringify(next.lastSwitch) !== JSON.stringify(context.lastSwitch);
    const warningsChanged = JSON.stringify(next.warnings) !== JSON.stringify(context.warnings);
    context = next;
    save('context', context);
    if (warningsChanged) emit('context');
    if (warningsChanged || phaseChanged) {
      emit('checklist');
      emit('status');
    }
    if (phaseChanged) emit('phase');
  };
  const getPlaces = (): Place[] =>
    content.places?.items ?? [];
  const homePoint = (): HomePoint | null => {
    const location = active()?.location;
    if (!location) return null;
    const areaCodes: string[] = [];
    let place = getPlaces().find((item) => item.psgc === location.psgc);
    const seen = new Set<string>();
    while (place && !seen.has(place.psgc)) {
      areaCodes.push(place.psgc);
      seen.add(place.psgc);
      place = getPlaces().find((item) => item.psgc === place?.parent);
    }
    if (!areaCodes.length) areaCodes.push(location.psgc);
    if (location.coords) return {
      point: { lat: location.coords.lat, lon: location.coords.lon }, from: 'gps', areaCodes,
    };
    const centroid = getPlaces().find((item) => item.psgc === location.psgc)?.centroid;
    return centroid ? { point: centroid, from: 'area', areaCodes } : null;
  };
  // The one storm input every decidePhase call shares: the latest cached bulletin measured against
  // the household home point, regardless of whether it was fetched this session.
  const stormInput = (): { bulletin: Bulletin; measure: StormMeasure } | null => {
    const bulletin = cachedBulletin();
    const home = homePoint();
    if (!bulletin || !home) return null;
    try { return { bulletin, measure: measureStorm(bulletin, home) }; }
    catch { return null; }
  };
  const decideCurrentPhase = () => {
    const decision = decidePhase({ context, storm: stormInput(), rules: phaseRules(), now: iso(now()) });
    applyDecision({ ...decision.state, warnings: context.warnings });
    return decision;
  };
  const refs = () => content.sources;
  const sourceRef = (sourceId: string, locator?: string) => {
    const source = content.sources.find((item) => item.id === sourceId);
    return {
      sourceId,
      agency: source?.agency ?? '',
      title: source?.title ?? '',
      date: source?.date ?? '',
      url: source?.url ?? '',
      ...(locator ? { locator } : {}),
    };
  };
  const emergencyCard = (id?: string) => {
    const rules = content.rules;
    const item = rules.emergency_cards.find((card) => card.id === (id ?? rules.emergency.card_id))
      ?? rules.emergency_cards[0];
    return item
      ? {
        id: item.id, title: item.title, steps: [...item.steps],
        hotlines: item.hotline_ids
          .map((hid) => content.hotlines.find((hotline) => hotline.id === hid))
          .filter((h): h is NonNullable<typeof h> => h !== undefined),
        source: sourceRef(item.source_id),
      }
      : { id: 'emergency-default', title: '', steps: [], hotlines: [], source: sourceRef('') };
  };
  const readChecklist = (profileId: string): Record<string, ChecklistTick> => {
    try { return store.get(keyFor(profileId)) ?? {}; } catch { return {}; }
  };
  const damageDrafts = (): StoreSchema['damageReports'] => {
    try { return store.get('damageReports') ?? []; } catch { return []; }
  };
  const checklistView = (): ChecklistView => {
    const profile = active();
    if (!profile) return { phase: context.phase, warningCards: [], groups: [], progress: { done: 0, total: 0 } };
    return buildChecklist(profile, context, content.checklist, content.warnings, readChecklist(profile.id),
      now(), settings.staleWarningHours);
  };
  const info = (): EngineInfo => {
    const guideDate = content.passages.reduce(
      (date, passage) => passage.reviewed_at > date ? passage.reviewed_at : date,
      '',
    );
    return { appVersion: APP_VERSION, engineApiVersion: ENGINE_API_VERSION, guideDate,
      passagesCount: content.passages.length, sourcesCount: content.sources.length, packs: packs.installed(),
      online, model: { fileName: BUNDLED_MODEL.file_name, sizeBytes: BUNDLED_MODEL.size, present: installedModel,
        attribution: 'Built with Llama' } };
  };
  const status = (): EngineStatus => {
    const view = checklistView();
    return { tier: cachedTier, model: model.state(), ai, battery,
      ...(view.stale ? { stale: { kind: view.stale.kind, hoursSinceSet: view.stale.hoursSinceSet } } : {}) };
  };
  const contextApi: Engine['context'] = {
    get: () => context,
    options: () => content.warnings,
    cards: () => checklistView().warningCards,
    setPhase: (phase: Phase) => {
      const before = context;
      const candidates = decidePhase({ context, storm: stormInput(), rules: phaseRules(), now: iso(now()) }).candidates;
      const next = {
        ...context, phase, phaseSource: 'manual' as const, reason: { source: 'manual' as const, text: '' },
        changedAt: iso(now()), recommended: null, warnings: phase === 'after' ? {} : context.warnings,
        undo: { phase: before.phase, phaseSource: before.phaseSource, reason: before.reason,
          warnings: before.warnings },
        suppressed: [...new Set([...context.suppressed, ...candidates.map((candidate) => candidate.key)])],
      };
      applyDecision(next);
      return next;
    },
    undoPhase: () => {
      if (!context.undo) return err('nothing_to_undo', 'Nothing to undo');
      const undo = context.undo;
      const { undo: _undo, ...prior } = context;
      void _undo;
      const next = { ...prior, phase: undo.phase, phaseSource: undo.phaseSource, reason: undo.reason,
        warnings: undo.warnings, changedAt: iso(now()), recommended: null,
        suppressed: undo.cause ? [...new Set([...context.suppressed, undo.cause])] : context.suppressed };
      applyDecision(next);
      return ok(next);
    },
    setWarning: (input: WarningInput) => {
      const warnings = { ...context.warnings };
      if (input.kind === 'gale' || input.kind === 'barangay_order') {
        warnings[input.kind] = { setAt: iso(now()) };
      } else if (input.kind === 'tcws') {
        warnings.tcws = { level: input.level, setAt: iso(now()) };
      } else if (input.kind === 'rainfall' || input.kind === 'surge') {
        warnings[input.kind] = { level: input.level, setAt: iso(now()) };
      }
      const candidate = { ...context, warnings };
      const decision = decidePhase({ context: candidate, storm: stormInput(), rules: phaseRules(), now: iso(now()) });
      applyDecision({ ...decision.state, warnings });
      return context;
    },
    clearWarning: (kind: WarningKind) => {
      const warnings = { ...context.warnings };
      delete warnings[kind];
      const prefix = `warning:${kind === 'barangay_order' ? 'barangay-order' : kind}`;
      context = { ...context, warnings, suppressed: context.suppressed.filter((key) => !key.startsWith(prefix)) };
      emit('context');
      emit('checklist');
      emit('status');
      decideCurrentPhase();
      return context;
    },
    reconfirmWarning: (kind: WarningKind) => {
      const current = context.warnings[kind];
      if (current) {
        context = { ...context, warnings: { ...context.warnings, [kind]: { ...current, setAt: iso(now()) } } };
      }
      save('context', context);
      emit('context');
      emit('checklist');
      emit('status');
      return context;
    },
  };

  const profilesApi: Engine['profiles'] = {
    active,
    create(input) {
      const name = input.name.trim();
      const ownerName = input.owner.name.trim();
      const errors: Extract<SaveProfileResult, { ok: false }>['errors'] = [];
      if (!name) errors.push({ code: 'name_required', field: 'name' });
      else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
      if (!ownerName) errors.push({ code: 'name_required', field: 'owner.name' });
      else if (ownerName.length > 40) errors.push({ code: 'too_long', field: 'owner.name' });
      if (input.owner.note && input.owner.note.length > 80) errors.push({ code: 'too_long', field: 'owner.note' });
      if (input.owner.phone && !phoneRe.test(cleanPhone(input.owner.phone))) {
        errors.push({ code: 'phone_invalid', field: 'owner.phone' });
      }
      if (errors.length) return { ok: false as const, errors };
      for (const oldProfile of profiles) {
        for (const oldMember of oldProfile.people) {
          if (oldMember.photo) void photosService.remove(oldMember.photo.uri).catch(() => undefined);
        }
        drop(keyFor(oldProfile.id));
      }
      const member: Member = { id: newId('member'), name: ownerName, relation: 'self', ageGroup: input.owner.ageGroup,
        needs: [...input.owner.needs], photoStatus: 'pending', updatedAt: iso(now()),
        ...(input.owner.phone ? { phone: input.owner.phone } : {}),
        ...(input.owner.note ? { note: input.owner.note } : {}) };
      const profile = profileFrom(member, newId('household'), name, iso(now()));
      profiles = [profile];
      activeId = profile.id;
      save('profiles', profiles);
      save('activeProfileId', activeId);
      save(keyFor(profile.id), {});
      emit('profiles');
      emit('family');
      emit('checklist');
      return { ok: true as const, value: profile };
    },
    save(input) {
      const profile = activeRef();
      if (!profile || input.id !== profile.id) {
        return { ok: false as const, errors: [{ code: 'name_required' as const, field: 'id' }] };
      }
      const errors: Extract<SaveProfileResult, { ok: false }>['errors'] = [];
      const name = input.name.trim();
      if (!name) errors.push({ code: 'name_required', field: 'name' });
      else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
      if (!Number.isInteger(input.petsCount) || input.petsCount < 0 || input.petsCount > 20) {
        errors.push({ code: 'pets_range', field: 'petsCount' });
      }
      if (input.plan.contacts.length > 5) errors.push({ code: 'too_many_contacts', field: 'plan.contacts' });
      input.plan.contacts.forEach((c, i) => {
        if (c.phone && !phoneRe.test(cleanPhone(c.phone))) {
          errors.push({ code: 'contact_phone_invalid', field: `plan.contacts.${i}.phone` });
        }
      });
      if (errors.length) return { ok: false as const, errors };
      Object.assign(profile, {
        name, petsCount: input.petsCount, home: [...input.home],
        plan: { ...input.plan, contacts: [...input.plan.contacts] },
        ...deriveHousehold(profile.people, input.petsCount), updatedAt: iso(now()),
      });
      save('profiles', profiles);
      emit('profiles');
      emit('checklist');
      return { ok: true as const, value: profile };
    },
    remove(id) {
      if (!active() || activeId !== id) return err('not_found', 'Household not found');
      for (const member of active()?.people ?? []) {
        if (member.photo) void photosService.remove(member.photo.uri).catch(() => undefined);
      }
      profiles = [];
      activeId = null;
      save('profiles', profiles);
      save('activeProfileId', null);
      drop(keyFor(id));
      emit('profiles');
      emit('family');
      emit('checklist');
      return ok(undefined);
    },
  };

  const photos: Engine['family']['photos'] = {
    async start(target, source) {
      const member = active()?.people.find((person) => person.id === target.memberId);
      if (!member) return err('not_found', 'Member not found');
      let picked: Result<PickedPhoto | null, PhotoError>;
      try {
        picked = await photosService.pick(source);
      } catch {
        return err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo could not be opened');
      }
      if (!picked.ok) return err(picked.error.code, picked.error.message);
      if (!picked.value) return ok(null);
      let detected: { detection: FaceDetection; faces: FaceBox[] };
      try {
        detected = await photosService.detect(picked.value.uri);
      } catch {
        detected = { detection: 'unavailable', faces: [] };
      }
      const id = newId('photo');
      const rect = detected.faces[0] ?? { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      photoSources.set(id, source);
      const draft: PhotoDraft = { draftId: id, memberId: target.memberId, previewUri: picked.value.uri,
        detection: detected.detection, faces: detected.faces, suggestedCrop: rect,
        expiresAt: iso(new Date(now().getTime() + 30 * 60_000)) };
      photoDrafts.set(id, draft);
      return ok(draft);
    },
    async save(draftId, crop) {
      const draft = photoDrafts.get(draftId);
      if (!draft) return err('not_found', 'Photo draft not found');
      if (Date.parse(draft.expiresAt) <= now().getTime()) {
        photoDrafts.delete(draftId);
        photoSources.delete(draftId);
        await photosService.remove(draft.previewUri).catch(() => undefined);
        return err('draft_expired', 'Photo draft expired');
      }
      const member = activeRef()?.people.find((person) => person.id === draft.memberId);
      if (!member) return err('io', 'Member unavailable');
      const savedPhoto = await photosService
        .saveCrop(draft.previewUri, crop, member.id)
        .catch(() => err('io', 'Photo could not be saved'));
      if (!savedPhoto.ok) return savedPhoto;
      if (member.photo) await photosService.remove(member.photo.uri).catch(() => undefined);
      const photo: MemberPhoto = { ...savedPhoto.value, source: photoSources.get(draftId) ?? 'gallery',
        faceCheck: draft.detection === 'one_face' ? 'one_face' : 'manual', takenAt: iso(now()), version: 1 };
      member.photo = photo;
      member.photoStatus = 'done';
      member.updatedAt = iso(now());
      photoDrafts.delete(draftId);
      photoSources.delete(draftId);
      await photosService.remove(draft.previewUri).catch(() => undefined);
      if (!save('profiles', profiles)) return err('io', 'Photo could not be saved');
      emit('family');
      emit('checklist');
      return ok(photo);
    },
    discard(draftId) {
      const draft = photoDrafts.get(draftId);
      if (draft) void photosService.remove(draft.previewUri).catch(() => undefined);
      photoDrafts.delete(draftId);
      photoSources.delete(draftId);
    },
    remove(memberId) {
      const member = activeRef()?.people.find((person) => person.id === memberId);
      if (!member) return err('not_found', 'Member not found');
      if (member.photo) void photosService.remove(member.photo.uri).catch(() => undefined);
      delete member.photo;
      member.photoStatus = 'pending';
      save('profiles', profiles);
      emit('family');
      return ok(undefined);
    },
    removeAll() {
      for (const profile of profiles) {
        for (const member of profile.people) {
          if (member.photo) void photosService.remove(member.photo.uri).catch(() => undefined);
          delete member.photo;
          member.photoStatus = 'pending';
        }
      }
      save('profiles', profiles);
      emit('family');
    },
  };
  const photoDrafts = new Map<string, import('../types/engine.ts').PhotoDraft>();
  const photoSources = new Map<string, 'camera' | 'gallery'>();

  const family: Engine['family'] = {
    members: () => active()?.people ?? [],
    pending: () => (active()?.people ?? []).filter((member) => member.photoStatus === 'pending'),
    saveMember(input) {
      const profile = activeRef();
      if (!profile) return { ok: false, errors: [{ code: 'name_required', field: 'member.name' }] };
      const name = input.name.trim();
      const errors: Extract<SaveMemberResult, { ok: false }>['errors'] = [];
      if (!name) errors.push({ code: 'name_required', field: 'member.name' });
      else if (name.length > 40) errors.push({ code: 'too_long', field: 'member.name' });
      if (input.note && input.note.length > 80) errors.push({ code: 'too_long', field: 'member.note' });
      if (input.phone && !phoneRe.test(cleanPhone(input.phone))) {
        errors.push({ code: 'phone_invalid', field: 'member.phone' });
      }
      const old = input.id ? profile.people.find((item) => item.id === input.id) : undefined;
      if (input.id && !old) return { ok: false, errors: [{ code: 'name_required', field: 'member.id' }] };
      if (!old && profile.people.length >= 30) errors.push({ code: 'too_many_members', field: 'member' });
      if (input.relation === 'self' && old?.id !== profile.ownerId) {
        errors.push({ code: 'owner_relation', field: 'member.relation' });
      }
      if (old?.id === profile.ownerId && input.relation !== 'self') {
        errors.push({ code: 'owner_relation', field: 'member.relation' });
      }
      if (errors.length) return { ok: false, errors };
      const member: Member = { id: old?.id ?? newId('member'), name, relation: input.relation,
        ageGroup: input.ageGroup, needs: [...input.needs], photoStatus: old?.photoStatus ?? 'pending',
        updatedAt: iso(now()), ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(old?.photo ? { photo: old.photo } : {}) };
      if (old) profile.people[profile.people.indexOf(old)] = member;
      else profile.people.push(member);
      Object.assign(profile, deriveHousehold(profile.people, profile.petsCount), { updatedAt: iso(now()) });
      save('profiles', profiles);
      emit('family');
      emit('checklist');
      return { ok: true, value: member };
    },
    removeMember(memberId) {
      const profile = activeRef();
      const member = profile?.people.find((person) => person.id === memberId);
      if (!profile || !member) return err('not_found', 'Member not found');
      if (memberId === profile.ownerId) return err('owner_required', 'Cannot remove owner');
      if (member.photo) void photosService.remove(member.photo.uri).catch(() => undefined);
      profile.people = profile.people.filter((person) => person.id !== memberId);
      Object.assign(profile, deriveHousehold(profile.people, profile.petsCount), { updatedAt: iso(now()) });
      save('profiles', profiles);
      emit('family');
      emit('checklist');
      return ok(undefined);
    },
    photos,
    location: {
      get: () => active()?.location ?? null,
      places(parentPsgc) {
        // Section 3.2: provinces when omitted, then municipalities and cities, then barangays.
        // A city or municipality whose parent is a region (e.g. NCR) is listed too, so those areas
        // stay reachable even though they have no province (contract gap: the doc says "provinces").
        const places = getPlaces();
        const regionPsgc = new Set(places
          .filter((place) => place.level === 'region')
          .map((place) => place.psgc));
        const level = parentPsgc === undefined
          ? places.filter((place) => place.level === 'province'
            || ((place.level === 'city' || place.level === 'municipality')
              && place.parent !== null && regionPsgc.has(place.parent)))
          : places.filter((place) => place.parent === parentPsgc);
        return level
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((place) => ({ psgc: place.psgc, name: place.name, level: place.level,
            hasChildren: places.some((child) => child.parent === place.psgc) }));
      },
      setArea(psgc) {
        const place = getPlaces().find((item) => item.psgc === psgc && item.level === 'barangay');
        if (!place) return err('unknown_place', 'Unknown place');
        const profile = activeRef();
        if (!profile) return err('unknown_place', 'No household');
        profile.location = { psgc };
        profile.updatedAt = iso(now());
        save('profiles', profiles);
        emit('profiles');
        decideCurrentPhase();
        return ok(profile.location);
      },
      async useGps() {
        const profile = activeRef();
        if (!profile) return err('unavailable', 'No household');
        const result = await location.readOnce().catch(() => err('unavailable', 'Location unavailable'));
        if (!result.ok) return result;
        const { lat, lon, accuracyM, at } = result.value;
        const place = nearestBarangay({ lat, lon });
        if (!place) return err('unavailable', 'No barangay coordinates to match the reading');
        // The reading stays on the phone: stored in the profile only, never logged or sent.
        profile.location = { psgc: place.psgc, coords: { lat, lon, accuracyM, at } };
        profile.updatedAt = iso(now());
        save('profiles', profiles);
        emit('profiles');
        decideCurrentPhase();
        return ok({ ...profile.location, coords: { lat, lon, accuracyM, at } });
      },
    },
    card(memberId) {
      const profile = active();
      const member = profile?.people.find((person) => person.id === memberId);
      const owner = profile?.people.find((person) => person.id === profile.ownerId);
      return profile && member
        ? { member, ownerName: owner?.name ?? '',
          ...(owner?.phone ? { ownerPhone: owner.phone } : {}),
          ...(profile.plan.evacuationCenter ? { evacuationCenter: profile.plan.evacuationCenter } : {}),
          ...(profile.plan.meetingPlace ? { meetingPlace: profile.plan.meetingPlace } : {}) }
        : null;
    },
    async shareCard(memberId, cardView) {
      if (!active()?.people.some((person) => person.id === memberId)) return err('not_found', 'Member not found');
      return shareService.shareMemberCard(cardView).catch(() => err('failed', 'Share failed'));
    },
  };

  const checklist: Engine['checklist'] = {
    view: checklistView,
    tick(itemId, ticked) {
      const profile = active();
      if (!profile || !content.checklist.some((item) => item.id === itemId)) {
        return err('unknown_item', 'Checklist item not found');
      }
      const key = keyFor(profile.id);
      const ticks = readChecklist(profile.id);
      ticks[itemId] = { ticked, updatedAt: iso(now()) } satisfies ChecklistTick;
      save(key, ticks);
      emit('checklist');
      return ok(checklistView());
    },
    reset() {
      const profile = active();
      if (profile) drop(keyFor(profile.id));
      emit('checklist');
      return checklistView();
    },
  };
  const historyApi: Engine['history'] = {
    list: (limit = 200) => [...history].reverse().slice(0, limit),
    clear() {
      history = [];
      drop('questionLog');
      emit('history');
    },
  };
  const ask: Engine['ask'] = {
    maxLength: 200,
    run(question: string, opts?: AskOptions): AsyncIterable<AnswerEvent> {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const relayAbort = () => controller.abort();
      opts?.signal?.addEventListener('abort', relayAbort, { once: true });
      return runAskPipeline(question, {
        content, index, profile: active, context: () => context, phaseRules: phaseRules(),
        applyContext: applyDecision,
        power, model, emergencyCard, hotlines: () => content.hotlines.filter((h) => h.scope === 'national'),
        evacuationCenters: () => [],
        latestBulletin: () => currentFeed().latest,
        storm: stormInput,
        now: () => now().getTime(), newId: () => newId('question'), language: () => settings.language,
        log(entry) {
          history = [...history, entry].slice(-200);
          save('questionLog', history);
          emit('history');
        },
      }, { signal: controller.signal });
    },
    cancel() {
      activeController?.abort();
      void model.stop().catch(() => undefined);
    },
    warm() {
      void power.aiAllowed().then((decision) => decision.allowed ? model.warm() : undefined).catch(() => undefined);
    },
  };
  const guide: Engine['guide'] = {
    topics() {
      const counts = new Map<TopicGroup, number>();
      for (const passage of content.passages) {
        if (passage.phase.includes(context.phase)) counts.set(passage.topic, (counts.get(passage.topic) ?? 0) + 1);
      }
      return [...counts].map(([topic, count]) => ({ topic, count }));
    },
    byTopic(topic) {
      return content.passages.filter((p) => p.topic === topic && p.phase.includes(context.phase))
        .map(({ id, title, summary, topic: t, critical }) => ({ id, title, summary, topic: t, critical }));
    },
    passage(id) {
      const p = content.passages.find((item) => item.id === id);
      return p ? { id: p.id, title: p.title, summary: p.summary, topic: p.topic, critical: p.critical, text: p.text,
        source: sourceRef(p.source_id, p.locator), reviewedBy: p.reviewed_by, reviewedAt: p.reviewed_at,
        version: p.version }
        : null;
    },
    sources: refs,
    reviewers() {
      const counts = new Map<string, number>();
      for (const p of content.passages) counts.set(p.reviewed_by, (counts.get(p.reviewed_by) ?? 0) + 1);
      return [...counts].map(([name, passages]) => ({ name, passages }));
    },
  };
  // Swap in the PackManager's merged content after a successful apply.
  const applyPack = async (previewId: string) => {
    const result = await packs.apply(previewId).catch(() => err('io', 'Pack apply failed'));
    if (!result.ok) return result;
    const merged = packs.content();
    if (merged.ok) {
      content = merged.value;
      rawMap = packs.raw();
      index = createIndex(content.passages);
    }
    emit('packs');
    emit('updates');
    return result;
  };
  // Centers are a signed area pack (`centers-{province}`) of reviewed records, applied without a
  // prompt after a successful feed fetch (docs section 7). Only the province code is sent.
  let centersCheckedDay: string | null = null;
  const refreshCenters = async () => {
    const province = provincePsgc();
    const day = iso(now()).slice(0, 10);
    if (!updates || !province || centersCheckedDay === day) return;
    centersCheckedDay = day;
    const result = await updates.fetchCenters(province).catch(() => null);
    if (result?.ok && result.value !== 'unchanged') await applyPack(result.value.previewId);
  };
  // One feed fetch: cache a new feed, re-run decidePhase, emit `feed`. Never throws.
  const fetchFeedOnce = async (trigger: 'open' | 'pull'): Promise<Result<FeedState, FeedError>> => {
    if (!settings.feedEnabled) return err('disabled', 'Feed is disabled');
    if (!updates) return err('disabled', 'Online feed is not configured');
    lastFeedCheckAt = iso(now());
    refreshing = true;
    emit('feed');
    const result = await Promise.resolve().then(() => updates.fetchFeed({ trigger }))
      .catch(() => err('http', 'Feed request failed'));
    refreshing = false;
    if (!result.ok) {
      emit('feed');
      return result;
    }
    if (result.value !== 'unchanged') {
      save('feed', result.value);
    }
    emit('feed');
    decideCurrentPhase();
    await refreshCenters().catch(() => undefined);
    return ok(currentFeed());
  };
  const feed: Engine['feed'] = {
    get: currentFeed,
    refresh: () => fetchFeedOnce('pull'),
  };
  const plan: Engine['plan'] = {
    hotlines: () => content.hotlines.filter((hotline) => hotline.scope === 'national'),
    async call(hotlineIdOrPhone) {
      const byId = content.hotlines.find((hotline) => hotline.id === hotlineIdOrPhone);
      const number = cleanPhone(byId?.number ?? hotlineIdOrPhone);
      if ((!byId && !phoneRe.test(number)) || (byId && !/^\+?\d+$/.test(number))) {
        return err('not_found', 'Hotline not found');
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Linking } = require('react-native') as { Linking?: { openURL(url: string): Promise<unknown> } };
        if (!Linking?.openURL) return err('no_dialer', 'Dialer is unavailable');
        await Linking.openURL(`tel:${number}`);
        return ok(undefined);
      } catch {
        return err('no_dialer', 'Dialer is unavailable');
      }
    },
  };
  const settingsApi: Engine['settings'] = {
    get: () => ({ ...settings }),
    update(patch) {
      const settingKeys = ['language', 'lowBatteryThreshold', 'aiEnabled', 'lowBatteryMode',
        'staleWarningHours', 'feedEnabled', 'autoCheckUpdates', 'wifiOnly', 'topicReportsOptIn',
        'damageReportsOptIn'];
      if (Object.keys(patch).some((key) => !settingKeys.includes(key))) return err('out_of_range');
      if (patch.lowBatteryThreshold !== undefined
        && (typeof patch.lowBatteryThreshold !== 'number' || !Number.isFinite(patch.lowBatteryThreshold)
          || patch.lowBatteryThreshold < 5 || patch.lowBatteryThreshold > 50)) return err('out_of_range');
      if (patch.staleWarningHours !== undefined
        && (typeof patch.staleWarningHours !== 'number' || !Number.isFinite(patch.staleWarningHours)
          || patch.staleWarningHours < 1 || patch.staleWarningHours > 12)) return err('out_of_range');
      if (patch.language !== undefined && patch.language !== 'tl' && patch.language !== 'en') return err('out_of_range');
      for (const key of ['aiEnabled', 'lowBatteryMode', 'feedEnabled', 'autoCheckUpdates', 'wifiOnly',
        'topicReportsOptIn', 'damageReportsOptIn'] as const) {
        if (patch[key] !== undefined && typeof patch[key] !== 'boolean') return err('out_of_range');
      }
      settings = { ...settings, ...patch };
      save('settings', settings);
      if (patch.lowBatteryMode === true) ai = { allowed: false, reason: 'low_battery' };
      emit('settings');
      void powerUpdate();
      if (patch.feedEnabled !== undefined) emit('feed');
      return ok(settings);
    },
  };
  const accountState: AccountState = { signedIn: false };
  const engine: Engine = {
    async init() {
      try {
        const bundledRaw = overrides.content ? { ...rawContent, ...overrides.content } : rawContent;
        const raw = demo ? { ...bundledRaw, ...demoContent(bundledRaw, iso(now())) } : bundledRaw;
        const checked = validateContent(raw);
        if (!checked.ok) return err('content_invalid', checked.error.message);
        content = checked.value;
        rawMap = raw;
        index = createIndex(content.passages);
        // First launch of a demo build: seed the household, checklist ticks and feed once; edits persist.
        if (demo && !(store.get('profiles') ?? []).length) {
          const seed = demoStore(now());
          save('profiles', seed.profiles);
          save('activeProfileId', seed.activeProfileId);
          save('feed', seed.feed);
          save(keyFor(seed.activeProfileId), seed.checklist);
        }
        profiles = (store.get('profiles') ?? []).slice(0, 1);
        activeId = profiles[0]?.id ?? null;
        // A context saved by an older build may lack newer fields: fill them from a fresh context
        // instead of failing startup.
        const storedContext = store.get('context');
        const freshContext = emptyContext(iso(now()));
        context = storedContext && typeof storedContext === 'object'
          ? {
            ...freshContext,
            ...storedContext,
            suppressed: Array.isArray(storedContext.suppressed) ? storedContext.suppressed : [],
            warnings: storedContext.warnings ?? {},
          }
          : freshContext;
        history = (store.get('questionLog') ?? []).slice(-200);
        settings = { ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}) };
        const storedInitialFeed = storedFeed();
        lastFeedCheckAt = typeof storedInitialFeed?.checkedAt === 'string'
          ? storedInitialFeed.checkedAt : undefined;
        if (!save('profiles', profiles) || !save('activeProfileId', activeId)
          || !save('settings', settings) || !save('context', context)) {
          return err('storage_failed', 'Could not save local data');
        }
        const present = (model as typeof model & { present?: () => Promise<boolean> }).present;
        installedModel = present ? await present().catch(() => false) : model.state() !== 'absent';
        await powerService?.refresh().catch(() => undefined);
        await powerUpdate();
        decideCurrentPhase();
        // App open with the online stretch: one non-awaited feed fetch. No timer, retry or background work.
        if (online && settings.feedEnabled && updates) void fetchFeedOnce('open').catch(() => undefined);
        return ok(info());
      } catch (cause) {
        return err('storage_failed', cause instanceof Error ? cause.message : 'Could not load local data');
      }
    },
    info, status,
    copy: (key, opts) => copyText(key, opts),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    profiles: profilesApi, family, context: contextApi, checklist, ask, guide,
    emergency: { card: emergencyCard }, plan, feed,
    evacuation: {
      view() {
        try {
          const profile = active();
          const latest = currentFeed().latest;
          const storm = stormInput();
          const home = homePoint();
          // rankCenters owns the threshold check; with no home it ranks nothing (`centers: []`).
          const ranked = rankCenters(home ? evacuationCentersFrom(rawMap['evacuation_centers.json']) : [], home ?? FALLBACK_HOME, {
            bulletin: storm?.bulletin ?? null, storm: storm?.measure ?? null, rules: phaseRules(), limit: CENTERS_LIMIT,
          });
          return {
            ...(profile?.plan.evacuationCenter ? { householdCenter: profile.plan.evacuationCenter } : {}),
            bulletin: latest,
            storm: storm?.measure ?? null,
            centers: ranked.items,
            centersFirst: ranked.centersFirst,
            barangayCopyKey: 'barangay_decides' as const,
            needsLocation: !profile?.location,
          };
        } catch {
          return { bulletin: null, storm: null, centers: [], centersFirst: false,
            barangayCopyKey: 'barangay_decides' as const, needsLocation: !active()?.location };
        }
      },
    },
    account: {
      state: () => accountState,
      signUp: async () => err('demo_only'), signIn: async () => err('demo_only'),
      signOut: () => err('not_signed_in'), sendReset: async () => err('demo_only'),
      setSync: () => err('not_signed_in'),
    },
    model: {
      async download(onProgress, signal) {
        const result = await model.download(onProgress, signal).catch(() => err('io', 'Model download failed'));
        // The checks before the request (tier, space, file access) fail without touching the network;
        // anything else was a request to Hugging Face, so it goes in the on-screen network log.
        const requested = result.ok || !['tier', 'no_space', 'io'].includes(result.error.code);
        if (requested) {
          appendNetworkLog(store, BUNDLED_MODEL.url, result.ok ? 200 : 'error', result.ok ? result.value.bytes : 0, iso(now()));
          emit('updates');
        }
        if (!result.ok) return result;
        await markModelInstalled();
        return ok('installed');
      },
      async installFromPicker(onProgress, signal) {
        const picked = await filePicker.pick('model').catch(() => err('io', 'File picker failed'));
        if (!picked.ok) return picked;
        if (!picked.value) return ok(null);
        if (signal?.aborted) return err('cancelled');
        const result = await model
          .install(picked.value, onProgress, signal)
          .catch(() => err('io', 'Model installation failed'));
        if (!result.ok) return result;
        await markModelInstalled();
        return ok('installed');
      },
      async remove() {
        await model.remove().catch(() => undefined);
        installedModel = false;
        await powerUpdate();
        emit('status');
      },
    },
    screen: {
      sosOn: async () => { await screen.sosOn().catch(() => undefined); },
      sosOff: async () => { await screen.sosOff().catch(() => undefined); },
    },
    damage: {
      list: () => damageDrafts(),
      save(input) {
        if (!Number.isInteger(input.affectedMembers) || input.affectedMembers < 0
          || (input.notes?.length ?? 0) > 300) {
          return err('invalid');
        }
        const drafts = damageDrafts();
        const draft = { id: input.id ?? newId('damage'), createdAt: iso(now()), damageType: input.damageType,
          severity: input.severity, affectedMembers: input.affectedMembers,
          ...(input.notes ? { notes: input.notes } : {}),
          photoPaths: [], sentAt: null };
        const next = [draft, ...drafts.filter((item) => item.id !== draft.id)];
        if (!save('damageReports', next)) return err('io');
        emit('damage');
        return ok(draft);
      },
      async addPhoto(id, source) {
        const draft = damageDrafts().find((item) => item.id === id);
        if (!draft) return err('not_found');
        if (draft.photoPaths.length >= 5) return err('too_many_photos');
        if (!overrides.photos) return err(source === 'camera' ? 'no_camera' : 'unreadable');
        const picked = await overrides.photos
          .pick(source)
          .catch(() => err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo could not be opened'));
        if (!picked.ok) return picked;
        if (!picked.value) return ok(null);
        const savedPhoto = await overrides.photos
          .saveCrop(picked.value.uri, { x: 0, y: 0, width: 1, height: 1 }, `damage-${id}`)
          .catch(() => err('io', 'Photo could not be saved'));
        if (!savedPhoto.ok) return savedPhoto;
        draft.photoPaths.push(savedPhoto.value.uri);
        if (!save('damageReports', [draft, ...damageDrafts().filter((item) => item.id !== id)])) return err('io');
        emit('damage');
        return ok(draft);
      },
      removePhoto(id, photoIndex) {
        const drafts = damageDrafts();
        const draft = drafts.find((item) => item.id === id);
        if (!draft || !draft.photoPaths[photoIndex]) return err('not_found');
        const [removed] = draft.photoPaths.splice(photoIndex, 1);
        if (removed) void overrides.photos?.remove(removed).catch(() => undefined);
        save('damageReports', drafts);
        emit('damage');
        return ok(draft);
      },
      async send(id) {
        if (!settings.damageReportsOptIn) return err('not_opted_in');
        return damageDrafts().some((item) => item.id === id) ? err('offline') : err('not_found');
      },
      remove(id) {
        const drafts = damageDrafts();
        const removed = drafts.find((item) => item.id === id);
        for (const path of removed?.photoPaths ?? []) void overrides.photos?.remove(path).catch(() => undefined);
        save('damageReports', drafts.filter((item) => item.id !== id));
        emit('damage');
      },
    },
    settings: settingsApi, history: historyApi,
    evaluation: { summary: (): EvalSummary | null => {
      const summaryP50Ms = p50(history.filter((entry) => entry.outcome === 'answered_summary')
        .map((entry) => entry.timings.totalMs));
      const firstWordsP50Ms = p50(history.flatMap((entry) => entry.timings.firstTokenMs === undefined
        ? [] : [entry.timings.firstTokenMs]));
      const fullAnswerP50Ms = p50(history.filter((entry) => entry.outcome === 'answered_ai')
        .map((entry) => entry.timings.totalMs));
      return { ...BUNDLED_EVAL, device: {
        ...(summaryP50Ms !== undefined ? { summaryP50Ms } : {}),
        ...(firstWordsP50Ms !== undefined ? { firstWordsP50Ms } : {}),
        ...(fullAnswerP50Ms !== undefined ? { fullAnswerP50Ms } : {}),
      } };
    } },
    packs: {
      installed: () => packs.installed(),
      async importFromPicker() {
        const picked = await filePicker.pick('pack').catch(() => err('io', 'File picker failed'));
        if (!picked.ok) return err('bad_archive');
        return picked.value ? packs.importFile(picked.value.uri).catch(() => err('bad_archive')) : ok(null);
      },
      importFile: (uri) => packs.importFile(uri).catch(() => err('bad_archive')),
      apply: (id) => applyPack(id),
      async rollback(id) {
        const result = await packs.rollback(id).catch(() => err('io', 'Pack rollback failed'));
        if (result.ok) emit('packs');
        return result;
      },
    },
    updates: {
      pending: () => null,
      async check() {
        return updates
          ? updates.check({ trigger: 'user' }).catch(() => err('http'))
          : err('disabled');
      },
      async download(planId, onProgress, signal) {
        if (!updates) return err('disabled');
        const result = await updates.check({ trigger: 'user' }).catch(() => err('http'));
        if (!result.ok) return result;
        if (!result.value || result.value.planId !== planId) return err('disabled');
        return updates.download(result.value, onProgress, signal).catch(() => err('http'));
      },
      networkLog: () => { try { return store.get('networkLog') ?? []; } catch { return []; } },
    },
  };
  return engine;
}
