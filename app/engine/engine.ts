import type {
  AgeGroup, AiDecision, AnswerEvent, ApplyResult, AskOptions, ChecklistTick, ChecklistView, ColorLevel,
  BundledContent, Context, CopyKey, DeviceTier, Engine, EngineChange, EngineInfo, EngineStatus, EvalSummary,
  GuideIndex, Hotline, Member, MemberCardView, MemberInput, ModelManager, NewHouseholdInput,
  PackError, PackManager, Phase, PhotosApi, Profile, ProfileErrorCode, ProfileInput, QuestionLogEntry, Result,
  RollCallView, SaveMemberResult, SaveProfileResult, Settings, SourceRef, Store, TextKind, TopicGroup,
  UpdateError, WarningInput, WarningKind,
} from '../types';
import { ENGINE_API_VERSION } from '../types';
import type { PowerPolicy, StoreSchema } from '../types/services.ts';
import { buildChecklist } from '../core/checklist';
import { deriveHousehold, memberTags } from '../core/deriveHousehold';
import { createIndex } from '../core/search';
import { toManilaIso } from '../core/time';
import { validateContent } from '../core/validateContent';
import { createModelManager, defaultLlamaBackend } from '../services/model';
import { createPackManager } from '../services/packs';
import { createStore } from '../services/store';
import { rawContent } from '../content';
import { runAskPipeline } from './askPipeline';
import { COPY, COPY_EN } from './copy';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval';
import { exportChecklistText, exportHouseholdSms } from './exportText';

const DEFAULT_SETTINGS: Settings = {
  language: 'tl', lowBatteryThreshold: 15, aiEnabled: true, staleWarningHours: 3, autoCheckUpdates: true,
  wifiOnly: true, topicReportsOptIn: false, damageReportsOptIn: false,
};
const MODEL_FILE = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E extends string>(code: E, message: string): Result<never, E> => ({ ok: false, error: { code, message } });
const profileErr = (code: ProfileErrorCode | 'name_required' | 'too_long', field: string) => ({ code, field });
const phoneRe = /^\+?\d{7,15}$/;
const cleanPhone = (raw: string) => raw.replace(/[\s()\-]/g, '');

type Battery = { level: number; charging: boolean; saver: boolean };
type PowerWithStatus = PowerPolicy & { tier(): Promise<DeviceTier>; battery(): Battery | null; refresh(): Promise<void> };
export interface EngineDeps {
  store?: Store;
  power?: PowerWithStatus | PowerPolicy;
  model?: ModelManager;
  packs?: PackManager & { content(): BundledContent };
  now?: () => Date;
}
export interface EngineExtras {
  exports: {
    householdSms(kind: TextKind, opts?: { where?: string }): string;
    checklistText(): string;
  };
}
export type RealEngine = Engine & EngineExtras;

