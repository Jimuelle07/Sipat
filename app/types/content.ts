import type { Phase, TcwsLevel, ColorLevel, WarningKind, TopicGroup, ProfileTag, HazardTag } from './common.ts';
import type { ChecklistGroupId, PlanField, RouteResult, VerifierFailure } from './core.ts';
import type { AiSkipReason, Outcome, Timings } from './ask.ts';

export type ContentFileName =
  | 'guide.tl.json' | 'checklist.json' | 'warnings.json' | 'synonyms.json' | 'intents.json'
  | 'sources.json' | 'hotlines.json'
  | 'places.json'                                                      // Pilot
  | 'evacuation_centers.json' | 'advisories.json' | 'hazard_notes.json'; // LGU packs, Pilot

export interface ContentFile<T> {
  schema_version: number;
  content_version: number; // the pack version that produced this file
  generated_at: string;
  items: T[];
}

export interface Passage {
  id: string;
  lang: 'tl' | 'en';
  title: string;
  topic: TopicGroup;
  phase: Phase[];
  warnings: { tcws: TcwsLevel[]; rainfall: ColorLevel[]; surge: ColorLevel[]; gale: boolean }; // [] = any level
  profile_tags: ProfileTag[];
  hazards: HazardTag[];
  critical: boolean;
  text: string;        // 60 to 120 words, one topic, plain Tagalog
  summary: string;     // one human-written sentence; shown first and used as the fallback
  source_id: string;   // Source.id
  locator: string;     // page or section in the source
  reviewed_by: string;
  reviewed_at: string; // YYYY-MM-DD
  version: number;     // goes up on every edit
}

export interface ChecklistItem {
  id: string;
  text: string;
  group: ChecklistGroupId;
  phase: Phase[];
  when?: { tcws_min?: TcwsLevel; rainfall_min?: ColorLevel; surge_min?: ColorLevel; gale?: true };
  requires_any?: ProfileTag[];
  excludes?: ProfileTag[];
  priority: 1 | 2 | 3; // 1 = life safety
  critical: boolean;
  quantity?: { per: 'person' | 'household' | 'infant'; amount: number; unit: string; days?: number };
  source_id: string;
}

export interface WarningEntry {
  id: string; // "tcws-3", "rainfall-orange", "surge-red", "gale"
  kind: WarningKind;
  level: TcwsLevel | ColorLevel | 'on';
  label: string; // shown on the "Ano ang narinig mo?" picker
  thresholds?: {
    wind_kmh?: [number, number | null];        // null = no upper bound
    rain_mm_per_hour?: [number, number | null];
    surge_m?: [number, number | null];
  };
  lead_time_h?: number; // tcws only
  meaning: string;      // Tagalog, from the source
  actions: string[];    // short Tagalog actions, from the source
  source_id: string;
  confirmed: boolean;   // false until checked against PAGASA's current page
}

export interface SynonymEntry {
  canonical: string; // token added to the query
  forms: string[];   // inflections, Taglish, English (MVP stretch)
  lang: 'tl' | 'en';
  topic?: TopicGroup; // hint for refusal suggestions
}

export interface EmergencyCard {
  id: string;
  title: string;
  steps: string[];       // Tagalog, from the source
  hotline_ids: string[]; // rendered from hotlines.json, never typed into steps
  source_id: string;
}

export interface IntentRules {
  emergency: { phrases: string[]; card_id: string };
  live_data: { phrases: string[]; reply_key: 'no_live_data' };
  medical_dose: { phrases: string[]; reply_key: 'medical_dose' };
  plan: Record<PlanField, string[]>;
  emergency_cards: EmergencyCard[];
}

export interface IntentsFile {
  schema_version: number;
  content_version: number;
  generated_at: string;
  rules: IntentRules;
}

export interface Source {
  id: string; agency: string; title: string; date: string; url: string; retrieved_at: string; notes?: string;
}

export interface Hotline {
  id: string;
  name: string;
  number: string; // digits, optional leading +
  scope: 'national' | 'lgu';
  psgc?: string;  // required when scope is 'lgu'
  hours?: string;
  source_id: string;
  verified_at: string;
}

export interface EvacuationCenter { // Pilot, LGU packs
  id: string; name: string; barangay_code: string; landmark: string;
  capacity?: number; accessible?: boolean; accepts_pets?: boolean; updated_at: string;
}

export interface Advisory { // Pilot, LGU packs
  id: string;
  psgc: string;
  kind: 'standing' | 'time_bound';
  title: string;
  text: string;
  issued_at: string;
  expires_at?: string; // required when kind is 'time_bound'; the app hides expired advisories
  issued_by: string;
}

export interface HazardNote { // Pilot, LGU packs
  id: string; barangay_code: string; hazards: HazardTag[]; text: string; updated_at: string;
}

export interface QuestionLogEntry {
  id: string;
  at: string;
  question: string;
  route: RouteResult['primary'];
  emergency: boolean;
  topIds: string[];
  topScore: number;
  gatePassed: boolean;
  outcome: Outcome;
  failures: VerifierFailure[];
  aiSkipReason?: AiSkipReason;
  timings: Timings;
}

export interface BundledContent {
  passages: Passage[];
  checklist: ChecklistItem[];
  warnings: WarningEntry[];
  synonyms: SynonymEntry[];
  rules: IntentRules;
  sources: Source[];
  hotlines: Hotline[];
}
