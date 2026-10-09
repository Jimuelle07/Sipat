import type {
  AccountState, AiDecision, AnswerEvent, AskOptions, ChecklistTick, ChecklistView, Context, Engine,
  EngineChange, EngineOverrides, EngineInfo, EngineStatus, EvalSummary, FaceBox, Member, MemberPhoto,
  FaceDetection, PhotoDraft, PhotoError, Phase, PhaseInputKey, PickedPhoto, Profile, Result,
  SaveMemberResult, SaveProfileResult, Settings, Store, StoreSchema,
  WarningInput, WarningKind, TopicGroup,
} from '../types/index.ts';
import type { Place } from '../types/content.ts';
import { ENGINE_API_VERSION } from '../types/engine.ts';
import { bundledContent, rawContent } from '../content/index.ts';
import { buildChecklist } from '../core/checklist.ts';
import { deriveHousehold } from '../core/deriveHousehold.ts';
import { decidePhase } from '../core/decidePhase.ts';
import { createIndex } from '../core/search.ts';
import { toManilaIso } from '../core/time.ts';
import { validateContent } from '../core/validateContent.ts';
import { createPowerPolicy, type PowerPolicyService } from '../services/power.ts';
import { createModelManager, defaultLlamaBackend } from '../services/model.ts';
import { createPackManager } from '../services/packs.ts';
import { createStore } from '../services/store.ts';
import { runAskPipeline } from './askPipeline.ts';
import { copyText } from './copy.ts';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval.ts';

const DEFAULT_SETTINGS: Settings = {
  language: 'tl', lowBatteryThreshold: 15, aiEnabled: true, lowBatteryMode: false,
  staleWarningHours: 3, feedEnabled: true, autoCheckUpdates: true, wifiOnly: true,
  topicReportsOptIn: false, damageReportsOptIn: false,
};
const MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E extends string>(code: E, message: string = code): Result<never, E> => ({
  ok: false,
  error: { code, message },
});
const iso = (date: Date) => toManilaIso(date);
const keyFor = (id: string) => `checklist:${id}` as `checklist:${string}`;
const phoneRe = /^\+?\d{7,15}$/;
const cleanPhone = (value: string) => value.replace(/[\s()\-]/g, '');

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

function warningInputKeys(warnings: Context['warnings']): PhaseInputKey[] {
  const keys: PhaseInputKey[] = [];
  if (warnings.tcws) keys.push(`warning:tcws-${warnings.tcws.level}`);
  if (warnings.rainfall) keys.push(`warning:rainfall-${warnings.rainfall.level}`);
  if (warnings.surge) keys.push(`warning:surge-${warnings.surge.level}`);
  if (warnings.gale) keys.push('warning:gale');
  if (warnings.barangay_order) keys.push('warning:barangay-order');
  return keys;
}

