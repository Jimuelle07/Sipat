import type {
  AgeGroup,
  BulletinCardView,
  ColorLevel,
  Context,
  CopyKey,
  DeviceTier,
  FaceDetection,
  HomeTag,
  HouseholdLocation,
  Member,
  MemberPhoto,
  NeedTag,
  Phase,
  PlaceLevel,
  Profile,
  Relation,
  Result,
  Settings,
  StormMeasure,
  RankedCenter,
  TcwsLevel,
  TopicGroup,
  UiLanguage,
  WarningKind,
} from './common.ts';
import type {
  ContentFileName,
  Hotline,
  QuestionLogEntry,
  Source,
  WarningEntry,
} from './content.ts';
import type { ChecklistView, PackError, WarningCard } from './core.ts';
import type { AnswerEvent, AskOptions, SourceRef } from './ask.ts';
import type {
  AiDecision,
  ApplyResult,
  DamageDraft,
  DamageSeverity,
  DamageType,
  FilePicker,
  ImportPreview,
  InstalledPack,
  LocationService,
  ModelManager,
  NetworkLogEntry,
  ModelState,
  PhotoService,
  PowerPolicy,
  ScreenService,
  ShareService,
  Store,
  UpdateClient,
  UpdateError,
  UpdatePlan,
} from './services.ts';

// Mirrors docs/api-layer.md section 3.2. Change both in the same commit.
export const ENGINE_API_VERSION = 2; // product v3 decisions: phases, feed, evacuation, location, required photos

export interface Engine {
  init(): Promise<Result<EngineInfo, 'content_invalid' | 'storage_failed'>>; // once, behind the splash screen
  info(): EngineInfo;
  status(): EngineStatus;
  copy(key: CopyKey, opts?: { lang?: UiLanguage; vars?: Record<string, string> }): string; // 'tl' default
  onChange(listener: (change: EngineChange) => void): () => void; // returns unsubscribe

  profiles: ProfilesApi;
  family: FamilyApi;         // members, required photos, pending list, location, "Hinahanap" card
  context: ContextApi;       // phase (with automatic switching) and warnings
  checklist: ChecklistApi;
  ask: AskApi;
  guide: GuideApi;
  emergency: EmergencyApi;
  plan: PlanApi;             // the Hotlines screen
  feed: FeedApi;             // MVP stretch: cached PAGASA bulletins
  evacuation: EvacuationApi; // household center (MVP core); bulletin card, track and ranked centers (MVP stretch)
  account: AccountApi;       // MVP: static screens make no calls; Later: sign-in and profile sync
  model: ModelApi;           // MVP: install the GGUF from a file, remove it
  screen: ScreenApi;         // MVP stretch: the SOS light
  damage: DamageApi;         // Pilot: damage reports to the LGU
  settings: SettingsApi;
  history: HistoryApi;
  evaluation: EvaluationApi;
  packs: PacksApi;           // MVP stretch
  updates: UpdatesApi;       // MVP stretch
}

export interface EngineOverrides { // tests and the Node evaluation only
  model?: ModelManager;       // a fake that scripts generate()
  power?: PowerPolicy;        // a fixed battery state and tier
  store?: Store;              // in-memory instead of MMKV
  now?: () => Date;           // a fixed clock
  content?: Partial<Record<ContentFileName, unknown>>; // fixture files instead of the bundled ones
  updates?: UpdateClient;     // a fake that serves fixture feed and packs
  location?: LocationService; // a fake that returns a fixed reading or an error
  photos?: PhotoService;      // a fake picker and detector
  share?: ShareService;       // a fake share sheet
  files?: FilePicker;         // a fake document picker that returns fixture files
  screen?: ScreenService;     // a no-op wake lock and brightness
}

export type AccountError = 'invalid_email' | 'weak_password' | 'offline' | 'http' | 'demo_only';
export type ModelInstallError =
  | 'tier' | 'no_space' | 'wrong_file' | 'hash_mismatch' | 'cancelled' | 'io'
  | 'download_failed'; // download(): no connection, or the host refused or cut off the file

export type EngineChange =
  | 'profiles'  // household, plan fields, location
  | 'family'    // members, photos, pending list
  | 'phase'     // phase, phaseSource, reason, recommended, lastSwitch: re-theme and show the banner
  | 'context'   // warnings
  | 'checklist' | 'settings' | 'status' | 'history'
  | 'feed'      // MVP stretch: feed state or cached bulletins changed
  | 'packs' | 'updates'
  | 'account'   // Later: sign-in state or sync changed
  | 'damage';   // Pilot: a damage report was saved, changed or sent

