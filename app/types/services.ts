import type {
  AccountState,
  AiSkipReason,
  BlobRef,
  Bulletin,
  ChecklistTick,
  Context,
  DamageInput,
  DeviceTier,
  FaceBox,
  FaceDetection,
  FeedError,
  HouseholdLocation,
  Hotline,
  LatLon,
  ModelInstallError,
  PackError,
  Phase,
  PhaseInputs,
  CropRect,
  Profile,
  QuestionLogEntry,
  RankedCenter,
  Result,
  RouteResult,
  Settings,
  ShareableView,
  TopicGroup,
  VerifierFailure,
} from './index.ts';
import type { BuiltPrompt } from './index.ts';
import type { Timings } from './index.ts';

export type ModelState = 'absent' | 'unloaded' | 'loading' | 'ready' | 'generating' | 'error';
export type ModelError = 'no_model' | 'tier' | 'not_allowed' | 'load_failed' | 'busy' | 'cancelled' | 'native';

export interface CompletionSettings {
  nPredict: number; // 110 for 'full', 80 for 'lite'
  temperature: number;
  topP: number;
  stop: string[];
  seed?: number;
}

export interface GenerateRequest { prompt: BuiltPrompt; settings: CompletionSettings }
export interface GenerateResult {
  raw: string; // the full JSON text
  timings: Pick<Timings, 'loadMs' | 'promptTokens' | 'promptMs' | 'firstTokenMs' | 'predictedTokens'>;
}