function makeDefaultPower(settings: () => Settings, modelPresent: () => Promise<boolean>): PowerWithStatus {
  let battery: Battery | null = null;
  let tier: DeviceTier = 'none';
  const listeners = new Set<(decision: AiDecision) => void>();
  let lastDecision: AiDecision = { allowed: false, reason: 'no_model' };
  const readDevice = async (): Promise<void> => {
    try {
      // Native dependencies are optional in Node and are intentionally loaded only on demand.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const device = require('expo-device') as { totalMemory?: number | null };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('expo-file-system/legacy') as { getFreeDiskStorageAsync?: () => Promise<number> };
      const ram = Number(device.totalMemory ?? 0);
      const free = await fs.getFreeDiskStorageAsync?.().catch(() => 0) ?? 0;
      tier = ram >= 3.5 * 1024 ** 3 && free >= 1.5 * 1024 ** 3 ? 'full' : ram >= 2.5 * 1024 ** 3 ? 'lite' : 'none';
    } catch { tier = 'none'; }
  };
  const refresh = async (): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const batteryModule = require('expo-battery') as {
        getBatteryLevelAsync?: () => Promise<number>;
        getBatteryStateAsync?: () => Promise<number>;
        isLowPowerModeEnabledAsync?: () => Promise<boolean>;
        BatteryState?: { CHARGING?: number; FULL?: number };
      };
      const [level, state, saver] = await Promise.all([
        batteryModule.getBatteryLevelAsync?.(), batteryModule.getBatteryStateAsync?.(),
        batteryModule.isLowPowerModeEnabledAsync?.(),
      ]);
      if (level !== undefined && state !== undefined && saver !== undefined) {
        battery = {
          level: Math.max(0, Math.min(100, Math.round(level * 100))),
          charging: state === batteryModule.BatteryState?.CHARGING || state === batteryModule.BatteryState?.FULL,
          saver,
        };
      }
    } catch { battery = null; }
  };
  const aiAllowed = async (): Promise<AiDecision> => {
    await Promise.all([readDevice(), refresh()]);
    const s = settings();
    let decision: AiDecision;
    if (!s.aiEnabled) decision = { allowed: false, reason: 'ai_off' };
    else if (!(await modelPresent().catch(() => false))) decision = { allowed: false, reason: 'no_model' };
    else if (tier === 'none') decision = { allowed: false, reason: 'tier' };
    else if (battery?.saver) decision = { allowed: false, reason: 'battery_saver' };
    else if (battery && battery.level < s.lowBatteryThreshold && !battery.charging) decision = { allowed: false, reason: 'low_battery' };
    else decision = { allowed: true };
    if (JSON.stringify(decision) !== JSON.stringify(lastDecision)) {
      lastDecision = decision;
      listeners.forEach((listener) => listener(decision));
    }
    return decision;
  };
  return {
    aiAllowed,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    tier: async () => { await readDevice(); return tier; },
    battery: () => battery && { ...battery },
    refresh: async () => { await Promise.all([readDevice(), refresh()]); },
  };
}

function validMember(input: MemberInput, prefix = 'member'): { code: string; field: string }[] {
  const errors: { code: string; field: string }[] = [];
  const name = input.name.trim();
  if (!name) errors.push({ code: 'name_required', field: `${prefix}.name` });
  else if (name.length > 40) errors.push({ code: 'too_long', field: `${prefix}.name` });
  if (input.note !== undefined && input.note.length > 80) errors.push({ code: 'too_long', field: `${prefix}.note` });
  if (input.phone !== undefined && input.phone.trim() && !phoneRe.test(cleanPhone(input.phone))) errors.push({ code: 'phone_invalid', field: `${prefix}.phone` });
  return errors;
}