export interface EngineInfo {
  appVersion: string;
  engineApiVersion: number;
  guideDate: string; // YYYY-MM-DD, shown on About
  passagesCount: number;
  sourcesCount: number;
  packs: InstalledPack[];
  online: boolean;   // false until the pinned update host is configured (feed and packs); the model download does not depend on it
  model: { fileName: string; sizeBytes: number; present: boolean; attribution: 'Built with Llama' };
}

export interface EngineStatus {
  tier: DeviceTier;
  model: ModelState;
  ai: AiDecision; // allowed, or the reason it is not
  battery: { level: number; charging: boolean; saver: boolean } | null; // null until the first reading
  stale?: { kind: WarningKind; hoursSinceSet: number };
  updateAvailable?: { totalBytes: number; guideDate?: string }; // MVP stretch
}

export interface NewHouseholdInput {
  name: string;       // "Bahay namin"
  owner: MemberInput; // the main person; relation is forced to 'self'
}
export interface ProfileInput { // household-level fields only; location goes through family.location
  id: string;
  name: string;
  petsCount: number; // 0 to 20
  home: HomeTag[];
  plan: Profile['plan'];
}
export type ProfileErrorCode =
  | 'name_required' | 'too_long' | 'pets_range' | 'too_many_contacts' | 'contact_phone_invalid';
export type SaveProfileResult =
  | { ok: true; value: Profile }
  | { ok: false; errors: { code: ProfileErrorCode | MemberErrorCode; field: string }[] }; // field path, e.g. "owner.name"

export interface ProfilesApi {
  active(): Profile | null; // null before setup
  create(input: NewHouseholdInput): SaveProfileResult; // first step of setup
  save(input: ProfileInput): SaveProfileResult;
  remove(id: string): Result<void, 'not_found'>; // deletes the household, its members' photos and ticks; setup starts again
}

export interface MemberInput {
  id?: string;   // omit to add
  name: string;  // name or nickname, 1 to 40 chars
  relation: Relation;
  ageGroup: AgeGroup;
  needs: NeedTag[];
  note?: string; // ≤ 80 chars
  phone?: string;
}
export type MemberErrorCode =
  | 'name_required' | 'too_long' | 'phone_invalid' | 'too_many_members' | 'owner_relation';
export type SaveMemberResult =
  | { ok: true; value: Member } // a new member starts with photoStatus 'pending'
  | { ok: false; errors: { code: MemberErrorCode; field: string }[] };

export interface MemberCardView { // "Hinahanap": shown full screen, offline
  member: Member;     // includes photo (or photoStatus 'pending') and note
  ownerName: string;
  ownerPhone?: string;
  evacuationCenter?: string;
  meetingPlace?: string;
}
export type ShareableView = unknown; // a React ref (RefObject<View>) of the rendered "Hinahanap" card; the engine captures it

export interface FamilyApi {
  members(): Member[];  // main person first
  pending(): Member[];  // members with photoStatus 'pending', main person first; Home shows copy('photo_pending') per member
  saveMember(input: MemberInput): SaveMemberResult; // re-derives tags and headcount; fires 'family' and 'checklist'
  removeMember(memberId: string): Result<void, 'not_found' | 'owner_required'>; // also deletes the photo file
  photos: PhotosApi;
  location: LocationApi;
  card(memberId: string): MemberCardView | null; // MVP
  // User tap only; the only way a member photo leaves the phone. The engine captures cardView to a PNG
  // and opens the Android share sheet (section 7, ShareService).
  shareCard(memberId: string, cardView: ShareableView): Promise<Result<void, 'not_found' | 'cancelled' | 'failed'>>;
}

export interface FaceBox { x: number; y: number; width: number; height: number } // 0 to 1, relative to the preview
export type CropRect = FaceBox; // square crop the user approved
export interface PhotoDraft {
  draftId: string;
  memberId: string;
  previewUri: string;          // temp downscaled copy; deleted on discard, expiry or app restart
  detection: FaceDetection;    // 'one_face' suggests the crop; anything else sends the user to manual crop
  faces: FaceBox[];            // left to right, at most 15; [] when none found or detection unavailable
  suggestedCrop: CropRect;     // around the one face, or centered otherwise
  expiresAt: string;           // 30 minutes
}
export type PhotoError =
  | 'permission_denied' | 'no_camera' | 'unreadable' | 'draft_expired' | 'not_found' | 'io';

