import type {
  AiSkipReason,
  AnswerEvent,
  BulletinCardView,
  Contact,
  EmergencyCardView,
  Hotline,
  Outcome,
  Phase,
  PlanField,
  SourceRef,
  TopicGroup,
} from '../../../engine';

export type MainCard =
  | { kind: 'fixed_reply'; text: string }
  | { kind: 'bulletin_card'; card: BulletinCardView }
  | { kind: 'plan_answer'; field: PlanField; empty: boolean; text?: string; center?: string; contacts?: Contact[]; hotlines?: Hotline[] }
  | { kind: 'refusal'; text: string; suggestions: TopicGroup[] }
  | { kind: 'summary'; passageId: string; title: string; text: string; pinned: boolean; source: SourceRef };

export type AiState =
  | { state: 'none' }
  | { state: 'loading_model' }
  | { state: 'thinking' }
  | { state: 'skipped'; reason?: AiSkipReason }
  | { state: 'partial'; text: string }
  | { state: 'final'; text: string; used: string[] }
  | { state: 'rejected'; code: string; fallbackPassageId: string };

export interface AnswerPlan {
  emergency: EmergencyCardView | null;
  main: MainCard | null;
  ai: AiState;
  phase: { kind: 'switched' | 'recommended'; from: Phase; to: Phase; text: string } | null;
  closing: string | null;
  outcome: Outcome | null;
  failed: boolean;
}

