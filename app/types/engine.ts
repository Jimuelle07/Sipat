import type { AgeGroup, Context, CopyKey, DeviceTier, FaceCheck, HomeTag, LivelihoodTag, Member, MemberPhoto, NeedTag, Phase, Profile, Relation, Result, Settings, TcwsLevel, ColorLevel, TopicGroup, WarningKind, UiLanguage } from './common.ts';
import type { EvacuationCenter, Hotline, QuestionLogEntry, Source, WarningEntry } from './content.ts';
import type { ChecklistView } from './core.ts';
import type { AnswerEvent, AskOptions, SourceRef } from './ask.ts';
import type { AiDecision, ApplyResult, ImportPreview, InstalledPack, ModelState, NetworkLogEntry, PackError, TextKind, UpdateError, UpdatePlan } from './services.ts';

// src/engine/types.ts mirrors this section. Change both in the same commit.
export const ENGINE_API_VERSION = 1;

export interface Engine {
  init(): Promise<Result<EngineInfo, 'content_invalid' | 'storage_failed'>>; // once, behind the splash screen
  info(): EngineInfo;
  status(): EngineStatus;
  copy(key: CopyKey, lang?: UiLanguage): string; // 'tl' default; 'en' is a translation shown under the Tagalog
  onChange(listener: (change: EngineChange) => void): () => void; // returns unsubscribe

  profiles: ProfilesApi;
  family: FamilyApi;   // members (MVP); photos, roll call and cards (MVP stretch)
  context: ContextApi;
  checklist: ChecklistApi;
  ask: AskApi;
  guide: GuideApi;
  emergency: EmergencyApi;
  plan: PlanApi;
  settings: SettingsApi;
  history: HistoryApi;
  evaluation: EvaluationApi;
  packs: PacksApi;     // MVP stretch
  updates: UpdatesApi; // Pilot
}

export type EngineChange =
  | 'profiles' | 'family' | 'context' | 'checklist' | 'settings' | 'status' | 'history' | 'packs' | 'updates';

export interface EngineInfo {
  appVersion: string;
  engineApiVersion: number;
  guideDate: string; // YYYY-MM-DD, shown on About
  passagesCount: number;
  sourcesCount: number;
  packs: InstalledPack[];
  model: { fileName: string; sizeBytes: number; present: boolean; attribution: 'Built with Llama' };
}

export interface EngineStatus {
  tier: DeviceTier;
  model: ModelState;
  ai: AiDecision; // allowed, or the reason it is not
  battery: { level: number; charging: boolean; saver: boolean } | null; // null until the first reading
  stale?: { kind: WarningKind; hoursSinceSet: number };
  updateAvailable?: { totalBytes: number; guideDate?: string }; // Pilot
}

// Profiles: family setup, Profile and Plan screens.
// A household is created together with its main person; other members go through engine.family.
// There is no online account: the household exists only on this phone.
export interface NewHouseholdInput {
  name: string;       // "Bahay namin"
  owner: MemberInput; // the main person; relation is forced to 'self'
}
export interface ProfileInput { // household-level fields only
  id: string;
  name: string;
  petsCount: number;            // 0 to 20
  home: HomeTag[];
  livelihood?: LivelihoodTag[]; // Later
  area?: Profile['area'];       // Pilot
  plan: Profile['plan'];
}
export type ProfileErrorCode =
  | 'name_required' | 'too_long' | 'pets_range' | 'too_many_contacts' | 'contact_phone_invalid';
export type SaveProfileResult =
  | { ok: true; value: Profile }
  | { ok: false; errors: { code: ProfileErrorCode | MemberErrorCode; field: string }[] }; // field path, e.g. "owner.name"

export interface ProfilesApi {
  list(): Profile[];
  active(): Profile | null; // null before setup
  create(input: NewHouseholdInput): SaveProfileResult; // first step of setup; the new household becomes active
  save(input: ProfileInput): SaveProfileResult;
  setActive(id: string): Result<void, 'not_found'>;
  remove(id: string): Result<void, 'not_found' | 'last_profile'>; // deletes its members' photos too
}

// Family: member editor, photo screens, "Bilangan" and "Hinahanap". Always the active household.
export interface MemberInput {
  id?: string;      // omit to add
  name: string;     // name or nickname, 1 to 40 chars
  relation: Relation;
  ageGroup: AgeGroup;
  needs: NeedTag[];
  note?: string;    // ≤ 80 chars
  phone?: string;
}
export type MemberErrorCode =
  | 'name_required' | 'too_long' | 'phone_invalid' | 'too_many_members' | 'owner_relation';