export interface PhotosApi {
  start(target: { memberId: string }, source: 'camera' | 'gallery'): Promise<Result<PhotoDraft | null, PhotoError>>;
  save(draftId: string, crop: CropRect): Promise<Result<MemberPhoto, PhotoError>>;
  discard(draftId: string): void;
  remove(memberId: string): Result<void, 'not_found'>;
  removeAll(): void;
}

export interface PlaceOption { psgc: string; name: string; level: PlaceLevel; hasChildren: boolean }
export type LocationError =
  | 'permission_denied'
  | 'services_off'
  | 'unavailable'
  | 'unknown_place';
export interface LocationApi {
  get(): HouseholdLocation | null;
  places(parentPsgc?: string): PlaceOption[];
  setArea(psgc: string): Result<HouseholdLocation, 'unknown_place'>;
  useGps(): Promise<Result<HouseholdLocation, LocationError>>;
}

export type WarningInput =
  | { kind: 'tcws'; level: TcwsLevel }
  | { kind: 'rainfall' | 'surge'; level: ColorLevel }
  | { kind: 'gale' | 'barangay_order' };

export interface ContextApi {
  get(): Context;
  options(): WarningEntry[];
  cards(): WarningCard[];
  setPhase(phase: Phase): Context;
  undoPhase(): Result<Context, 'nothing_to_undo'>;
  setWarning(input: WarningInput): Context;
  clearWarning(kind: WarningKind): Context;
  reconfirmWarning(kind: WarningKind): Context;
}

export interface ChecklistApi {
  view(): ChecklistView;
  tick(itemId: string, ticked: boolean): Result<ChecklistView, 'unknown_item'>;
  reset(): ChecklistView;
}

export interface AskApi {
  run(question: string, opts?: AskOptions): AsyncIterable<AnswerEvent>;
  cancel(): void;
  warm(): void;
  readonly maxLength: 200;
}

export interface PassageCard { id: string; title: string; summary: string; topic: TopicGroup; critical: boolean }
export interface PassageDetail extends PassageCard {
  text: string; source: SourceRef; reviewedBy: string; reviewedAt: string; version: number;
}
export interface GuideApi {
  topics(): { topic: TopicGroup; count: number }[];
  byTopic(topic: TopicGroup): PassageCard[];
  passage(id: string): PassageDetail | null;
  sources(): Source[];
  reviewers(): { name: string; passages: number }[];
}

export interface EmergencyCardView { id: string; title: string; steps: string[]; hotlines: Hotline[]; source: SourceRef }
export interface EmergencyApi {
  card(id?: string): EmergencyCardView;
}

export interface PlanApi {
  hotlines(): Hotline[];
  call(hotlineIdOrPhone: string): Promise<Result<void, 'not_found' | 'no_dialer'>>;
}

export type FeedStatus = 'off' | 'empty' | 'fresh' | 'stale';
export interface FeedState {
  status: FeedStatus;
  refreshing: boolean;
  latest: BulletinCardView | null;
  fetchedAt?: string;
  checkedAt?: string;
  serverStale: boolean;
}
export type FeedError =
  | 'disabled' | 'offline' | 'http'
  | 'unknown_key' | 'key_expired' | 'bad_signature' | 'app_too_old'
  | 'rollback' | 'hash_mismatch' | 'schema';
export interface FeedApi {
  get(): FeedState;
  refresh(): Promise<Result<FeedState, FeedError>>;
}

export interface EvacuationView {
  householdCenter?: string;
  bulletin: BulletinCardView | null;
  storm: StormMeasure | null;
  centers: RankedCenter[];
  centersFirst: boolean;
  barangayCopyKey: 'barangay_decides';
  needsLocation: boolean;
}
export interface EvacuationApi {
  view(): EvacuationView;
}

export interface SettingsApi {
  get(): Settings;
  update(patch: Partial<Settings>): Result<Settings, 'out_of_range'>;
}

export interface HistoryApi {
  list(limit?: number): QuestionLogEntry[];
  clear(): void;
}

