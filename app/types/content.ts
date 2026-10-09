import type {
  AiSkipReason,
  ChecklistGroupId,
  ColorLevel,
  DeviceTier,
  HazardTag,
  Outcome,
  PackKind,
  Phase,
  PhaseDecision,
  PlanField,
  PlaceLevel,
  ProfileTag,
  RouteResult,
  StormCategory,
  TcwsLevel,
  Timings,
  TopicGroup,
  VerifierFailure,
  WarningKind,
} from './index.ts';

export type ContentFileName =
  | 'guide.tl.json' | 'checklist.json' | 'warnings.json' | 'synonyms.json' | 'intents.json'
  | 'sources.json' | 'hotlines.json' | 'phase_rules.json' | 'places.json'
  | 'evacuation_centers.json'
  | 'advisories.json' | 'hazard_notes.json';

export interface ContentFile<T> {
  schema_version: number;
  content_version: number;
  generated_at: string;
  items: T[];
}

export interface Passage {
  id: string;
  lang: 'tl';
  title: string;
  topic: TopicGroup;
  phase: Phase[];
  warnings: {
    tcws: TcwsLevel[];
    rainfall: ColorLevel[];
    surge: ColorLevel[];
    gale: boolean;
    barangay_order: boolean;
  };
  profile_tags: ProfileTag[];
  hazards: HazardTag[];
  critical: boolean;
  text: string;        // 60 to 120 words, one topic, plain Tagalog
  summary: string;     // one human-written sentence; shown first and used as the fallback
  source_id: string;   // Source.id
  locator: string;     // page or section in the source
  reviewed_by: string;
  reviewed_at: string; // YYYY-MM-DD
  version: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  group: ChecklistGroupId;
  phase: Phase[];
  when?: {
    tcws_min?: TcwsLevel;
    rainfall_min?: ColorLevel;
    surge_min?: ColorLevel;
    gale?: true;
    barangay_order?: true;
  };
  requires_any?: ProfileTag[];
  excludes?: ProfileTag[];
  priority: 1 | 2 | 3;
  critical: boolean;
  source_id: string;
}

export interface WarningEntry {
  id: string;
  kind: WarningKind;
  level: TcwsLevel | ColorLevel | 'on';
  label: string;
  thresholds?: {
    wind_kmh?: [number, number | null];
    rain_mm_per_hour?: [number, number | null];
    surge_m?: [number, number | null];
  };
  lead_time_h?: number;
  meaning: string;
  actions: string[];
  source_id: string;
  confirmed: boolean;
}

export interface SynonymEntry {
  canonical: string;
  forms: string[];
  lang: 'tl' | 'en';
  topic?: TopicGroup;
}

export interface EmergencyCard {
  id: string;
  title: string;
  steps: string[];
  hotline_ids: string[];
  source_id: string;
}

export interface PhaseCueList {
  strong: string[];
  weak: string[];
}

export interface IntentRules {
  emergency: { phrases: string[]; card_id: string };
  live_data: { phrases: string[]; reply_key: 'no_live_data' };
  medical_dose: { phrases: string[]; reply_key: 'medical_dose' };
  plan: Record<PlanField, string[]>;
  phase_cues: Record<Phase, PhaseCueList>;
  emergency_cards: EmergencyCard[];
}

export interface Source {
  id: string;
  agency: string;
  title: string;
  date: string;
  url: string;
  retrieved_at: string;
  notes?: string;
}

export interface Hotline {
  id: string;
  name: string;
  number: string;
  scope: 'national' | 'lgu';
  psgc?: string;
  hours?: string;
  source_id: string;
  verified_at: string;
}

export interface EvacuationCenter {
  id: string;
  name: string;
  psgc: string;
  coords: { lat: number; lon: number };
  landmark?: string;
  capacity?: number;
  accessible?: boolean;
  accepts_pets?: boolean;
  origin: 'scraped' | 'lgu';
  source_id: string;
  reviewed_by: string;
  reviewed_at: string;
  updated_at: string;
}

export interface Advisory {
  id: string;
  psgc: string;
  kind: 'standing' | 'time_bound';
  title: string;
  text: string;
  issued_at: string;
  expires_at?: string;
  issued_by: string;
}

export interface HazardNote {
  id: string;
  psgc: string;
  hazards: HazardTag[];
  text: string;
  updated_at: string;
}

