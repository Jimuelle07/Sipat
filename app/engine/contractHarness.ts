import { vi } from 'vitest';
import type { ChatMessage, DeviceTier, Engine, FaceDetection, MockScenario, PhotoError, Settings } from '../types/index.ts';
import type { FilePicker, PhotoService, PowerPolicy, ShareService, UpdateClient } from '../types/services.ts';
import type { ContentFileName, IntentRules } from '../types/content.ts';
import { createEngine } from './engine.ts';
import { createMockEngine } from './mock.ts';
import { fixtureProfile } from './fixtures/households.ts';
import {
  FIXTURE_CHECKLIST, FIXTURE_HOTLINES, FIXTURE_INTENTS, FIXTURE_PASSAGES, FIXTURE_PHASE_RULES,
  FIXTURE_PLACES, FIXTURE_SOURCES, FIXTURE_WARNINGS,
} from './fixtures/content.ts';
import { DEMO_SOURCED_RULES, fixtureStorm } from './fixtures/feed.ts';
import { BUNDLED_MODEL } from '../services/modelEntry.ts';
import { createModelManager, type LlamaBackend, type ModelFiles } from '../services/model.ts';
import { decideAi } from '../services/power.ts';
import { createMemoryStore } from '../services/store.ts';

export type FeedSetting = 'off' | 'empty' | 'fresh' | 'stale' | 'near' | 'signal_here' | 'track_approach' | 'left';
export type ModelFileSetting = 'exact' | 'wrong_name' | 'wrong_size' | 'wrong_hash' | 'none';

export interface ContractControls {
  scenario(s: MockScenario): string;
  setPhotoResult(r: FaceDetection | PhotoError): void;
  setModelFile(f: ModelFileSetting): void;
  setTier(t: DeviceTier): void;
  setBattery(b: { level: number; charging: boolean; saver: boolean }): void;
  setModelPresent(present: boolean): void;
  setFeed(f: FeedSetting): Promise<void>;
  advance(ms: number): void;
  prompts(): ChatMessage[][];
  requests(): string[];
  modelDirFiles(): string[];
  photoFiles(): string[];
  dispose(): void;
}

export interface EngineUnderTest { name: 'mock' | 'real'; engine: Engine; ctl: ContractControls }

const START = new Date('2026-10-10T08:00:00+08:00');
const DEFAULT_SETTINGS: Settings = {
  language: 'tl', lowBatteryThreshold: 15, aiEnabled: true, lowBatteryMode: false,
  staleWarningHours: 3, feedEnabled: true, autoCheckUpdates: true, wifiOnly: true,
  topicReportsOptIn: false, damageReportsOptIn: false,
};
const ok = <T>(value: T) => ({ ok: true as const, value });
const failure = <E extends string>(code: E) => ({ ok: false as const, error: { code, message: code } });
const cloneFixturePhaseRules = () => JSON.parse(JSON.stringify(FIXTURE_PHASE_RULES)) as typeof FIXTURE_PHASE_RULES;
const envelopes = <T>(items: T[]) => ({
  schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', items,
});

function fixtureContent(): Partial<Record<ContentFileName, unknown>> {
  return {
    'guide.tl.json': envelopes(FIXTURE_PASSAGES),
    'checklist.json': envelopes(FIXTURE_CHECKLIST),
    'warnings.json': envelopes(FIXTURE_WARNINGS),
    'synonyms.json': envelopes([]),
    'intents.json': {
      schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', rules: FIXTURE_INTENTS,
    },
    'sources.json': envelopes(FIXTURE_SOURCES),
    'hotlines.json': envelopes(FIXTURE_HOTLINES.map((hotline) => ({ ...hotline, number: '000' }))),
    'phase_rules.json': {
      schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00',
      rules: cloneFixturePhaseRules(),
    },
    'places.json': FIXTURE_PLACES,
  };
}

function scriptedIntents(): IntentRules {
  return {
    ...FIXTURE_INTENTS,
    emergency: { phrases: ['lumulubog', 'emergency test'], card_id: 'emergency-default' },
    live_data: { phrases: ['nasaan na ang bagyo', 'live data test'], reply_key: 'no_live_data' },
    medical_dose: { phrases: ['ilang tableta', 'dose test'], reply_key: 'medical_dose' },
    plan: {
      ...FIXTURE_INTENTS.plan,
      evacuation_center: ['evacuation center test'],
      meeting_place: ['meeting place test'],
    },
    phase_cues: {
      before: { strong: ['may paparating na bagyo'], weak: ['weak before cue'] },
      during: { strong: ['na dito', 'storm is here test'], weak: ['weak during cue'] },
      after: { strong: ['humupa na bagyo', 'storm has passed test'], weak: ['weak after cue'] },
    },
  };
}

