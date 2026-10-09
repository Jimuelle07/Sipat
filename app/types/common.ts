export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: E; message: string } };

export type CopyKey =
  | 'closing'       // "Sundin ang utos ng barangay at ng mga awtoridad."
  | 'refusal'       // "Wala ito sa gabay."
  | 'source_link'   // "Saan galing ito?"
  | 'no_live_data'  // "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay."
  | 'stale_warning' // "Makinig muli sa radyo. Baka nagbago na ang signal."
  | 'medical_dose'; // draft: "Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor."

export type Phase = 'before' | 'during' | 'after';

export type WarningKind = 'tcws' | 'rainfall' | 'surge' | 'gale';
export type TcwsLevel = 1 | 2 | 3 | 4 | 5;
export type ColorLevel = 'yellow' | 'orange' | 'red'; // ordered: yellow < orange < red

export interface ActiveWarnings {
  tcws?: { level: TcwsLevel; setAt: string };
  rainfall?: { level: ColorLevel; setAt: string };
  surge?: { level: ColorLevel; setAt: string };
  gale?: { setAt: string }; // present means on
}

export interface Context {
  phase: Phase;
  warnings: ActiveWarnings; // cleared when the user switches to 'after'
}

export type MemberTag = 'infant' | 'child' | 'pregnant' | 'senior' | 'pwd' | 'maintenance_meds' | 'pets';
export type HomeTag =
  | 'near_river' | 'near_sea' | 'slope' | 'low_lying' | 'light_materials' | 'concrete' | 'upper_floor';
export type LivelihoodTag = 'fisherfolk' | 'farmer'; // Later
export type ProfileTag = MemberTag | HomeTag | LivelihoodTag;
export type HazardTag = 'wind' | 'flood' | 'surge' | 'landslide' | 'electrical' | 'water' | 'health' | 'fire';

export type TopicGroup =
  | 'signals' | 'go_bag' | 'home_prep' | 'evacuation' | 'flood' | 'surge' | 'landslide'
  | 'infant' | 'senior' | 'pregnancy' | 'disability' | 'pets' | 'water_food' | 'electrical'
  | 'generator_fire' | 'cleanup' | 'health_after_flood' | 'out_of_guide';

export interface Contact {
  name: string;      // ≤ 60 chars
  phone: string;     // as typed by the user
  relation?: string; // ≤ 60 chars
}

// Family members (README H1 to H5)
export type AgeGroup = 'infant' | 'child' | 'teen' | 'adult' | 'senior'; // <1, 1–12, 13–17, 18–59, 60+
export type Relation =
  | 'self' | 'spouse' | 'child' | 'parent' | 'grandparent' | 'grandchild' | 'sibling' | 'relative' | 'other';
export type NeedTag = 'pregnant' | 'pwd' | 'maintenance_meds';
export type FaceCheck = 'one_face' | 'no_face' | 'many_faces' | 'skipped';

export interface MemberPhoto { // MVP stretch
  uri: string;       // app-private file, 512 × 512 JPEG, no EXIF
  bytes: number;     // target ≤ 150 KB
  source: 'camera' | 'gallery' | 'group';
  faceCheck: FaceCheck; // result when the photo was taken; skipped if detection was unavailable
  takenAt: string;
  version: number;   // goes up when the photo is replaced
}

export interface Member {
  id: string;
  name: string;      // name or nickname, 1 to 40 chars
  relation: Relation; // exactly one member per household is 'self', the main person
  ageGroup: AgeGroup;
  needs: NeedTag[];
  note?: string;     // ≤ 80 chars, e.g. medicine names or allergies; on the phone only
  phone?: string;
  photo?: MemberPhoto;
  updatedAt: string;
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
  livelihood: LivelihoodTag[]; // Later; [] until then
  area?: { provinceCode: string; municipalityCode?: string; barangayCode?: string }; // PSGC
  plan: {
    evacuationCenter?: string;   // typed name, ≤ 60 chars
    evacuationCenterId?: string; // EvacuationCenter.id from an LGU pack (Pilot)
    meetingPlace?: string;       // ≤ 60 chars
    contacts: Contact[];         // at most 5
  };
  updatedAt: string;
}

export type DeviceTier = 'full' | 'lite' | 'none';
export type UiLanguage = 'tl' | 'en';

export interface Settings {
  language: UiLanguage;         // default 'tl'
  lowBatteryThreshold: number; // percent, default 15
  aiEnabled: boolean;          // default true
  staleWarningHours: number;   // default 3
  autoCheckUpdates: boolean;   // Pilot, default true
  wifiOnly: boolean;           // Pilot, default true
  topicReportsOptIn: boolean;  // Pilot, default false
}
