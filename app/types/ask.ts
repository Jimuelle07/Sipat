import type { CopyKey, Contact, TopicGroup } from './common.ts';
import type { EvacuationCenter, Hotline } from './content.ts';
import type { PlanField, VerifierFailure } from './core.ts';
import type { EmergencyCardView } from './engine.ts';

export type AiSkipReason = 'low_battery' | 'battery_saver' | 'ai_off' | 'tier' | 'no_model';

export interface SourceRef {
  sourceId: string; agency: string; title: string; date: string; url: string; locator?: string;
}

export interface Timings {
  routeMs: number;
  searchMs: number;
  loadMs?: number;
  promptTokens?: number;
  promptMs?: number;
  firstTokenMs?: number;
  predictedTokens?: number;
  totalMs: number;
}

export type Outcome =
  | 'answered_ai' | 'answered_summary' | 'refused' | 'fixed_reply' | 'plan_answer' | 'cancelled';

export type AnswerEvent =
  | { type: 'emergency_card'; card: EmergencyCardView; matched: string[] } // card resolved with hotlines (section 3.2)
  | { type: 'fixed_reply'; route: 'live_data' | 'medical_dose'; copyKey: CopyKey; text: string }
  | { type: 'plan_answer'; field: PlanField; empty: boolean;
      text?: string; center?: EvacuationCenter; contacts?: Contact[]; hotlines?: Hotline[] }
  | { type: 'refusal'; copyKey: 'refusal'; text: string; suggestions: TopicGroup[] }
  | { type: 'summary'; passageId: string; title: string; text: string; pinned: boolean; source: SourceRef }
  | { type: 'ai_status'; status: 'loading_model' | 'thinking' | 'skipped'; reason?: AiSkipReason }
  | { type: 'ai_partial'; text: string } // the answer so far; replaces the previous partial
  | { type: 'ai_final'; text: string; used: string[]; timings: Timings }
  | { type: 'ai_rejected'; code: VerifierFailure; fallbackPassageId: string }
  | { type: 'closing'; copyKey: 'closing'; text: string }
  | { type: 'done'; logId: string; outcome: Outcome };

export interface AskOptions {
  profileId?: string;   // default: activeProfileId
  signal?: AbortSignal; // cancels generation
}