export interface EvalSummary {
  generatedAt: string;
  retrieval: { hitAt2: number; correctRefusal: number; emergencyTrigger: number; liveDataReply: number };
  answers: { faithfulness: number | null; numberCheckPass: number };
  phase: { casesPassed: number; casesTotal: number; wrongDirection: number };
  device: { summaryP50Ms?: number; firstWordsP50Ms?: number; fullAnswerP50Ms?: number; peakRamMb?: number };
}
export interface EvaluationApi {
  summary(): EvalSummary | null;
}

export interface PacksApi {
  installed(): InstalledPack[];
  importFromPicker(): Promise<Result<ImportPreview | null, PackError>>;
  importFile(uri: string): Promise<Result<ImportPreview, PackError>>;
  apply(previewId: string): Promise<Result<ApplyResult, PackError | 'io'>>;
  rollback(packId: string): Promise<Result<void, 'io' | 'nothing_to_roll_back'>>;
}

export interface UpdatesApi {
  pending(): UpdatePlan | null;
  check(): Promise<Result<UpdatePlan | null, UpdateError>>;
  download(planId: string, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<ImportPreview, UpdateError>>;
  networkLog(): NetworkLogEntry[];
}

export type AccountState =
  | { signedIn: false }
  | { signedIn: true; email: string; lastSyncAt: string | null; syncEnabled: boolean };
export interface AccountApi {
  state(): AccountState;
  signUp(input: { email: string; password: string }): Promise<Result<AccountState, AccountError>>;
  signIn(input: { email: string; password: string }): Promise<Result<AccountState, AccountError>>;
  signOut(): Result<void, 'not_signed_in'>;
  sendReset(email: string): Promise<Result<'sent', AccountError>>;
  setSync(enabled: boolean): Result<AccountState, 'not_signed_in'>;
}

export interface ModelApi {
  /** Settings "I-download ang AI": fetches the GGUF from Hugging Face (logged in `updates.networkLog()`), checks size and SHA-256. */
  download(onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<'installed', ModelInstallError>>;
  installFromPicker(onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<'installed' | null, ModelInstallError>>;
  remove(): Promise<void>;
}

export interface ScreenApi {
  sosOn(): Promise<void>;
  sosOff(): Promise<void>;
}

export interface DamageInput {
  damageType: DamageType;
  severity: DamageSeverity;
  affectedMembers: number; // a count, never names
  notes?: string;          // ≤ 300 chars
}
export interface DamageApi {
  list(): DamageDraft[];
  save(input: DamageInput & { id?: string }): Result<DamageDraft, 'invalid' | 'io'>;
  addPhoto(id: string, source: 'camera' | 'gallery'): Promise<Result<DamageDraft | null, PhotoError | 'too_many_photos'>>;
  removePhoto(id: string, index: number): Result<DamageDraft, 'not_found'>;
  send(id: string): Promise<Result<'sent', 'offline' | 'not_opted_in' | 'http' | 'not_found'>>;
  remove(id: string): void;
}

export type MockScenario =
  | 'guide_full' | 'guide_critical' | 'emergency_then_guide' | 'refusal'
  | 'live_data' | 'live_data_bulletin' | 'medical_dose'
  | 'plan_center' | 'plan_empty' | 'ai_rejected' | 'low_battery' | 'no_model'
  | 'phase_cue_during' | 'phase_cue_after';

export interface MockOptions {
  scenario?: MockScenario;      // force one scenario for every question
  speed?: 'realistic' | 'fast'; // 'fast' removes all delays, for tests
}

export interface MockEngine extends Engine {
  debug: {
    setScenario(s: MockScenario | null): void;     // null goes back to picking by keyword
    setStatus(patch: Partial<EngineStatus>): void; // e.g. battery 10%, tier 'lite'; fires onChange('status')
    emit(change: EngineChange): void;
    // the next family.photos.start() result: a draft with that detection, or an error
    setPhotoResult(r: FaceDetection | PhotoError): void;
    // the next family.location.useGps() result
    setLocationResult(r: 'ok' | LocationError): void;
    // the feed state; 'near', 'signal_here', 'track_approach' and 'left' swap in a variant of the sample bulletin
    // and run the phase rules as if bands were sourced, so the automatic switch and banner can be seen
    setFeed(f: 'off' | 'empty' | 'fresh' | 'stale' | 'near' | 'signal_here' | 'track_approach' | 'left' | FeedError): void;
    // the next model.installFromPicker() result
    setModelInstallResult(r: 'installed' | ModelInstallError): void;
    reset(): void; // restore the fixtures
  };
}