function contentForEngine(): Partial<Record<ContentFileName, unknown>> {
  const content = fixtureContent();
  content['intents.json'] = {
    schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', rules: scriptedIntents(),
  };
  return content;
}

const scenarioQuestion: Record<MockScenario, string> = {
  guide_full: 'Paano ihanda ang go bag?',
  guide_critical: 'Paano ako lilikas kung malapit sa ilog?',
  emergency_then_guide: 'May emergency test, paano ihanda ang go bag?',
  refusal: 'Sino ang pangulo ng bansa ngayon?',
  live_data: 'live data test',
  live_data_bulletin: 'nasaan na ang bagyo?',
  medical_dose: 'dose test',
  plan_center: 'evacuation center test',
  plan_empty: 'meeting place test',
  ai_rejected: 'Paano ihanda ang go bag?',
  low_battery: 'Paano ihanda ang go bag?',
  no_model: 'Paano ihanda ang go bag?',
  phase_cue_during: 'storm is here test, paano ihanda ang go bag?',
  phase_cue_after: 'storm has passed test, ano ang gagawin pagkatapos ng baha?',
};

function createFakeModel(readTier: () => Promise<DeviceTier>) {
  const files = new Map<string, { size: number; hash: string }>();
  const prompts: ChatMessage[][] = [];
  const modelPath = `memory://models/${BUNDLED_MODEL.file_name}`;
  let fileSetting: ModelFileSetting = 'exact';
  let nextOutput: string | null = null;
  const fileApi: ModelFiles = {
    freeBytes: async () => BUNDLED_MODEL.size * 2,
    exists: async (path) => files.has(path),
    size: async (path) => files.get(path)?.size ?? null,
    async copyWithSha256(_src, dest, onProgress, signal) {
      if (signal?.aborted) throw new Error('cancelled');
      const size = fileSetting === 'wrong_size' ? BUNDLED_MODEL.size + 1 : BUNDLED_MODEL.size;
      const hash = fileSetting === 'wrong_hash' ? '0'.repeat(64) : BUNDLED_MODEL.sha256;
      files.set(dest, { size, hash });
      onProgress(size, size);
      return hash;
    },
    async downloadWithSha256(_url, dest, onProgress, signal) {
      if (signal?.aborted) throw new Error('cancelled');
      const size = fileSetting === 'wrong_size' ? BUNDLED_MODEL.size + 1 : BUNDLED_MODEL.size;
      const sha256 = fileSetting === 'wrong_hash' ? '0'.repeat(64) : BUNDLED_MODEL.sha256;
      files.set(dest, { size, hash: sha256 });
      onProgress(size, size);
      return { sha256, bytes: size };
    },
    async remove(path) { files.delete(path); },
    async move(srcPath, destPath) {
      const found = files.get(srcPath);
      files.delete(srcPath);
      if (found) files.set(destPath, found);
    },
  };
  files.set(modelPath, { size: BUNDLED_MODEL.size, hash: BUNDLED_MODEL.sha256 });
  const backend: LlamaBackend = {
    async init() {
      return {
        async completion(params, onToken) {
          prompts.push(params.messages.map((message) => ({ ...message })));
          const allowed = params.messages.at(-1)?.content ?? '';
          const id = /Talata \[([^\]]+)\]/.exec(allowed)?.[1] ?? 'before-gobag-01';
          const candidate = nextOutput ?? JSON.stringify({
            used: [id], in_guide: true, phase_hint: null,
            answer: 'Ihanda ang gamit at sundin ang gabay na nakasaad sa talata.',
          });
          nextOutput = null;
          const parsed = JSON.parse(candidate) as { used: string[]; in_guide: boolean; phase_hint: string | null; answer: string };
          const offeredIds = [...allowed.matchAll(/Talata \[([^\]]+)\]/g)].map((match) => match[1]);
          if (offeredIds.length > 0 && !offeredIds.includes(parsed.used[0] ?? '')) parsed.used = [offeredIds[0]!];
          if (!parsed.answer.includes('999')) {
            parsed.answer = FIXTURE_PASSAGES.find((passage) => passage.id === parsed.used[0])?.summary
              ?? '(fill in mula sa talata)';
          }
          const output = JSON.stringify(parsed);
          onToken(output);
          return { text: output, timings: { prompt_n: 1, prompt_ms: 1, predicted_n: 20 } };
        },
        async stopCompletion() {},
        async release() {},
      };
    },
  };
  const manager = createModelManager({
    backend, files: fileApi, modelDir: 'memory://models', readTier, idleUnloadMs: 0,
    expected: BUNDLED_MODEL,
  });
  return {
    manager,
    prompts,
    files,
    modelPath,
    setModelPresent(value: boolean) {
      if (value) files.set(modelPath, { size: BUNDLED_MODEL.size, hash: BUNDLED_MODEL.sha256 });
      else files.delete(modelPath);
      void manager.present();
    },
    setFileSetting(value: ModelFileSetting) { fileSetting = value; },
    setNextOutput(value: string) { nextOutput = value; },
  };
}