export interface SourcedRule {
  placeholder: boolean;
  source_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface PhaseRules {
  warning_to_phase: { any_active_warning: 'during'; basis: 'product_rule' };
  bands: {
    near: SourcedRule & { max_km: number | null };
    approach: SourcedRule & { max_km: number | null };
  };
  evacuation_threshold: SourcedRule & {
    category_min: StormCategory | null;
    tcws_min: TcwsLevel | null;
  };
}

export interface Place {
  psgc: string;
  name: string;
  level: PlaceLevel;
  parent: string | null;
  centroid?: { lat: number; lon: number };
}

export interface PlacesFile extends ContentFile<Place> {
  names_source_id: string;
  centroids_source_id: string | null;
}

export interface QuestionLogEntry {
  id: string;
  at: string;
  question: string;
  route: RouteResult['primary'];
  emergency: boolean;
  phaseCue: Phase | null;
  phaseHint: Phase | null;
  hint: PhaseDecision['hint'];
  phaseChange?: { kind: 'switched' | 'recommended'; from: Phase; to: Phase };
  topIds: string[];
  topScore: number;
  gatePassed: boolean;
  outcome: Outcome;
  failures: VerifierFailure[];
  aiSkipReason?: AiSkipReason;
  timings: Timings;
}

export interface TopicReport {
  schema_version: 1;
  week: string;
  area: string;
  app_version: string;
  counts: Partial<Record<TopicGroup, number>>;
}

export interface DamageReport {
  schema_version: 1;
  report_id: string;
  area: string;
  damage_type: 'flood' | 'wind' | 'surge' | 'landslide' | 'other';
  severity: 'light' | 'moderate' | 'severe';
  affected_members: number;
  notes?: string;
  app_version: string;
  sent_at: string;
  photos: { id: string; bytes: number; sha256: string }[];
}

export interface BlobRef { sha256: string; size: number; path: string }
export interface Signature { kid: string; alg: 'Ed25519'; sig: string }
export interface PinnedKey { kid: string; public_key: string }

export interface KeySet {
  schema_version: 1;
  version: number;
  keys: {
    kid: string;
    alg: 'Ed25519';
    public_key: string;
    purpose: 'pack' | 'feed';
    scope?: PackKind[];
    not_before: string;
    not_after: string;
  }[];
  signature: Signature;
}

export type FeedFileName = 'bulletins.json' | 'hotlines.json';

export interface FeedManifest {
  schema_version: 1;
  manifest_id: 'feed';
  sequence: number;
  issued_at: string;
  min_app_version: string;
  stale: boolean;
  last_attempt_at: string;
  last_success_at: string;
  files: { 'bulletins.json': BlobRef; 'hotlines.json'?: BlobRef };
  signature: Signature;
}

export interface BulletinRecord {
  id: string;
  storm_id: string;
  source: { agency: 'PAGASA'; title: string; url: string };
  issued_at: string;
  scraped_at: string;
  storm: { name: string; international_name?: string; category: StormCategory };
  position: { lat: number; lon: number; at: string; text: string };
  movement?: { text: string };
  forecast: { lat: number; lon: number; at: string }[];
  signal_areas: { level: TcwsLevel; psgc: string[] }[];
  final: boolean;
  text: string;
}

export interface PackEntry {
  pack_id: string;
  kind: PackKind;
  version: number;
  guide_date?: string;
  applies_to?: { psgc?: string[]; profile_tags?: ProfileTag[] };
  full: BlobRef;
  deltas?: (BlobRef & { from_version: number })[];
}

export interface ModelEntry {
  pack_id: string;
  file_name: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';
  size: number;
  sha256: string;
  sources: string[];
  min_tier: DeviceTier;
  license: { name: 'Llama 3.2 Community License'; attribution: 'Built with Llama' };
}

export interface PackManifest {
  schema_version: 1;
  manifest_id: string;
  issued_at: string;
  min_app_version: string;
  packs?: PackEntry[];
  models?: ModelEntry[];
  signature?: Signature;
}

export interface PackPayload {
  schema_version: 1;
  pack_id: string;
  version: number;
  files: Partial<Record<ContentFileName, unknown>>;
}

export interface Delta {
  schema_version: 1;
  pack_id: string;
  base_version: number;
  target_version: number;
  changes: Partial<Record<ContentFileName, { upserts: { id: string }[]; deletes: string[] }>>;
}