export type SaveMemberResult =
  | { ok: true; value: Member }
  | { ok: false; errors: { code: MemberErrorCode; field: string }[] };

export interface MemberCardView { // "Hinahanap": shown full screen, offline
  member: Member;     // includes photo and note
  ownerName: string;
  ownerPhone?: string;
  evacuationCenter?: string;
  meetingPlace?: string;
}
export interface RollCallView { // "Bilangan"
  entries: { member: Member; present: boolean; at?: string }[]; // main person first
  presentCount: number;
  total: number;
}

export interface FamilyApi {
  members(): Member[]; // main person first
  saveMember(input: MemberInput): SaveMemberResult; // re-derives tags and headcount; fires 'family' and 'checklist'
  removeMember(memberId: string): Result<void, 'not_found' | 'owner_required'>; // also deletes the photo file
  photos: PhotosApi;   // MVP stretch
  card(memberId: string): MemberCardView | null;                                       // MVP stretch
  shareCard(memberId: string): Promise<Result<void, 'not_found' | 'cancelled' | 'failed'>>; // user tap only
  rollCall(): RollCallView;                                                            // MVP stretch
  markPresent(memberId: string, present: boolean): Result<RollCallView, 'not_found'>;
  resetRollCall(): RollCallView;
}

// Photos (MVP stretch). Face detection only finds boxes to crop; it never identifies anyone.
export interface FaceBox { x: number; y: number; width: number; height: number } // 0 to 1, relative to the preview
export type CropRect = FaceBox; // square crop the user approved
export interface PhotoDraft {
  draftId: string;
  previewUri: string;     // temp downscaled copy; deleted on discard, expiry or app restart
  faces: FaceBox[];       // left to right, at most 15; [] when none found or detection unavailable
  faceCheck: FaceCheck;
  suggestedCrop: CropRect; // around the face, or centered when there is none
  expiresAt: string;      // 30 minutes
}
export type PhotoError =
  | 'permission_denied' | 'no_camera' | 'unreadable' | 'draft_expired' | 'not_found' | 'io';

export interface PhotosApi {
  // Opens the system camera (asks CAMERA permission on first use) or the system photo picker.
  // 'group' takes one family photo whose faces the user assigns to members. null: the user backed out.
  start(target: { memberId: string } | 'group', source: 'camera' | 'gallery'):
    Promise<Result<PhotoDraft | null, PhotoError>>;
  // Crops to 512 × 512 JPEG without EXIF and attaches it to the member, replacing any old photo.
  // For a group draft, call once per assigned face with that face's crop.
  save(draftId: string, memberId: string, crop: CropRect): Promise<Result<MemberPhoto, PhotoError>>;
  discard(draftId: string): void; // call when the photo screen closes; deletes the preview and unused crops
  remove(memberId: string): Result<void, 'not_found'>;
  removeAll(): void;              // "Burahin ang lahat ng litrato"
}

// Context: the Home screen's phase buttons and the "Ano ang narinig mo?" picker
export type WarningInput =
  | { kind: 'tcws'; level: TcwsLevel }
  | { kind: 'rainfall' | 'surge'; level: ColorLevel }
  | { kind: 'gale' };

export interface ContextApi {
  get(): Context;
  options(): WarningEntry[];                    // every picker choice, in display order
  setPhase(phase: Phase): Context;              // 'after' clears all warnings
  setWarning(input: WarningInput): Context;     // replaces the same kind; setAt = now
  clearWarning(kind: WarningKind): Context;
  reconfirmWarning(kind: WarningKind): Context; // "Pareho pa rin": resets setAt and clears the stale banner
}

// Checklist screen
export interface ChecklistApi {
  view(): ChecklistView; // for the active profile and context
  tick(itemId: string, ticked: boolean): Result<ChecklistView, 'unknown_item'>;
  reset(): ChecklistView; // clears the active profile's ticks
}

// Ask screen
export interface AskApi {
  run(question: string, opts?: AskOptions): AsyncIterable<AnswerEvent>; // event order: section 6
  cancel(): void; // ends the current stream with done { outcome: 'cancelled' }
  warm(): void;   // call when the Ask screen gains focus; does nothing if AI is not allowed
  readonly maxLength: 200;
}