function outputFor(id = 'before-gobag-01', phase: 'before' | 'during' | 'after' | null = null,
  invalidNumber = false): string {
  return JSON.stringify({
    used: [id], in_guide: true, phase_hint: phase,
    answer: invalidNumber ? 'Magdala ng 999 na gamit ayon sa gabay.' : 'Ihanda ang gamit at sundin ang gabay na nakasaad sa talata.',
  });
}

async function makeReal(): Promise<EngineUnderTest> {
  let currentTime = START.getTime();
  let tier: DeviceTier = 'full';
  let battery = { level: 80, charging: false, saver: false };
  let modelPresent = true;
  let photoResult: FaceDetection | PhotoError = 'one_face';
  let servedFeed: FeedSetting = 'fresh';
  const requests: string[] = [];
  const fakeModel = createFakeModel(async () => tier);
  const profile = fixtureProfile();
  const cachedBulletin = fixtureStorm().bulletin;
  const baseFeed = {
    sequence: 1, issuedAt: cachedBulletin.issuedAt, serverStale: false,
    bulletins: [cachedBulletin], fetchedAt: cachedBulletin.fetchedAt, checkedAt: '2026-10-10T08:00:00+08:00',
  };
  const store = createMemoryStore({
    profiles: [profile], activeProfileId: profile.id, settings: DEFAULT_SETTINGS, feed: baseFeed,
  });
  const mutableContent = contentForEngine();

  const power: PowerPolicy = {
    aiAllowed: async () => decideAi({ settings: store.get('settings') ?? DEFAULT_SETTINGS,
      battery, tier, modelPresent }),
    onChange: () => () => {},
  };
  let fileState: ModelFileSetting = 'exact';
  const picker: FilePicker = {
    async pick(kind) {
      if (kind !== 'model') return ok(null);
      const setting = fileState;
      if (setting === 'none') return ok(null);
      return ok({ uri: 'memory://picked/model.gguf', name: setting === 'wrong_name'
        ? 'wrong.gguf' : BUNDLED_MODEL.file_name,
      size: setting === 'wrong_size' ? BUNDLED_MODEL.size + 1 : BUNDLED_MODEL.size });
    },
  };
  const photos: PhotoService = {
    async pick() {
      if (photoResult !== 'one_face' && photoResult !== 'no_face' && photoResult !== 'many_faces'
        && photoResult !== 'unavailable') {
        // Engine PhotoError includes outcomes that PhotoService.pick cannot normally produce.
        return failure(photoResult) as Awaited<ReturnType<PhotoService['pick']>>;
      }
      return ok({ uri: 'memory://photo/draft.jpg', width: 300, height: 300 });
    },
    async detect() {
      const detection = photoResult as FaceDetection;
      return { detection, faces: detection === 'one_face' ? [{ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }] : [] };
    },
    async saveCrop(_uri, _crop, memberId) { return ok({ uri: `memory://photo/${memberId}.jpg`, bytes: 128 }); },
    async remove() {},
  };
  const share: ShareService = { shareMemberCard: async () => ok(undefined) };
  const updates: UpdateClient = {
    async fetchFeed() {
      requests.push('fetchFeed');
      if (servedFeed === 'off') return failure('disabled');
      if (servedFeed === 'empty') return ok({ sequence: 1, issuedAt: '2026-10-10T08:00:00+08:00',
        serverStale: false, bulletins: [], fetchedAt: '2026-10-10T08:00:00+08:00', checkedAt: '2026-10-10T08:00:00+08:00' });
      const variant = servedFeed === 'near' || servedFeed === 'signal_here' || servedFeed === 'track_approach' || servedFeed === 'left'
        ? servedFeed : undefined;
      const { bulletin } = fixtureStorm(variant);
      return ok({ sequence: 1, issuedAt: bulletin.issuedAt, serverStale: servedFeed === 'stale',
        bulletins: [bulletin], fetchedAt: '2026-10-10T08:00:00+08:00', checkedAt: '2026-10-10T08:00:00+08:00' });
    },
    async fetchCenters() { requests.push('fetchCenters'); return failure('disabled'); },
    async check() { requests.push('check'); return ok(null); },
    async download() { requests.push('download'); return failure('disabled'); },
  };
  const engine = createEngine({
    store, content: mutableContent, now: () => new Date(currentTime), power, model: fakeModel.manager,
    updates, photos, share, files: picker,
  });
  const initialized = await engine.init();
  if (!initialized.ok) throw new Error(`Real contract engine init failed: ${initialized.error.code}: ${initialized.error.message}`);

  const ctl: ContractControls = {
    scenario(s) {
      const q = scenarioQuestion[s];
      // The base store keeps a cached bulletin (matching the mock). The live-data route reads the
      // feed cache directly, so clear it for 'live_data' and re-seed it for 'live_data_bulletin'
      // without an outbound request (docs section 6).
      if (s === 'live_data') store.delete('feed');
      if (s === 'live_data_bulletin') store.set('feed', baseFeed);
      battery = { level: s === 'low_battery' ? 10 : 80, charging: false, saver: false };
      tier = 'full';
      modelPresent = s !== 'no_model';
      fakeModel.setModelPresent(modelPresent);
      const passageId = s === 'guide_critical' ? 'during-flood-river-01' : 'before-gobag-01';
      const phaseHint = s === 'phase_cue_during' ? 'during' : s === 'phase_cue_after' ? 'after' : null;
      fakeModel.setNextOutput(outputFor(passageId, phaseHint, s === 'ai_rejected'));
      return q;
    },
    setPhotoResult(r) { photoResult = r; },
    setModelFile(f) { fileState = f; fakeModel.setFileSetting(f); },
    setTier(t) { tier = t; },
    setBattery(b) { battery = { ...b }; },
    setModelPresent(present) { modelPresent = present; fakeModel.setModelPresent(present); },
    async setFeed(f) {
      servedFeed = f;
      engine.settings.update({ feedEnabled: f !== 'off' });
      const phaseFile = mutableContent['phase_rules.json'] as { rules: object };
      Object.assign(phaseFile.rules, JSON.parse(JSON.stringify(
        f === 'near' || f === 'signal_here' || f === 'track_approach' || f === 'left'
          ? DEMO_SOURCED_RULES : FIXTURE_PHASE_RULES,
      )) as object);
      await engine.feed.refresh();
    },
    advance(ms) { currentTime += ms; },
    prompts: () => fakeModel.prompts.map((prompt) => prompt.map((message) => ({ ...message }))),
    requests: () => [...requests],
    modelDirFiles: () => [...fakeModel.files.keys()],
    photoFiles: () => engine.family.members().flatMap((member) => member.photo ? [member.photo.uri] : []),
    dispose() { void fakeModel.manager.unload(); },
  };
  return { name: 'real', engine, ctl };
}