export interface ModelManager {
  state(): ModelState;
  tier(): Promise<DeviceTier>;
  warm(): Promise<Result<void, ModelError>>;
  generate(
    req: GenerateRequest, onAnswerText: (textSoFar: string) => void, signal?: AbortSignal,
  ): Promise<Result<GenerateResult, ModelError>>;
  stop(): Promise<void>;
  unload(): Promise<void>;
  onStateChange(listener: (s: ModelState) => void): () => void;
  install(file: PickedFile, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<void, ModelInstallError>>;
  /** Downloads the GGUF from `BUNDLED_MODEL.url`, checks size and SHA-256, then installs it. */
  download(onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<{ bytes: number }, ModelInstallError>>;
  remove(): Promise<void>;
}

export type AiDecision = { allowed: true } | { allowed: false; reason: AiSkipReason };

export interface PowerPolicy {
  aiAllowed(): Promise<AiDecision>;
  onChange(listener: (d: AiDecision) => void): () => void;
}

export type PackKind = 'core' | 'area' | 'model';

export interface InstalledPack {
  packId: string;
  kind: PackKind;
  version: number;
  guideDate?: string;
  installedAt: string;
  previousVersion?: number; // kept for rollback
}

export interface NetworkLogEntry {
  at: string; method: 'GET' | 'POST'; host: string; path: string; bytes: number; status: number | 'error';
}

export interface FeedCache {
  sequence: number;         // FeedManifest.sequence of the cached feed
  issuedAt: string;         // FeedManifest.issued_at
  serverStale: boolean;     // FeedManifest.stale
  bulletins: Bulletin[];    // newest first, with fetchedAt
  hotlines?: Hotline[];     // reviewed national hotline updates, if the feed carried them
  fetchedAt: string;
  checkedAt: string;
}

export type TopicCounts = Record<string, Partial<Record<TopicGroup, number>>>; // ISO week → counts (Pilot)

export interface StoreSchema {
  profiles: Profile[];             // one household; members and location included
  activeProfileId: string | null;
  context: Context;                // phase, phaseSource, reason, recommended, warnings, suppressed inputs
  questionLog: QuestionLogEntry[]; // newest last, capped (proposal: 200)
  settings: Settings;
  packs: InstalledPack[];
  feed: FeedCache;
  networkLog: NetworkLogEntry[];   // MVP stretch, capped (proposal: 200)
  topicCounts: TopicCounts;        // Pilot
  damageReports: DamageDraft[];   // Pilot: unsent and sent reports; photo files in files/damage/
  account: AccountState;           // Later: sign-in state and sync metadata; never the password
  [key: `checklist:${string}`]: Record<string, ChecklistTick>; // one key per profile ID
}

export type StoreKey = keyof StoreSchema;

export interface Store {
  get<K extends StoreKey>(key: K): StoreSchema[K] | undefined;
  set<K extends StoreKey>(key: K, value: StoreSchema[K]): void;
  delete(key: StoreKey): void;
}

export interface ImportPreview {
  previewId: string;
  signedBy: string; // kid of the pack key
  packs: {
    packId: string; kind: PackKind; fromVersion?: number; toVersion: number;
    sizeBytes: number; guideDate?: string; upserts: number; deletes: number;
  }[];
}

export interface ApplyResult { applied: { packId: string; version: number }[]; guideDate?: string }

export interface PackManager {
  installed(): InstalledPack[];
  importFile(uri: string): Promise<Result<ImportPreview, PackError>>;
  apply(previewId: string): Promise<Result<ApplyResult, PackError | 'io'>>;
  rollback(packId: string): Promise<Result<void, 'io' | 'nothing_to_roll_back'>>;
}

export interface PickedPhoto { uri: string; width: number; height: number }

export interface PickedFile { uri: string; name: string; size: number }

export interface PhotoService {
  pick(source: 'camera' | 'gallery'): Promise<Result<PickedPhoto | null, 'permission_denied' | 'no_camera' | 'unreadable'>>;
  detect(uri: string): Promise<{ detection: FaceDetection; faces: FaceBox[] }>;
  saveCrop(uri: string, crop: CropRect, memberId: string): Promise<Result<{ uri: string; bytes: number }, 'io'>>;
  remove(photoUri: string): Promise<void>;
}

export interface LocationService {
  readOnce(): Promise<Result<LatLon & { accuracyM: number; at: string }, 'permission_denied' | 'services_off' | 'unavailable'>>;
}

export interface ShareService {
  shareMemberCard(cardView: ShareableView): Promise<Result<void, 'cancelled' | 'failed'>>;
}

export interface FilePicker {
  pick(kind: 'model' | 'pack'): Promise<Result<PickedFile | null, 'io'>>;
}

export interface ScreenService {
  sosOn(): Promise<void>;
  sosOff(): Promise<void>;
}

export type UpdateError = 'disabled' | 'offline' | 'not_allowed' | 'http' | 'cancelled' | PackError;

export interface UpdatePlan {
  planId: string;
  provinceCode?: string;
  items: {
    packId: string; kind: PackKind; fromVersion?: number; toVersion: number; blob: BlobRef; delta: boolean;
  }[];
  totalBytes: number;
  guideDate?: string;
}

export interface UpdateClient {
  fetchFeed(opts: { trigger: 'open' | 'pull' }): Promise<Result<FeedCache | 'unchanged', FeedError>>;
  fetchCenters(provinceCode: string): Promise<Result<ImportPreview | 'unchanged', UpdateError>>;
  check(opts: { trigger: 'auto' | 'user' }): Promise<Result<UpdatePlan | null, UpdateError>>;
  download(
    plan: UpdatePlan, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal,
  ): Promise<Result<ImportPreview, UpdateError>>;
}

export interface TopicReporter {
  enabled(): boolean;
  record(topic: TopicGroup): void;
  flushIfDue(): Promise<Result<'sent' | 'not_due' | 'disabled', 'offline' | 'http'>>;
}

export type DamageType = 'flood' | 'wind' | 'surge' | 'landslide' | 'other';
export type DamageSeverity = 'light' | 'moderate' | 'severe';

export interface DamageDraft {
  id: string;
  createdAt: string;
  damageType: DamageType;
  severity: DamageSeverity;
  affectedMembers: number; // a count, never names
  notes?: string;          // ≤ 300 chars, user-written
  photoPaths: string[];    // files/damage/*.jpg, separate from member photos; ≤ 5
  sentAt: string | null;
}

export interface DamageReporter {
  list(): DamageDraft[];
  save(input: DamageInput & { id?: string }): Result<DamageDraft, 'invalid' | 'io'>;
  addPhoto(id: string, photo: PickedPhoto): Promise<Result<DamageDraft, 'too_many_photos' | 'io'>>;
  removePhoto(id: string, index: number): Result<DamageDraft, 'not_found'>;
  send(id: string): Promise<Result<'sent', 'offline' | 'not_opted_in' | 'http' | 'not_found'>>;
  remove(id: string): void;
}

export interface EvalQuestion {
  id: string;
  text: string;
  kind: 'in_scope' | 'out_of_scope' | 'emergency' | 'phase';
  expect: {
    passageIds?: string[]; route?: RouteResult['primary']; emergency?: boolean; refuse?: boolean;
    phaseCue?: Phase | null;
  };
  profileFixture?: string;
  outsider?: boolean;
}

export interface PhaseCase {
  id: string;
  inputs: PhaseInputs;
  expect: { phase: Phase; switched: boolean; recommended: Phase | null; hint?: 'accepted' | 'dropped' };
}

export interface RetrievalReport {
  hitAt2: number; correctRefusal: number; emergencyTrigger: number; routeAccuracy: number; phaseCueAccuracy: number;
  failures: { id: string; got: string[] }[];
}

export interface AnswerReport {
  numberCheckPass: number;
  rejectedByCode: Partial<Record<VerifierFailure, number>>;
  phaseHint: { emitted: number; accepted: number; dropped: number };
  latencyMs: { p50: number; p90: number };
  samples: { id: string; answer: string; used: string[]; phase_hint: Phase | null }[];
}

export interface PhaseReport {
  passed: number;
  total: number;
  wrongDirection: number;
  failures: string[];
}

export interface EvalRunner {
  runRetrieval(set: EvalQuestion[]): RetrievalReport;
  runAnswers(set: EvalQuestion[], model: Pick<ModelManager, 'generate'>): Promise<AnswerReport>;
  runPhase(cases: PhaseCase[]): PhaseReport;
}