// Guide topics screen and "Saan galing ito?"
export interface PassageCard { id: string; title: string; summary: string; topic: TopicGroup; critical: boolean }
export interface PassageDetail extends PassageCard {
  text: string; source: SourceRef; reviewedBy: string; reviewedAt: string; version: number;
}
export interface GuideApi {
  topics(): { topic: TopicGroup; count: number }[]; // the UI maps each topic to its label
  byTopic(topic: TopicGroup): PassageCard[];
  passage(id: string): PassageDetail | null;
  sources(): Source[]; // About screen
}

// Emergency card: opened from Home, or delivered by an emergency_card event
export interface EmergencyCardView { id: string; title: string; steps: string[]; hotlines: Hotline[]; source: SourceRef }
export interface EmergencyApi {
  card(id?: string): EmergencyCardView; // the default card when id is omitted
}

// Plan and texts screen
export interface PlanApi {
  hotlines(): Hotline[];                   // national; the Pilot adds the LGU's
  evacuationCenters(): EvacuationCenter[]; // Pilot; [] in the MVP
  call(hotlineId: string): Promise<Result<void, 'not_found' | 'no_dialer'>>; // opens the dialer
  textPreview(kind: TextKind, opts: { where?: string }): string; // the body the SMS app will open with
  composeText(kind: TextKind, opts: { to: string[]; where?: string }):
    Promise<Result<void, 'no_recipients' | 'no_sms_app'>>; // MVP stretch
  exportPlan(): Promise<Result<void, 'cancelled' | 'failed'>>; // Pilot: printable plan
}

// Settings screen
export interface SettingsApi {
  get(): Settings;
  update(patch: Partial<Settings>): Result<Settings, 'out_of_range'>; // lowBatteryThreshold 5–50, staleWarningHours 1–12 (proposals)
}

// Question history, cleared from Settings
export interface HistoryApi {
  list(limit?: number): QuestionLogEntry[]; // newest first
  clear(): void;
}

// Evaluation screen
export interface EvalSummary {
  generatedAt: string;
  retrieval: { hitAt2: number; correctRefusal: number; emergencyTrigger: number; liveDataReply: number };
  answers: { faithfulness: number | null; numberCheckPass: number }; // faithfulness comes from the two-person review
  device: { summaryP50Ms?: number; firstWordsP50Ms?: number; fullAnswerP50Ms?: number; peakRamMb?: number };
}
export interface EvaluationApi {
  summary(): EvalSummary | null; // the laptop report bundled at build time, plus on-device timings
}

// Packs (MVP stretch): Settings and About
export interface PacksApi {
  installed(): InstalledPack[];
  importFromPicker(): Promise<Result<ImportPreview | null, PackError>>; // null when the user closes the picker
  importFile(uri: string): Promise<Result<ImportPreview, PackError>>;   // a file shared into the app
  apply(previewId: string): Promise<Result<ApplyResult, PackError | 'io'>>;
  rollback(packId: string): Promise<Result<void, 'io' | 'nothing_to_roll_back'>>;
  share(): Promise<Result<void, 'no_pack' | 'cancelled'>>;
}

// Updates (Pilot): Home banner, Settings and About
export interface UpdatesApi {
  pending(): UpdatePlan | null; // set by the auto-check; drives "May bagong gabay. I-download?"
  check(): Promise<Result<UpdatePlan | null, UpdateError>>; // user-triggered
  download(planId: string, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal):
    Promise<Result<ImportPreview, UpdateError>>; // then packs.apply(previewId)
  networkLog(): NetworkLogEntry[];
}

export type MockScenario =
  | 'guide_full' | 'guide_critical' | 'emergency_then_guide' | 'refusal' | 'live_data' | 'medical_dose'
  | 'plan_center' | 'plan_empty' | 'ai_rejected' | 'low_battery' | 'no_model';

export interface MockOptions {
  scenario?: MockScenario;      // force one scenario for every question
  speed?: 'realistic' | 'fast'; // 'fast' removes all delays, for tests
}

export interface MockEngine extends Engine {
  debug: {
    setScenario(s: MockScenario | null): void;     // null goes back to picking by keyword
    setStatus(patch: Partial<EngineStatus>): void; // e.g. battery 10%, tier 'lite'; fires onChange('status')
    emit(change: EngineChange): void;
    // the next family.photos.start() result: a draft with 1, 0, 2 or 3 faces, or an error
    setPhotoResult(r: 'one_face' | 'no_face' | 'many_faces' | 'group_3' | PhotoError): void;
    reset(): void;                                 // restore the fixtures
  };
}
