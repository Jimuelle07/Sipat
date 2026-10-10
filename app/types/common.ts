import type { EvacuationCenter } from './content.ts';

export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: E; message: string } };

export type CopyKey =
  | 'closing'          // "Sundin ang utos ng barangay at ng mga awtoridad."
  | 'refusal'           // "Wala ito sa gabay."
  | 'source_link'       // "Saan galing ito?"
  | 'no_live_data'      // "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay."
  | 'stale_warning'     // "Makinig muli sa radyo. Baka nagbago na ang signal."
  | 'medical_dose'      // draft: "Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor."
  | 'phase_before' | 'phase_during' | 'phase_after' // "Bago ang bagyo", "Habang may bagyo", "Pagkatapos ng bagyo"
  | 'phase_switched'    // draft: "Lumipat sa {phase}." (button "Ibalik")
  | 'bulletin_age'      // draft: "Inilabas ng PAGASA: {issuedAt}. Na-download: {fetchedAt}. Makinig pa rin sa radyo."
  | 'barangay_decides'  // draft: "Ang barangay ang magsasabi kung kailan lilikas."
  | 'photo_consent'     // draft: "Siguraduhing pumayag ang tao bago kunan ng litrato."
  | 'photo_required'    // draft: "Kailangan ang litrato ng mukha para makilala kung sakaling mawalay. Puwedeng mamaya na."
  | 'photo_pending'     // draft: "Kulang pa ang litrato ni {name}."
  | 'location_button'   // draft: "Gamitin ang lokasyon ng telepono"
  | 'aid_notice';       // draft: "Gabay sa paghahanda ang Sipat. Hindi ito serbisyong pang-emergency at hindi ito forecast."

export type Phase = 'before' | 'during' | 'after'; // caution order: during > before > after
export type PhaseSource = 'manual' | 'warning' | 'ask' | 'bulletin';

export type PhaseInputKey =
  | `warning:${string}`
  | `ask:${string}`
  | `bulletin:${string}`
  | `storm:${string}`;

export interface PhaseReason {
  source: PhaseSource;
  input?: PhaseInputKey;
  text: string;
}

export interface PhaseRecommendation {
  phase: Phase;
  reason: PhaseReason;
}

export interface PhaseSwitch {
  from: Phase;
  to: Exclude<Phase, 'after'>;
  source: Exclude<PhaseSource, 'manual'>;
  input: PhaseInputKey;
  at: string;
}

export interface PhaseUndo {
  phase: Phase;
  phaseSource: PhaseSource;
  reason: PhaseReason;
  warnings: ActiveWarnings;
  cause?: PhaseInputKey;
}

export interface PhaseState {
  phase: Phase;
  phaseSource: PhaseSource;
  reason: PhaseReason;
  changedAt: string;
  recommended: PhaseRecommendation | null;
  lastSwitch?: PhaseSwitch;
  undo?: PhaseUndo;
  suppressed: PhaseInputKey[];
}

export type WarningKind = 'tcws' | 'rainfall' | 'surge' | 'gale' | 'barangay_order';
export type TcwsLevel = 1 | 2 | 3 | 4 | 5;
export type ColorLevel = 'yellow' | 'orange' | 'red'; // ordered: yellow < orange < red

export interface ActiveWarnings {
  tcws?: { level: TcwsLevel; setAt: string };
  rainfall?: { level: ColorLevel; setAt: string };
  surge?: { level: ColorLevel; setAt: string };
  gale?: { setAt: string };
  barangay_order?: { setAt: string };
}

export interface Context extends PhaseState {
  warnings: ActiveWarnings;
}

export type MemberTag = 'infant' | 'child' | 'pregnant' | 'senior' | 'pwd' | 'maintenance_meds' | 'pets';
export type HomeTag =
  | 'near_river' | 'near_sea' | 'slope' | 'low_lying' | 'light_materials' | 'concrete' | 'upper_floor';
export type ProfileTag = MemberTag | HomeTag;
export type HazardTag = 'wind' | 'flood' | 'surge' | 'landslide' | 'electrical' | 'water' | 'health' | 'fire' | 'gas';

export type TopicGroup =
  | 'signals' | 'go_bag' | 'home_prep' | 'evacuation' | 'flood' | 'surge' | 'landslide'
  | 'infant' | 'senior' | 'pregnancy' | 'disability' | 'pets' | 'water_food' | 'electrical'
  | 'generator_fire' | 'gas_safety' | 'cleanup' | 'health_after_flood' | 'first_aid'
  | 'psychosocial' | 'damage_report' | 'assistance' | 'out_of_guide';

