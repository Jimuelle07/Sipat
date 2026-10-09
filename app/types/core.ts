import type { Context, Profile, TopicGroup, WarningKind } from './common.ts';
import type { Passage } from './content.ts';

export interface NormalizedQuery {
  raw: string;        // as typed, trimmed, at most 200 chars
  text: string;       // lowercased, punctuation and filler words removed
  tokens: string[];
  expanded: string[]; // canonical tokens added from synonyms.json
}

export type PlanField = 'evacuation_center' | 'meeting_place' | 'contacts' | 'hotlines';

export interface RouteResult {
  emergency: boolean; // show the emergency card first, then continue with `primary`
  primary: 'live_data' | 'plan' | 'medical_dose' | 'guide';
  matched: string[];  // phrases that fired, for the question log
  planField?: PlanField; // set when primary is 'plan'
}

export interface GuideIndex { readonly __brand: 'GuideIndex' } // opaque; wraps a MiniSearch instance built at startup

export interface SearchConfig {
  threshold: number;          // calibrated on the evaluation set
  secondPassageRatio: number; // add a 2nd passage only if its score ≥ ratio × top; proposal 0.6
  maxPassages: 1 | 2;         // 2 for tier 'full', 1 for 'lite' and 'none'
  boosts: { phase: number; warning: number; profileTag: number; cap: number }; // proposal 1.2, 1.2, 1.2, cap 1.5
}

export interface SearchHit {
  id: string;
  score: number;        // MiniSearch BM25+ score
  boostedScore: number; // after tag boosts
  terms: string[];      // query terms that matched
  topic: TopicGroup;
  critical: boolean;
}

export interface GateResult {
  passed: boolean;
  topScore: number;  // raw BM25+ score of the top hit: rank by boosted score, gate on raw
  threshold: number;
}

export interface SearchResult {
  query: NormalizedQuery;
  hits: SearchHit[];         // top 5, sorted by boostedScore
  selected: string[];        // 1 or 2 passage IDs; [] when the gate fails
  gate: GateResult;
  suggestions: TopicGroup[]; // up to 3, for the refusal buttons
}


export type ChecklistGroupId = 'now' | 'go_bag' | 'home' | 'evacuate' | 'after';
export interface ChecklistTick { ticked: boolean; updatedAt: string }

export interface WarningCard {
  warningId: string; // WarningEntry.id
  kind: WarningKind;
  label: string;
  meaning: string;
  leadTimeH?: number;
  setAt: string;
  confirmed: boolean; // false shows "(i-check sa PAGASA)"
}

export interface ChecklistItemView {
  id: string;
  text: string;
  quantityText?: string; // e.g. "× 5 tao × 3 araw", computed, never typed by hand
  forMembers?: { id: string; name: string; note?: string }[]; // who the item is for, e.g. "gamot ni Lolo Ben"
  priority: 1 | 2 | 3;
  critical: boolean;
  ticked: boolean;
  sourceId: string;
}

export interface ChecklistView {
  warningCards: WarningCard[];
  groups: { id: ChecklistGroupId; items: ChecklistItemView[] }[]; // items sorted by priority
  progress: { done: number; total: number };
  stale?: { kind: WarningKind; hoursSinceSet: number; copyKey: 'stale_warning' };
}


export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface PromptInput {
  question: string;    // NormalizedQuery.raw
  profile: Profile | null; // null before household setup
  context: Context;
  passages: Passage[]; // the 1 or 2 selected, in rank order
}

export interface BuiltPrompt {
  messages: ChatMessage[];
  responseFormat: { type: 'json_schema'; json_schema: { schema: object } };
  allowedIds: string[]; // same IDs as the schema enum
}

export type VerifierFailure =
  | 'schema' | 'not_in_guide' | 'bad_citation' | 'unknown_number'
  | 'phone_number' | 'too_long' | 'wrong_language';

export interface ModelOutput { used: string[]; in_guide: boolean; answer: string }

export interface VerifyResult {
  ok: boolean;
  output?: ModelOutput; // present when the JSON parsed
  failures: { code: VerifierFailure; detail?: string }[];
  text?: string; // answer + closing, set only when ok
}