async function makeMock(): Promise<EngineUnderTest> {
  vi.setSystemTime(START);
  const mock = createMockEngine({ speed: 'fast' });
  await mock.init();
  let mockTier: DeviceTier = 'full';
  let mockModelFile: ModelFileSetting = 'exact';
  const updateMockInstallResult = () => {
    mock.debug.setModelInstallResult(mockTier === 'none' ? 'tier'
      : mockModelFile === 'exact' ? 'installed'
        : mockModelFile === 'wrong_name' || mockModelFile === 'wrong_size' ? 'wrong_file'
          : mockModelFile === 'wrong_hash' ? 'hash_mismatch' : 'cancelled');
  };
  const ctl: ContractControls = {
    scenario(s) {
      mock.debug.setScenario(s);
      // Keep the mock's base feed consistent with the real engine's store: no cached bulletin for
      // 'live_data', a cached bulletin for 'live_data_bulletin'.
      if (s === 'live_data') mock.debug.setFeed('empty');
      if (s === 'live_data_bulletin') mock.debug.setFeed('fresh');
      return scenarioQuestion[s];
    },
    setPhotoResult(r) { mock.debug.setPhotoResult(r); },
    setModelFile(f) {
      mockModelFile = f;
      updateMockInstallResult();
    },
    setTier(t) { mockTier = t; mock.debug.setStatus({ tier: t }); updateMockInstallResult(); },
    setBattery(b) { mock.debug.setStatus({ battery: b }); },
    setModelPresent(present) { mock.debug.setStatus({ model: present ? 'unloaded' : 'absent' }); },
    async setFeed(f) { mock.debug.setFeed(f); },
    advance(ms) { vi.setSystemTime(new Date(Date.now() + ms)); },
    prompts: () => [],
    requests: () => [],
    modelDirFiles: () => [],
    photoFiles: () => mock.family.members().flatMap((member) => member.photo ? [member.photo.uri] : []),
    dispose() { vi.useRealTimers(); },
  };
  return { name: 'mock', engine: mock, ctl };
}

export const ENGINES: { name: 'mock' | 'real'; create(): Promise<EngineUnderTest> }[] = [
  { name: 'mock', create: makeMock },
  { name: 'real', create: makeReal },
];
