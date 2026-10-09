import type {
  BulletinCardView,
  Contact,
  CopyKey,
  EmergencyCardView,
  Hotline,
  Phase,
  PlanField,
  TopicGroup,
} from './index.ts';
import type { VerifierFailure } from './index.ts';

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
  | 'answered_ai' | 'answered_summary' | 'refused' | 'fixed_reply' | 'bulletin_card' | 'plan_answer' | 'cancelled';

export type AnswerEvent =
  | { type: 'emergency_card'; card: EmergencyCardView; matched: string[] }
  | { type: 'fixed_reply'; route: 'live_data' | 'medical_dose'; copyKey: CopyKey; text: string }
  | { type: 'bulletin_card'; card: BulletinCardView }
  | { type: 'plan_answer'; field: PlanField; empty: boolean;
      text?: string; center?: string; contacts?: Contact[]; hotlines?: Hotline[] }
  | { type: 'refusal'; copyKey: 'refusal'; text: string; suggestions: TopicGroup[] }
  | { type: 'summary'; passageId: string; title: string; text: string; pinned: boolean; source: SourceRef }
  | { type: 'ai_status'; status: 'loading_model' | 'thinking' | 'skipped'; reason?: AiSkipReason }
  | { type: 'ai_partial'; text: string }
  | { type: 'ai_final'; text: string; used: string[]; timings: Timings }
  | { type: 'ai_rejected'; code: VerifierFailure; fallbackPassageId: string }
  | { type: 'phase_change'; kind: 'switched' | 'recommended'; from: Phase; to: Phase;
      source: 'ask'; copyKey: 'phase_switched' | 'phase_before' | 'phase_during' | 'phase_after'; text: string }
  | { type: 'closing'; copyKey: 'closing'; text: string }
  | { type: 'done'; logId: string; outcome: Outcome };

export interface AskOptions {
  signal?: AbortSignal; // cancels generation
}