export function createEngine(overrides: EngineOverrides = {}): Engine {
  const store: Store = overrides.store ?? createStore();
  const now = overrides.now ?? (() => new Date());
  let content = bundledContent;
  let index = createIndex(content.passages);
  let profiles: Profile[] = [];
  let activeId: string | null = null;
  let context = emptyContext(iso(now()));
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let history: StoreSchema['questionLog'] = [];
  let feedCache = store.get('feed');
  let installedModel = false;
  let cachedTier: EngineStatus['tier'] = 'none';
  let battery: EngineStatus['battery'] = null;
  let ai: AiDecision = { allowed: false, reason: 'no_model' };
  let activeController: AbortController | null = null;
  let idSeq = 0;
  const listeners = new Set<(change: EngineChange) => void>();
  const emit = (change: EngineChange) => { for (const listener of [...listeners]) listener(change); };
  const newId = (kind: string) => `${kind}-${now().getTime()}-${++idSeq}`;
  const active = () => profiles.find((profile) => profile.id === activeId) ?? null;
  const phaseRules = () => {
    const raw = overrides.content?.['phase_rules.json'] as { rules?: ReturnType<typeof fallbackRules> } | undefined;
    return raw?.rules ?? fallbackRules();
  };
  const currentFeed = () => {
    if (!settings.feedEnabled || !overrides.updates) {
      return { status: 'off' as const, refreshing: false, latest: null, serverStale: false };
    }
    const bulletin = feedCache?.bulletins[0];
    if (!bulletin) {
      return {
        status: 'empty' as const,
        refreshing: false,
        latest: null,
        ...(feedCache ? { fetchedAt: feedCache.fetchedAt, checkedAt: feedCache.checkedAt } : {}),
        serverStale: feedCache?.serverStale ?? false,
      };
    }
    const nowMs = now().getTime();
    const issuedHoursAgo = Math.max(0, Math.floor((nowMs - Date.parse(bulletin.issuedAt)) / 3_600_000));
    const fetchedHoursAgo = Math.max(0, Math.floor((nowMs - Date.parse(bulletin.fetchedAt)) / 3_600_000));
    const stale = feedCache?.serverStale === true || issuedHoursAgo >= settings.staleWarningHours;
    return {
      status: stale ? 'stale' as const : 'fresh' as const, refreshing: false,
      latest: { bulletin, issuedHoursAgo, fetchedHoursAgo, stale,
        ageText: copyText('bulletin_age', { vars: { issuedAt: bulletin.issuedAt, fetchedAt: bulletin.fetchedAt } }) },
      ...(feedCache ? { fetchedAt: feedCache.fetchedAt, checkedAt: feedCache.checkedAt } : {}),
      serverStale: feedCache?.serverStale ?? false,
    };
  };
  const powerService: PowerPolicyService | null = overrides.power ? null : createPowerPolicy({
    getSettings: () => settings,
    modelPresent: () => installedModel,
  });
  const power = overrides.power ?? powerService!;
  const model = overrides.model ?? createModelManager({
    backend: defaultLlamaBackend(),
    readTier: async () => powerService?.tier() ?? 'none',
  });
  const packs = createPackManager({ store, now: () => iso(now()) });
  const powerUpdate = async () => {
    cachedTier = powerService
      ? await powerService.tier().catch(() => 'none')
      : await model.tier().catch(() => 'none');
    battery = powerService?.battery() ?? null;
    ai = await power.aiAllowed().catch(() => ({ allowed: false, reason: 'no_model' as const }));
    emit('status');
  };
  power.onChange((decision) => {
    ai = decision;
    battery = powerService?.battery() ?? null;
    emit('status');
  });
  model.onStateChange(() => emit('status'));

  const save = <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => store.set(key, value);
  const applyDecision = (next: Context) => {
    const changedPhase = next.phase !== context.phase;
    context = next;
    save('context', context);
    emit('context');
    emit('checklist');
    emit('status');
    if (changedPhase) emit('phase');
  };
  const getPlaces = (): Place[] =>
    (overrides.content?.['places.json'] as { items?: Place[] } | undefined)?.items ?? content.places?.items ?? [];
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
  const checklistView = (): ChecklistView => {
    const profile = active();
    if (!profile) return { phase: context.phase, warningCards: [], groups: [], progress: { done: 0, total: 0 } };
    return buildChecklist(profile, context, content.checklist, content.warnings, store.get(keyFor(profile.id)) ?? {},
      now(), settings.staleWarningHours);
  };
  const info = (): EngineInfo => {
    const guideDate = content.passages.reduce(
      (date, passage) => passage.reviewed_at > date ? passage.reviewed_at : date,
      '',
    );
    return { appVersion: '0.0.0', engineApiVersion: ENGINE_API_VERSION, guideDate,
      passagesCount: content.passages.length, sourcesCount: content.sources.length, packs: packs.installed(),
      online: false, model: { fileName: MODEL_FILE, sizeBytes: 0, present: installedModel,
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
      const next = {
        ...context, phase, phaseSource: 'manual' as const, reason: { source: 'manual' as const, text: '' },
        changedAt: iso(now()), recommended: null, warnings: phase === 'after' ? {} : context.warnings,
        undo: { phase: before.phase, phaseSource: before.phaseSource, reason: before.reason,
          warnings: before.warnings },
        suppressed: [...new Set([...context.suppressed, ...warningInputKeys(context.warnings)])],
      };
      context = next;
      save('context', next);
      emit('context');
      emit('checklist');
      emit('status');
      emit('phase');
      return next;
    },
    undoPhase: () => {
      if (!context.undo) return err('nothing_to_undo', 'Nothing to undo');
      const undo = context.undo;
      const { undo: _undo, ...prior } = context;
      void _undo;
      const next = { ...prior, phase: undo.phase, phaseSource: undo.phaseSource, reason: undo.reason,
        warnings: undo.warnings, changedAt: iso(now()), recommended: null };
      context = next;
      save('context', next);
      emit('context');
      emit('checklist');
      emit('status');
      emit('phase');
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
      const decision = decidePhase({ context: candidate, rules: phaseRules(), now: iso(now()) });
      context = { ...decision.state, warnings };
      save('context', context);
      emit('context');
      emit('checklist');
      emit('status');
      if (decision.switched) emit('phase');
      return context;
    },
    clearWarning: (kind: WarningKind) => {
      const warnings = { ...context.warnings };
      delete warnings[kind];
      const prefix = `warning:${kind === 'barangay_order' ? 'barangay-order' : kind}`;
      context = { ...context, warnings, suppressed: context.suppressed.filter((key) => !key.startsWith(prefix)) };
      save('context', context);
      emit('context');
      emit('checklist');
      emit('status');
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
      const profile = active();
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
        if (member.photo) void overrides.photos?.remove(member.photo.uri).catch(() => undefined);
      }
      profiles = [];
      activeId = null;
      save('profiles', profiles);
      save('activeProfileId', null);
      store.delete(keyFor(id));
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
      if (!overrides.photos) {
        return err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo service is unavailable');
      }
      let picked: Result<PickedPhoto | null, PhotoError>;
      try {
        picked = await overrides.photos.pick(source);
      } catch {
        return err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo could not be opened');
      }
      if (!picked.ok) return err(picked.error.code, picked.error.message);
      if (!picked.value) return ok(null);
      let detected: { detection: FaceDetection; faces: FaceBox[] };
      try {
        detected = await overrides.photos.detect(picked.value.uri);
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
        return err('draft_expired', 'Photo draft expired');
      }
      const member = active()?.people.find((person) => person.id === draft.memberId);
      if (!member || !overrides.photos) return err('io', 'Photo service unavailable');
      const savedPhoto = await overrides.photos
        .saveCrop(draft.previewUri, crop, member.id)
        .catch(() => err('io', 'Photo could not be saved'));
      if (!savedPhoto.ok) return savedPhoto;
      const photo: MemberPhoto = { ...savedPhoto.value, source: photoSources.get(draftId) ?? 'gallery',
        faceCheck: draft.detection === 'one_face' ? 'one_face' : 'manual', takenAt: iso(now()), version: 1 };
      member.photo = photo;
      member.photoStatus = 'done';
      member.updatedAt = iso(now());
      photoDrafts.delete(draftId);
      photoSources.delete(draftId);
      save('profiles', profiles);
      emit('family');
      emit('checklist');
      return ok(photo);
    },
    discard(draftId) {
      photoDrafts.delete(draftId);
      photoSources.delete(draftId);
    },
    remove(memberId) {
      const member = active()?.people.find((person) => person.id === memberId);
      if (!member) return err('not_found', 'Member not found');
      if (member.photo) void overrides.photos?.remove(member.photo.uri).catch(() => undefined);
      delete member.photo;
      member.photoStatus = 'pending';
      save('profiles', profiles);
      emit('family');
      return ok(undefined);
    },
    removeAll() {
      for (const profile of profiles) {
        for (const member of profile.people) {
          if (member.photo) void overrides.photos?.remove(member.photo.uri).catch(() => undefined);
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
      const profile = active();
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
      const profile = active();
      const member = profile?.people.find((person) => person.id === memberId);
      if (!profile || !member) return err('not_found', 'Member not found');
      if (memberId === profile.ownerId) return err('owner_required', 'Cannot remove owner');
      if (member.photo) void overrides.photos?.remove(member.photo.uri).catch(() => undefined);
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
        return getPlaces()
          .filter((place) => place.parent === (parentPsgc ?? null))
          .map((place) => ({ psgc: place.psgc, name: place.name, level: place.level,
            hasChildren: getPlaces().some((child) => child.parent === place.psgc) }));
      },
      setArea(psgc) {
        const place = getPlaces().find((item) => item.psgc === psgc && item.level === 'barangay');
        if (!place) return err('unknown_place', 'Unknown place');
        const profile = active();
        if (!profile) return err('unknown_place', 'No household');
        profile.location = { psgc };
        profile.updatedAt = iso(now());
        save('profiles', profiles);
        emit('profiles');
        return ok(profile.location);
      },
      async useGps() {
        if (!overrides.location) return err('unavailable', 'Location is unavailable');
        const result = await overrides.location.readOnce().catch(() => err('unavailable', 'Location unavailable'));
        if (!result.ok) return result;
        return err('unavailable', 'GPS-to-area matching is unavailable without place coordinates');
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
      if (!overrides.share) return err('failed', 'Share service unavailable');
      return overrides.share.shareMemberCard(cardView).catch(() => err('failed', 'Share failed'));
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
      const ticks = store.get(key) ?? {};
      ticks[itemId] = { ticked, updatedAt: iso(now()) } satisfies ChecklistTick;
      store.set(key, ticks);
      emit('checklist');
      return ok(checklistView());
    },
    reset() {
      const profile = active();
      if (profile) store.delete(keyFor(profile.id));
      emit('checklist');
      return checklistView();
    },
  };
  const historyApi: Engine['history'] = {
    list: (limit = 200) => [...history].reverse().slice(0, limit),
    clear() {
      history = [];
      store.delete('questionLog');
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
        evacuationCenters: () => [], latestBulletin: () => currentFeed().latest,
        now: () => now().getTime(), newId: () => newId('question'),
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
  const feed: Engine['feed'] = {
    get: currentFeed,
    async refresh() {
      if (!settings.feedEnabled) return err('disabled', 'Feed is disabled');
      if (!overrides.updates) return err('disabled', 'Online feed is not configured');
      const result = await overrides.updates
        .fetchFeed({ trigger: 'pull' })
        .catch(() => err('http', 'Feed request failed'));
      if (!result.ok) return result;
      if (result.value !== 'unchanged') {
        feedCache = result.value;
        save('feed', feedCache);
      }
      emit('feed');
      return ok(currentFeed());
    },
  };
  const plan: Engine['plan'] = {
    hotlines: () => content.hotlines.filter((hotline) => hotline.scope === 'national'),
    async call(hotlineIdOrPhone) {
      const byId = content.hotlines.find((hotline) => hotline.id === hotlineIdOrPhone);
      const isPhone = phoneRe.test(cleanPhone(hotlineIdOrPhone));
      if (!byId && !isPhone) return err('not_found', 'Hotline not found');
      return err('no_dialer', 'Dialer is unavailable');
    },
  };
  const settingsApi: Engine['settings'] = {
    get: () => ({ ...settings }),
    update(patch) {
      if (patch.lowBatteryThreshold !== undefined
        && (!Number.isFinite(patch.lowBatteryThreshold)
          || patch.lowBatteryThreshold < 5
          || patch.lowBatteryThreshold > 50)) {
        return err('out_of_range');
      }
      if (patch.staleWarningHours !== undefined
        && (!Number.isFinite(patch.staleWarningHours)
          || patch.staleWarningHours < 1
          || patch.staleWarningHours > 12)) {
        return err('out_of_range');
      }
      settings = { ...settings, ...patch };
      save('settings', settings);
      void powerUpdate();
      emit('settings');
      return ok(settings);
    },
  };
  const accountState: AccountState = { signedIn: false };
  const engine: Engine = {
    async init() {
      try {
        const checked = validateContent(overrides.content ? { ...rawContent, ...overrides.content } : rawContent);
        if (!checked.ok) return err('content_invalid', checked.error.message);
        content = checked.value;
        index = createIndex(content.passages);
        profiles = (store.get('profiles') ?? []).slice(0, 1);
        activeId = profiles[0]?.id ?? null;
        const storedContext = store.get('context');
        context = storedContext
          ? { ...storedContext, warnings: storedContext.warnings ?? {} }
          : emptyContext(iso(now()));
        history = (store.get('questionLog') ?? []).slice(-200);
        settings = { ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}) };
        feedCache = store.get('feed');
        save('profiles', profiles);
        save('activeProfileId', activeId);
        save('settings', settings);
        save('context', context);
        const present = (model as typeof model & { present?: () => Promise<boolean> }).present;
        installedModel = present ? await present().catch(() => false) : model.state() !== 'absent';
        await powerService?.refresh().catch(() => undefined);
        await powerUpdate();
        const phase = decidePhase({ context, rules: phaseRules(), now: iso(now()) });
        applyDecision({ ...phase.state, warnings: context.warnings });
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
        const profile = active();
        const latest = currentFeed().latest;
        return {
          ...(profile?.plan.evacuationCenter ? { householdCenter: profile.plan.evacuationCenter } : {}),
          bulletin: latest,
          storm: null, centers: [], centersFirst: false, barangayCopyKey: 'barangay_decides' as const,
          needsLocation: !profile?.location,
        };
      },
    },
    account: {
      state: () => accountState,
      signUp: async () => err('demo_only'), signIn: async () => err('demo_only'),
      signOut: () => err('not_signed_in'), sendReset: async () => err('demo_only'),
      setSync: () => err('not_signed_in'),
    },
    model: {
      async installFromPicker(onProgress, signal) {
        if (!overrides.files) return err('io', 'File picker is unavailable');
        const picked = await overrides.files.pick('model').catch(() => err('io', 'File picker failed'));
        if (!picked.ok) return picked;
        if (!picked.value) return ok(null);
        if (signal?.aborted) return err('cancelled');
        const result = await model
          .install(picked.value, onProgress, signal)
          .catch(() => err('io', 'Model installation failed'));
        if (!result.ok) return result;
        installedModel = true;
        await powerUpdate();
        emit('status');
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
      sosOn: async () => { await overrides.screen?.sosOn().catch(() => undefined); },
      sosOff: async () => { await overrides.screen?.sosOff().catch(() => undefined); },
    },
    damage: {
      list: () => store.get('damageReports') ?? [],
      save(input) {
        if (!Number.isInteger(input.affectedMembers) || input.affectedMembers < 0
          || (input.notes?.length ?? 0) > 300) {
          return err('invalid');
        }
        const drafts = store.get('damageReports') ?? [];
        const draft = { id: input.id ?? newId('damage'), createdAt: iso(now()), damageType: input.damageType,
          severity: input.severity, affectedMembers: input.affectedMembers,
          ...(input.notes ? { notes: input.notes } : {}),
          photoPaths: [], sentAt: null };
        const next = [draft, ...drafts.filter((item) => item.id !== draft.id)];
        save('damageReports', next);
        emit('damage');
        return ok(draft);
      },
      async addPhoto(id, source) {
        const draft = (store.get('damageReports') ?? []).find((item) => item.id === id);
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
        save('damageReports', [draft, ...(store.get('damageReports') ?? []).filter((item) => item.id !== id)]);
        emit('damage');
        return ok(draft);
      },
      removePhoto(id, photoIndex) {
        const drafts = store.get('damageReports') ?? [];
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
        return (store.get('damageReports') ?? []).some((item) => item.id === id) ? err('offline') : err('not_found');
      },
      remove(id) {
        const drafts = store.get('damageReports') ?? [];
        const removed = drafts.find((item) => item.id === id);
        for (const path of removed?.photoPaths ?? []) void overrides.photos?.remove(path).catch(() => undefined);
        save('damageReports', drafts.filter((item) => item.id !== id));
        emit('damage');
      },
    },
    settings: settingsApi, history: historyApi,
    evaluation: { summary: (): EvalSummary | null => EVAL_SUMMARY_FIXTURE },
    packs: {
      installed: () => packs.installed(),
      async importFromPicker() {
        if (!overrides.files) return err('bad_archive');
        const picked = await overrides.files.pick('pack').catch(() => err('io', 'File picker failed'));
        if (!picked.ok) return err('bad_archive');
        return picked.value ? packs.importFile(picked.value.uri).catch(() => err('bad_archive')) : ok(null);
      },
      importFile: (uri) => packs.importFile(uri).catch(() => err('bad_archive')),
      async apply(id) {
        const result = await packs.apply(id).catch(() => err('io', 'Pack apply failed'));
        if (result.ok) {
          emit('packs');
          emit('updates');
        }
        return result;
      },
      async rollback(id) {
        const result = await packs.rollback(id).catch(() => err('io', 'Pack rollback failed'));
        if (result.ok) emit('packs');
        return result;
      },
    },
    updates: {
      pending: () => null,
      async check() {
        return overrides.updates
          ? overrides.updates.check({ trigger: 'user' }).catch(() => err('http'))
          : err('disabled');
      },
      async download(planId, onProgress, signal) {
        if (!overrides.updates) return err('disabled');
        const result = await overrides.updates.check({ trigger: 'user' }).catch(() => err('http'));
        if (!result.ok) return result;
        if (!result.value || result.value.planId !== planId) return err('disabled');
        return overrides.updates.download(result.value, onProgress, signal).catch(() => err('http'));
      },
      networkLog: () => store.get('networkLog') ?? [],
    },
  };
  return engine;
}