export interface Contact {
  name: string;
  phone: string;
  relation?: string;
}

export type AgeGroup = 'infant' | 'child' | 'teen' | 'adult' | 'senior'; // <1, 1–12, 13–17, 18–59, 60+
export type Relation =
  | 'self' | 'spouse' | 'child' | 'parent' | 'grandparent' | 'grandchild' | 'sibling' | 'relative' | 'other';
export type NeedTag = 'pregnant' | 'pwd' | 'maintenance_meds';

export type PhotoStatus = 'done' | 'pending';
export type FaceCheck = 'one_face' | 'manual';
export type FaceDetection =
  | 'one_face'
  | 'no_face'
  | 'many_faces'
  | 'unavailable';

export interface MemberPhoto {
  uri: string;          // app-private file, 512 × 512 JPEG, no EXIF, excluded from cloud backup
  bytes: number;        // target ≤ 150 KB
  source: 'camera' | 'gallery';
  faceCheck: FaceCheck;
  takenAt: string;
  version: number;
}

export interface Member {
  id: string;
  name: string;         // name or nickname, 1 to 40 chars
  relation: Relation;   // exactly one member per household is 'self', the main person
  ageGroup: AgeGroup;
  needs: NeedTag[];
  note?: string;        // ≤ 80 chars, e.g. medicine names or allergies; on the phone only
  phone?: string;
  photoStatus: PhotoStatus;
  photo?: MemberPhoto;
  updatedAt: string;
}

export interface LatLon { lat: number; lon: number }
export interface HouseholdLocation {
  psgc: string;
  coords?: LatLon & { accuracyM: number; at: string };
}
export type PlaceLevel = 'region' | 'province' | 'city' | 'municipality' | 'barangay';
export interface HomePoint {
  point: LatLon;
  from: 'gps' | 'area';
  areaCodes: string[];
}

export interface Profile {
  id: string;
  name: string;               // "Bahay namin", "Bahay nina Lola"; ≤ 60 chars
  ownerId: string;            // Member.id of the main person
  people: Member[];           // main person first; 1 to 30
  petsCount: number;          // 0 to 20
  headcount: number;          // derived: people.length; read-only
  members: MemberTag[];       // derived by deriveHousehold from people and petsCount; read-only
  home: HomeTag[];
  location: HouseholdLocation | null;
  plan: {
    evacuationCenter?: string;   // typed name, ≤ 60 chars (MVP core)
    evacuationCenterId?: string; // EvacuationCenter.id when the user picks a recommended center (MVP stretch)
    meetingPlace?: string;       // ≤ 60 chars
    contacts: Contact[];         // at most 5
  };
  updatedAt: string;
}

export type StormCategory = 'TD' | 'TS' | 'STS' | 'TY' | 'STY'; // PAGASA: depression, storm, severe storm, typhoon, super typhoon
export interface Bulletin {
  id: string;
  stormId: string;
  source: { agency: 'PAGASA'; title: string; url: string };
  issuedAt: string;
  scrapedAt: string;
  fetchedAt: string;
  storm: { name: string; internationalName?: string; category: StormCategory };
  position: LatLon & { at: string; text: string };
  movement?: { text: string };
  forecast: (LatLon & { at: string })[];
  signalAreas: { level: TcwsLevel; psgc: string[] }[];
  final: boolean;
  text: string;
}

export interface BulletinCardView {
  bulletin: Bulletin;
  issuedHoursAgo: number;
  fetchedHoursAgo: number;
  stale: boolean;
  ageText: string;
}

export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export interface StormFix { at: string; distanceKm: number; bearingDeg: number; direction: CompassPoint }
export interface StormMeasure {
  bulletinId: string;
  from: HomePoint['from'];
  now: StormFix;
  forecast: StormFix[];
  closestKm: number;
  signalHere: TcwsLevel | null;
}
export type DistanceBand = 'near' | 'approach' | 'outside';

export interface RankedCenter {
  center: EvacuationCenter;
  distanceKm: number;
  direction: CompassPoint;
}

export type DeviceTier = 'full' | 'lite' | 'none';
export type UiLanguage = 'tl' | 'en';

export interface Settings {
  language: UiLanguage;
  lowBatteryThreshold: number; // percent, default 15
  aiEnabled: boolean;
  lowBatteryMode: boolean;
  staleWarningHours: number;
  feedEnabled: boolean;
  autoCheckUpdates: boolean;
  wifiOnly: boolean;
  topicReportsOptIn: boolean;
  damageReportsOptIn: boolean;
}