export function createEngine(deps: EngineDeps = {}): RealEngine {
  const store = deps.store ?? createStore();
  const now = deps.now ?? (() => new Date());
  const model = deps.model ?? createModelManager({ backend: defaultLlamaBackend(), readTier: async () => power.tier() });
  const packs = deps.packs ?? createPackManager({ store, now: () => toManilaIso(now()) });
  let content = packs.content();
  let index: GuideIndex = createIndex(content.passages);
  let profiles: Profile[] = [];
  let activeProfileId: string | null = null;
  let context: Context = { phase: 'before', warnings: {} };
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let history: QuestionLogEntry[] = [];
  let present = false;
  let cachedTier: DeviceTier = 'none';
  let battery: Battery | null = null;
  const listeners = new Set<(change: EngineChange) => void>();
  let aiDecision: AiDecision = { allowed: false, reason: 'no_model' };
  let idCounter = 0;
  let activeController: AbortController | null = null;
  const keyFor = (profileId: string) => `checklist:${profileId}` as `checklist:${string}`;
  const emit = (change: EngineChange) => listeners.forEach((listener) => listener(change));
  const save = <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => store.set(key, value);
  const active = (id = activeProfileId): Profile | null => profiles.find((p) => p.id === id) ?? null;
  const newId = (prefix: string) => `${prefix}-${now().getTime()}-${++idCounter}`;
  const sources = () => content.sources;
  const sourceRef = (sourceId: string, locator?: string): SourceRef => {
    const source = content.sources.find((item) => item.id === sourceId);
    return { sourceId, agency: source?.agency ?? '', title: source?.title ?? '', date: source?.date ?? '', url: source?.url ?? '', ...(locator ? { locator } : {}) };
  };
  const emergencyCard = (id?: string) => {
    const rules = content.rules;
    const card = rules.emergency_cards.find((item) => item.id === (id ?? rules.emergency.card_id)) ?? rules.emergency_cards[0];
    return card ? {
      id: card.id, title: card.title, steps: [...card.steps],
      hotlines: card.hotline_ids.map((hid) => content.hotlines.find((h) => h.id === hid)).filter((h): h is Hotline => !!h),
      source: sourceRef(card.source_id),
    } : { id: 'emergency-default', title: '', steps: [], hotlines: [], source: sourceRef('') };
  };
  const power: PowerWithStatus = deps.power && 'tier' in deps.power && 'battery' in deps.power
    ? deps.power as PowerWithStatus
    : deps.power
      ? Object.assign(deps.power, { tier: async () => cachedTier, battery: () => battery, refresh: async () => undefined })
      : makeDefaultPower(() => settings, async () => model.state() !== 'absent' && await ((model as ModelManager & { present?: () => Promise<boolean> }).present?.() ?? false));
  power.onChange((decision) => { aiDecision = decision; battery = power.battery(); emit('status'); });
  model.onStateChange(() => emit('status'));
  const currentBattery = () => power.battery();
  const contexts = {
    get: () => context,
    options: () => content.warnings,
    setPhase: (phase: Phase) => {
      context = { ...context, phase, warnings: phase === 'after' ? {} : context.warnings };
      save('context', context); emit('context'); emit('checklist'); emit('status'); return context;
    },
    setWarning: (input: WarningInput) => {
      const setAt = toManilaIso(now());
      const warnings = { ...context.warnings };
      if (input.kind === 'gale') warnings.gale = { setAt };
      else if (input.kind === 'tcws') warnings.tcws = { level: input.level, setAt };
      else warnings[input.kind] = { level: input.level, setAt };
      context = { ...context, warnings }; save('context', context); emit('context'); emit('checklist'); emit('status'); return context;
    },
    clearWarning: (kind: WarningKind) => {
      const warnings = { ...context.warnings }; delete warnings[kind];
      context = { ...context, warnings }; save('context', context); emit('context'); emit('checklist'); emit('status'); return context;
    },
    reconfirmWarning: (kind: WarningKind) => {
      const current = context.warnings[kind];
      if (current) context = { ...context, warnings: { ...context.warnings, [kind]: { ...current, setAt: toManilaIso(now()) } } };
      save('context', context); emit('context'); emit('checklist'); emit('status'); return context;
    },
  };
  const checklistView = (profile = active()): ChecklistView => buildChecklist(
    profile ?? { id: '', name: '', ownerId: '', people: [], petsCount: 0, headcount: 0, members: [], home: [], livelihood: [], plan: { contacts: [] }, updatedAt: '' },
    context, content.checklist, content.warnings, profile ? store.get(keyFor(profile.id)) ?? {} : {}, now(), settings.staleWarningHours,
  );

  const info = (): EngineInfo => {
    const guideDate = content.passages.reduce((date, p) => p.reviewed_at > date ? p.reviewed_at : date, '');
    return { appVersion: '0.0.0', engineApiVersion: ENGINE_API_VERSION, guideDate, passagesCount: content.passages.length,
      sourcesCount: content.sources.length, packs: packs.installed(),
      model: { fileName: MODEL_FILE, sizeBytes: 0, present, attribution: 'Built with Llama' } };
  };
  const status = (): EngineStatus => {
    const checklist = checklistView();
    const result: EngineStatus = {
      tier: cachedTier, model: model.state(), ai: aiDecision, battery: currentBattery(),
    };
    if (checklist.stale) result.stale = { kind: checklist.stale.kind, hoursSinceSet: checklist.stale.hoursSinceSet };
    return result;
  };

  const profilesApi: Engine['profiles'] = {
    list: () => profiles,
    active: () => active(),
    create: (input: NewHouseholdInput): SaveProfileResult => {
      const errors = validMember(input.owner, 'owner');
      const name = input.name.trim();
      if (!name) errors.push({ code: 'name_required', field: 'name' }); else if (name.length > 60) errors.push({ code: 'too_long', field: 'name' });
      if (errors.length) return { ok: false, errors: errors as SaveProfileResult extends {ok:false; errors: infer E} ? E : never };
      const owner: Member = { id: newId('member'), name: input.owner.name.trim(), relation: 'self', ageGroup: input.owner.ageGroup,
        needs: [...input.owner.needs], updatedAt: toManilaIso(now()), ...(input.owner.phone ? { phone: input.owner.phone } : {}), ...(input.owner.note !== undefined ? { note: input.owner.note } : {}) };
      const derived = deriveHousehold([owner], 0);
      const profile: Profile = { id: newId('household'), name, ownerId: owner.id, people: [owner], petsCount: 0, ...derived,
        home: [], livelihood: [], plan: { contacts: [] }, updatedAt: toManilaIso(now()) };
      profiles = [...profiles, profile]; activeProfileId = profile.id;
      save('profiles', profiles); save('activeProfileId', activeProfileId); save(keyFor(profile.id), {});
      emit('profiles'); emit('family'); emit('checklist'); return { ok: true, value: profile };
    },
    save: (input: ProfileInput): SaveProfileResult => {
      const profile = active(input.id);
      if (!profile) return { ok: false, errors: [profileErr('name_required', 'id')] };
      const errors: { code: string; field: string }[] = [];
      const name = input.name.trim();
      if (!name) errors.push(profileErr('name_required', 'name')); else if (name.length > 60) errors.push(profileErr('too_long', 'name'));
      if (!Number.isInteger(input.petsCount) || input.petsCount < 0 || input.petsCount > 20) errors.push({ code: 'pets_range', field: 'petsCount' });
      if (input.plan.contacts.length > 5) errors.push({ code: 'too_many_contacts', field: 'plan.contacts' });
      input.plan.contacts.forEach((c, i) => {
        if (c.name.length > 60) errors.push(profileErr('too_long', `plan.contacts.${i}.name`));
        if (c.relation !== undefined && c.relation.length > 60) errors.push(profileErr('too_long', `plan.contacts.${i}.relation`));
        if (c.phone.trim() && !phoneRe.test(cleanPhone(c.phone))) errors.push(profileErr('contact_phone_invalid', `plan.contacts.${i}.phone`));
      });
      if (input.plan.evacuationCenter !== undefined && input.plan.evacuationCenter.length > 60) errors.push(profileErr('too_long', 'plan.evacuationCenter'));
      if (input.plan.meetingPlace !== undefined && input.plan.meetingPlace.length > 60) errors.push(profileErr('too_long', 'plan.meetingPlace'));
      if (errors.length) return { ok: false, errors: errors as SaveProfileResult extends {ok:false; errors: infer E} ? E : never };
      profile.name = name; profile.petsCount = input.petsCount; profile.home = [...input.home];
      profile.livelihood = [...(input.livelihood ?? [])]; profile.area = input.area; profile.plan = { ...input.plan, contacts: [...input.plan.contacts] };
      Object.assign(profile, deriveHousehold(profile.people, profile.petsCount)); profile.updatedAt = toManilaIso(now());
      save('profiles', profiles); emit('profiles'); emit('checklist'); return { ok: true, value: profile };
    },
    setActive: (id) => {
      if (!active(id)) return err('not_found', 'Profile not found');
      activeProfileId = id; save('activeProfileId', id); emit('profiles'); emit('family'); emit('checklist'); return ok(undefined);
    },
    remove: (id) => {
      if (!active(id)) return err('not_found', 'Profile not found');
      if (profiles.length < 2) return err('last_profile', 'Cannot remove the last profile');
      profiles = profiles.filter((p) => p.id !== id); store.delete(keyFor(id)); store.delete(`rollcall:${id}` as keyof StoreSchema);
      if (activeProfileId === id) activeProfileId = profiles[0]?.id ?? null;
      save('profiles', profiles); save('activeProfileId', activeProfileId); emit('profiles'); emit('family'); emit('checklist'); return ok(undefined);
    },
  };

  const photos: PhotosApi = {
    start: async (_target, source) => err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo service is unavailable'),
    save: async () => err('io', 'Photo service is unavailable'),
    discard: () => undefined,
    remove: (memberId) => {
      const p = active(); const m = p?.people.find((item) => item.id === memberId);
      if (!m) return err('not_found', 'Member not found'); delete m.photo; save('profiles', profiles); emit('family'); return ok(undefined);
    },
    removeAll: () => { for (const p of profiles) for (const m of p.people) delete m.photo; save('profiles', profiles); emit('family'); },
  };
  const familyApi: Engine['family'] = {
    members: () => active()?.people ?? [],
    saveMember: (input): SaveMemberResult => {
      const profile = active();
      if (!profile) return { ok: false, errors: [{ code: 'name_required', field: 'member.name' }] };
      const errors = validMember(input);
      const existing = input.id ? profile.people.find((member) => member.id === input.id) : undefined;
      if (!existing && profile.people.length >= 30) errors.push({ code: 'too_many_members', field: 'member' });
      if (input.relation === 'self' && existing?.id !== profile.ownerId) errors.push({ code: 'owner_relation', field: 'member.relation' });
      if (errors.length) return { ok: false, errors: errors as SaveMemberResult extends {ok:false; errors: infer E} ? E : never };
      const member: Member = { id: existing?.id ?? newId('member'), name: input.name.trim(), relation: input.relation, ageGroup: input.ageGroup,
        needs: [...input.needs], updatedAt: toManilaIso(now()), ...(input.note !== undefined ? { note: input.note } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(existing?.photo ? { photo: existing.photo } : {}) };
      if (existing) profile.people[profile.people.indexOf(existing)] = member; else profile.people.push(member);
      Object.assign(profile, deriveHousehold(profile.people, profile.petsCount)); profile.updatedAt = toManilaIso(now());
      save('profiles', profiles); emit('family'); emit('checklist'); return { ok: true, value: member };
    },
    removeMember: (id) => {
      const p = active(); const at = p?.people.findIndex((m) => m.id === id) ?? -1;
      if (!p || at < 0) return err('not_found', 'Member not found'); if (id === p.ownerId) return err('owner_required', 'Cannot remove household owner');
      p.people.splice(at, 1); Object.assign(p, deriveHousehold(p.people, p.petsCount)); p.updatedAt = toManilaIso(now());
      save('profiles', profiles); emit('family'); emit('checklist'); return ok(undefined);
    },
    photos,
    card: (id): MemberCardView | null => { const p = active(); const member = p?.people.find((m) => m.id === id); const owner = p?.people.find((m) => m.id === p.ownerId); return p && member ? { member, ownerName: owner?.name ?? '', ...(owner?.phone ? { ownerPhone: owner.phone } : {}), ...(p.plan.evacuationCenter ? { evacuationCenter: p.plan.evacuationCenter } : {}), ...(p.plan.meetingPlace ? { meetingPlace: p.plan.meetingPlace } : {}) } : null; },
    shareCard: async (id) => active()?.people.some((m) => m.id === id) ? err('failed', 'Card sharing is unavailable') : err('not_found', 'Member not found'),
    rollCall: (): RollCallView => { const p = active(); const saved = p ? store.get(`rollcall:${p.id}` as keyof StoreSchema) as Record<string, {present:boolean; at:string}> | undefined : undefined; const entries = (p?.people ?? []).map((member) => ({ member, present: saved?.[member.id]?.present ?? false, ...(saved?.[member.id] ? { at: saved[member.id]!.at } : {}) })); return { entries, presentCount: entries.filter((e) => e.present).length, total: entries.length }; },
    markPresent: (id, value) => { const p = active(); if (!p?.people.some((m) => m.id === id)) return err('not_found', 'Member not found'); const key = `rollcall:${p.id}` as keyof StoreSchema; const saved = (store.get(key) as Record<string, {present:boolean;at:string}> | undefined) ?? {}; saved[id] = { present: value, at: toManilaIso(now()) }; save(key, saved as never); return ok(familyApi.rollCall()); },
    resetRollCall: () => { const p = active(); if (p) store.delete(`rollcall:${p.id}` as keyof StoreSchema); return familyApi.rollCall(); },
  };
  const checklistApi: Engine['checklist'] = {
    view: () => checklistView(),
    tick: (itemId, ticked) => { const p = active(); if (!p || !content.checklist.some((item) => item.id === itemId)) return err('unknown_item', 'Checklist item not found'); const key = keyFor(p.id); const ticks = store.get(key) ?? {}; ticks[itemId] = { ticked, updatedAt: toManilaIso(now()) }; save(key, ticks); emit('checklist'); return ok(checklistView(p)); },
    reset: () => { const p = active(); if (p) { store.delete(keyFor(p.id)); emit('checklist'); } return checklistView(p); },
  };
  const historyApi: Engine['history'] = { list: (limit) => [...history].reverse().slice(0, limit), clear: () => { history = []; store.delete('questionLog'); emit('history'); } };
  const askApi: Engine['ask'] = {
    maxLength: 200,
    run: (question: string, opts?: AskOptions): AsyncIterable<AnswerEvent> => {
      activeController?.abort();
      const controller = new AbortController(); activeController = controller;
      const signal = opts?.signal;
      const onAbort = () => controller.abort(); signal?.addEventListener('abort', onAbort, { once: true });
      const target = opts?.profileId ? active(opts.profileId) : active();
      return runAskPipeline(question, {
        content, index, profile: () => target, context: () => context, power, model,
        emergencyCard, hotlines: () => content.hotlines.filter((h) => h.scope === 'national'), evacuationCenters: () => [],
        now: () => now().getTime(), newId: () => newId('question'),
        log: (entry) => { history = [...history, entry].slice(-200); save('questionLog', history); emit('history'); },
      }, { ...opts, signal: controller.signal });
    },
    cancel: () => { activeController?.abort(); void model.stop(); },
    warm: () => { void power.aiAllowed().then((d) => d.allowed ? model.warm() : undefined); },
  };
  const guideApi: Engine['guide'] = {
    topics: () => { const counts = new Map<TopicGroup, number>(); for (const p of content.passages) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1); return [...counts].map(([topic, count]) => ({ topic, count })); },
    byTopic: (topic) => content.passages.filter((p) => p.topic === topic).map(({ id, title, summary, topic: t, critical }) => ({ id, title, summary, topic: t, critical })),
    passage: (id) => { const p = content.passages.find((item) => item.id === id); return p ? { id: p.id, title: p.title, summary: p.summary, topic: p.topic, critical: p.critical, text: p.text, source: sourceRef(p.source_id, p.locator), reviewedBy: p.reviewed_by, reviewedAt: p.reviewed_at, version: p.version } : null; },
    sources,
  };
  const planApi: Engine['plan'] = {
    hotlines: () => content.hotlines.filter((h) => h.scope === 'national'), evacuationCenters: () => [],
    call: async (id) => content.hotlines.some((h) => h.id === id) ? err('no_dialer', 'Dialer is unavailable') : err('not_found', 'Hotline not found'),
    textPreview: (kind, opts) => { const profile = active(); return profile ? exportHouseholdSms(profile, kind, { ...opts, copy: (key) => COPY[key] }) : ''; },
    composeText: async (_kind, opts) => opts.to.length ? err('no_sms_app', 'SMS composer is unavailable') : err('no_recipients', 'Choose a recipient'),
    exportPlan: async () => err('failed', 'Plan export is unavailable'),
  };
  const settingsApi: Engine['settings'] = {
    get: () => ({ ...settings }),
    update: (patch) => {
      if (patch.language !== undefined && patch.language !== 'tl' && patch.language !== 'en') return err('out_of_range', 'language must be tl or en');
      if (patch.lowBatteryThreshold !== undefined && (!Number.isFinite(patch.lowBatteryThreshold) || patch.lowBatteryThreshold < 5 || patch.lowBatteryThreshold > 50)) return err('out_of_range', 'lowBatteryThreshold 5-50');
      if (patch.staleWarningHours !== undefined && (!Number.isFinite(patch.staleWarningHours) || patch.staleWarningHours < 1 || patch.staleWarningHours > 12)) return err('out_of_range', 'staleWarningHours 1-12');
      settings = { ...settings, ...patch }; save('settings', settings); void power.aiAllowed(); emit('settings'); emit('status'); return ok(settings);
    },
  };
  const packsApi: Engine['packs'] = {
    installed: () => packs.installed(), importFromPicker: async () => err('bad_archive', 'No file picker is available'),
    importFile: (uri) => packs.importFile(uri), apply: async (id) => { const result = await packs.apply(id); if (result.ok) { emit('packs'); emit('updates'); } return result; },
    rollback: async (id) => { const result = await packs.rollback(id); if (result.ok) emit('packs'); return result; },
    share: async () => err('no_pack', 'Pack sharing is unavailable'),
  };
  const engine: RealEngine = {
    init: async () => {
      try {
        const checked = validateContent(rawContent);
        if (!checked.ok) return { ok: false, error: { code: 'content_invalid', message: checked.error.message } };
        content = checked.value; index = createIndex(content.passages);
        profiles = store.get('profiles') ?? []; activeProfileId = store.get('activeProfileId') ?? null;
        context = store.get('context') ?? { phase: 'before', warnings: {} };
        history = (store.get('questionLog') ?? []).slice(-200);
        settings = { ...DEFAULT_SETTINGS, ...(store.get('settings') ?? {}), language: store.get('settings')?.language ?? 'tl' };
        if (store.get('settings') === undefined) store.set('settings', settings);
        present = await ((model as ModelManager & { present?: () => Promise<boolean> }).present?.() ?? Promise.resolve(false));
        await power.refresh(); battery = power.battery(); cachedTier = await power.tier();
        aiDecision = await power.aiAllowed();
        return ok(info());
      } catch (cause) { return err('storage_failed', cause instanceof Error ? cause.message : 'Could not load local data'); }
    },
    info, status, copy: (key: CopyKey, lang = 'tl') => lang === 'en' ? COPY_EN[key] : COPY[key], onChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    profiles: profilesApi, family: familyApi, context: contexts, checklist: checklistApi, ask: askApi, guide: guideApi,
    emergency: { card: emergencyCard }, plan: planApi, settings: settingsApi, history: historyApi,
    evaluation: { summary: (): EvalSummary => EVAL_SUMMARY_FIXTURE }, packs: packsApi,
    updates: { pending: () => null, check: async () => err('offline', 'Updates are unavailable offline'), download: async () => err('offline', 'Updates are unavailable offline'), networkLog: () => store.get('networkLog') ?? [] },
    exports: {
      householdSms: (kind, opts = {}) => { const profile = active(); return profile ? exportHouseholdSms(profile, kind, { ...opts, copy: (key) => COPY[key] }) : ''; },
      checklistText: () => exportChecklistText(checklistApi.view()),
    },
  };
  return engine;
}