export const EMPTY_PLAN: AnswerPlan = {
  emergency: null,
  main: null,
  ai: { state: 'none' },
  phase: null,
  closing: null,
  outcome: null,
  failed: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const phases: readonly Phase[] = ['before', 'during', 'after'];
const outcomes: readonly Outcome[] = [
  'answered_ai', 'answered_summary', 'refused', 'fixed_reply', 'bulletin_card', 'plan_answer', 'cancelled',
];
const aiSkipReasons: readonly AiSkipReason[] = ['low_battery', 'battery_saver', 'ai_off', 'tier', 'no_model'];
const planFields: readonly PlanField[] = ['evacuation_center', 'meeting_place', 'contacts', 'hotlines'];
const topicGroupSet = {
  signals: true, go_bag: true, home_prep: true, evacuation: true, flood: true,
  surge: true, landslide: true, infant: true, senior: true, pregnancy: true,
  disability: true, pets: true, water_food: true, electrical: true,
  generator_fire: true, gas_safety: true, cleanup: true, health_after_flood: true,
  first_aid: true, psychosocial: true, damage_report: true, assistance: true,
  out_of_guide: true,
} satisfies Record<TopicGroup, true>;
const topicGroups: readonly TopicGroup[] = Object.keys(topicGroupSet) as TopicGroup[];

function isPhase(value: unknown): value is Phase {
  return phases.includes(value as Phase);
}

function isOutcome(value: unknown): value is Outcome {
  return outcomes.includes(value as Outcome);
}

function isAiSkipReason(value: unknown): value is AiSkipReason {
  return aiSkipReasons.includes(value as AiSkipReason);
}

function isPlanField(value: unknown): value is PlanField {
  return planFields.includes(value as PlanField);
}

function isTopicGroup(value: unknown): value is TopicGroup {
  return topicGroups.includes(value as TopicGroup);
}

function isTopicGroupArray(value: unknown): value is TopicGroup[] {
  return Array.isArray(value) && value.every(isTopicGroup);
}

function isCard(value: unknown): value is EmergencyCardView | BulletinCardView {
  return isRecord(value);
}

function isSource(value: unknown): value is SourceRef {
  return isRecord(value) && isString(value.sourceId) && isString(value.agency) &&
    isString(value.title) && isString(value.date) && isString(value.url);
}

function isContactArray(value: unknown): value is Contact[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isHotlineArray(value: unknown): value is Hotline[] {
  return Array.isArray(value) && value.every(isRecord);
}

function hasAnswerTimings(value: unknown): boolean {
  return isRecord(value) && typeof value.routeMs === 'number' &&
    typeof value.searchMs === 'number' && typeof value.totalMs === 'number';
}

function mainCard(event: Record<string, unknown>): MainCard | null {
  switch (event.type) {
    case 'fixed_reply':
      return (event.route === 'live_data' || event.route === 'medical_dose') &&
        isString(event.copyKey) && isString(event.text)
        ? { kind: 'fixed_reply', text: event.text }
        : null;
    case 'bulletin_card':
      return isCard(event.card) ? { kind: 'bulletin_card', card: event.card as BulletinCardView } : null;
    case 'plan_answer': {
      if (!isPlanField(event.field) || !isBoolean(event.empty)) return null;
      if (event.text !== undefined && !isString(event.text)) return null;
      if (event.center !== undefined && !isString(event.center)) return null;
      if (event.contacts !== undefined && !isContactArray(event.contacts)) return null;
      if (event.hotlines !== undefined && !isHotlineArray(event.hotlines)) return null;
      return {
        kind: 'plan_answer',
        field: event.field,
        empty: event.empty,
        ...(event.text === undefined ? {} : { text: event.text }),
        ...(event.center === undefined ? {} : { center: event.center }),
        ...(event.contacts === undefined ? {} : { contacts: event.contacts as Contact[] }),
        ...(event.hotlines === undefined ? {} : { hotlines: event.hotlines as Hotline[] }),
      };
    }
    case 'refusal':
      return event.copyKey === 'refusal' && isString(event.text) && isTopicGroupArray(event.suggestions)
        ? { kind: 'refusal', text: event.text, suggestions: event.suggestions }
        : null;
    case 'summary':
      return isString(event.passageId) && isString(event.title) && isString(event.text) &&
        isBoolean(event.pinned) && isSource(event.source)
        ? {
            kind: 'summary', passageId: event.passageId, title: event.title,
            text: event.text, pinned: event.pinned, source: event.source,
          }
        : null;
    default:
      return null;
  }
}

/** Applies one engine event without mutating the existing answer plan. */
export function applyEvent(plan: AnswerPlan, event: unknown): AnswerPlan {
  if (plan.outcome !== null || !isRecord(event) || !isString(event.type)) return plan;

  switch (event.type) {
    case 'emergency_card':
      return isCard(event.card) && isStringArray(event.matched)
        ? { ...plan, emergency: event.card as EmergencyCardView }
        : plan;

    case 'fixed_reply':
    case 'bulletin_card':
    case 'plan_answer':
    case 'refusal':
    case 'summary': {
      const card = mainCard(event);
      if (card === null || plan.main?.kind === 'summary') return plan;
      return { ...plan, main: card };
    }

    case 'ai_status':
      if (event.status === 'loading_model' || event.status === 'thinking') {
        if (['partial', 'final', 'rejected'].includes(plan.ai.state)) return plan;
        return { ...plan, ai: { state: event.status } };
      }
      if (event.status === 'skipped') {
        if (event.reason !== undefined && !isAiSkipReason(event.reason)) return plan;
        return {
          ...plan,
          ai: event.reason === undefined
            ? { state: 'skipped' }
            : { state: 'skipped', reason: event.reason },
        };
      }
      return plan;

    case 'ai_partial':
      return isString(event.text) ? { ...plan, ai: { state: 'partial', text: event.text } } : plan;

    case 'ai_final':
      return isString(event.text) && isStringArray(event.used) && hasAnswerTimings(event.timings)
        ? { ...plan, ai: { state: 'final', text: event.text, used: event.used } }
        : plan;

    case 'ai_rejected':
      return isString(event.code) && isString(event.fallbackPassageId)
        ? { ...plan, ai: { state: 'rejected', code: event.code, fallbackPassageId: event.fallbackPassageId } }
        : plan;

    case 'phase_change':
      return (event.kind === 'switched' || event.kind === 'recommended') &&
        isPhase(event.from) && isPhase(event.to) && event.source === 'ask' &&
        (event.copyKey === 'phase_switched' || event.copyKey === 'phase_before' ||
          event.copyKey === 'phase_during' || event.copyKey === 'phase_after') && isString(event.text)
        ? { ...plan, phase: { kind: event.kind, from: event.from, to: event.to, text: event.text } }
        : plan;

    case 'closing':
      return event.copyKey === 'closing' && isString(event.text) ? { ...plan, closing: event.text } : plan;

    case 'done':
      return isString(event.logId) && isOutcome(event.outcome) ? { ...plan, outcome: event.outcome } : plan;

    default:
      return plan;
  }
}

export function failPlan(plan: AnswerPlan): AnswerPlan {
  return plan.failed ? plan : { ...plan, failed: true };
}

export function isStreaming(plan: AnswerPlan): boolean {
  return plan.outcome === null && !plan.failed;
}

export function canStop(plan: AnswerPlan): boolean {
  return isStreaming(plan) &&
    (plan.ai.state === 'loading_model' || plan.ai.state === 'thinking' || plan.ai.state === 'partial');
}
