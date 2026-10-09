import { describe, expect, it } from 'vitest';
import type {
  AiSkipReason,
  AnswerEvent,
  BulletinCardView,
  EmergencyCardView,
  Outcome,
  SourceRef,
} from '../../../engine';
import { EMPTY_PLAN, applyEvent, canStop, failPlan, isStreaming } from './answerPlan';
import type { AiState, AnswerPlan, MainCard } from './answerPlan';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const source: SourceRef = {
  sourceId: 'src-pagasa',
  agency: 'PAGASA',
  title: 'Gabay sa Bagyo (SAMPLE)',
  date: '2026-10-09',
  url: 'https://example.test/gabay',
};

const emergencyView: EmergencyCardView = {
  id: 'emergency-1',
  title: 'Emergency (SAMPLE)',
  steps: ['Lumikas agad.', 'Tumawag sa barangay.'],
  hotlines: [],
  source,
};

const bulletinView: BulletinCardView = {
  bulletin: {
    id: 'bulletin-1',
    stormId: 'storm-1',
    source: { agency: 'PAGASA', title: 'SAMPLE bulletin', url: 'https://example.test/bulletin' },
    issuedAt: '2026-10-09T08:00:00+08:00',
    scrapedAt: '2026-10-09T08:05:00+08:00',
    fetchedAt: '2026-10-09T08:06:00+08:00',
    storm: { name: 'Bagyong SAMPLE', category: 'TS' },
    position: { lat: 14, lon: 121, at: '2026-10-09T08:00:00+08:00', text: 'SAMPLE position' },
    forecast: [],
    signalAreas: [],
    final: false,
    text: 'SAMPLE bulletin text.',
  },
  issuedHoursAgo: 2,
  fetchedHoursAgo: 2,
  stale: false,
  ageText: 'Inilabas 2 oras na ang nakalipas',
};

const emergencyEvent: AnswerEvent = { type: 'emergency_card', card: emergencyView, matched: ['lumulubog'] };
const bulletinEvent: AnswerEvent = { type: 'bulletin_card', card: bulletinView };
const summaryEvent: AnswerEvent = {
  type: 'summary', passageId: 'p1', title: 'Signal', text: 'Buod ng gabay.', pinned: false, source,
};
const fixedReplyText = 'Walang live na balita ang app. (SAMPLE)';
const fixedReply: AnswerEvent = {
  type: 'fixed_reply', route: 'live_data', copyKey: 'no_live_data', text: fixedReplyText,
};
const refusalText = 'Wala ito sa gabay.';
const refusal: AnswerEvent = {
  type: 'refusal', copyKey: 'refusal', text: refusalText, suggestions: ['go_bag', 'home_prep'],
};
const planEvent: AnswerEvent = {
  type: 'plan_answer', field: 'evacuation_center', empty: false, center: 'SAMPLE Center',
};
const loading: AnswerEvent = { type: 'ai_status', status: 'loading_model' };
const thinking: AnswerEvent = { type: 'ai_status', status: 'thinking' };
const skipReason: AiSkipReason = 'low_battery';
const skipped: AnswerEvent = { type: 'ai_status', status: 'skipped', reason: skipReason };
const partial = (text: string): AnswerEvent => ({ type: 'ai_partial', text });
const final = (text: string): AnswerEvent => ({
  type: 'ai_final', text, used: ['p1'], timings: { routeMs: 1, searchMs: 1, totalMs: 10 },
});
const rejected: AnswerEvent = { type: 'ai_rejected', code: 'unknown_number', fallbackPassageId: 'p1' };
const phaseChange: AnswerEvent = {
  type: 'phase_change', kind: 'switched', from: 'before', to: 'during', source: 'ask',
  copyKey: 'phase_switched', text: 'Lumipat sa Habang may bagyo.',
};
const closingText = 'Sundin ang utos ng barangay at ng mga awtoridad.';
const closing: AnswerEvent = { type: 'closing', copyKey: 'closing', text: closingText };
const done = (outcome: Outcome = 'answered_ai'): AnswerEvent => ({ type: 'done', logId: 'log-1', outcome });

const summaryMain: MainCard = {
  kind: 'summary', passageId: 'p1', title: 'Signal', text: 'Buod ng gabay.', pinned: false, source,
};

const fold = (events: unknown[], start: AnswerPlan = EMPTY_PLAN): AnswerPlan =>
  events.reduce<AnswerPlan>((plan, event) => applyEvent(plan, event), start);

describe('EMPTY_PLAN', () => {
  it('starts with nothing set and not failed', () => {
    expect(EMPTY_PLAN.emergency).toBeNull();
    expect(EMPTY_PLAN.main).toBeNull();
    expect(EMPTY_PLAN.ai).toEqual({ state: 'none' });
    expect(EMPTY_PLAN.phase).toBeNull();
    expect(EMPTY_PLAN.closing).toBeNull();
    expect(EMPTY_PLAN.outcome).toBeNull();
    expect(EMPTY_PLAN.failed).toBe(false);
  });
});

describe('emergency_card', () => {
  it('sets the emergency card without setting a main card', () => {
    const plan = applyEvent(EMPTY_PLAN, emergencyEvent);
    expect(plan.emergency).toEqual(emergencyView);
    expect(plan.main).toBeNull();
  });

  it('keeps the emergency card while later events arrive', () => {
    const plan = fold([emergencyEvent, summaryEvent, loading, partial('draft'), closing, done()]);
    expect(plan.emergency).toEqual(emergencyView);
  });
});

describe('main card', () => {
  const mainCases: [string, AnswerEvent, MainCard][] = [
    ['fixed_reply', fixedReply, { kind: 'fixed_reply', text: fixedReplyText }],
    ['bulletin_card', bulletinEvent, { kind: 'bulletin_card', card: bulletinView }],
    ['plan_answer', planEvent, { kind: 'plan_answer', field: 'evacuation_center', empty: false, center: 'SAMPLE Center' }],
    ['refusal', refusal, { kind: 'refusal', text: refusalText, suggestions: ['go_bag', 'home_prep'] }],
    ['summary', summaryEvent, summaryMain],
  ];

  it.each(mainCases)('sets the main card from a %s event', (_label, event, expected) => {
    expect(applyEvent(EMPTY_PLAN, event).main).toEqual(expected);
  });

  it('keeps psychosocial and assistance refusal suggestions', () => {
    const event: AnswerEvent = {
      type: 'refusal', copyKey: 'refusal', text: refusalText,
      suggestions: ['psychosocial', 'assistance'],
    };
    expect(applyEvent(EMPTY_PLAN, event).main).toEqual({
      kind: 'refusal', text: refusalText, suggestions: ['psychosocial', 'assistance'],
    });
  });

  const planCases: [string, AnswerEvent, MainCard][] = [
    ['a filled evacuation center', { type: 'plan_answer', field: 'evacuation_center', empty: false, center: 'SAMPLE Center' },
      { kind: 'plan_answer', field: 'evacuation_center', empty: false, center: 'SAMPLE Center' }],
    ['a filled meeting place', { type: 'plan_answer', field: 'meeting_place', empty: false, text: 'SAMPLE Place' },
      { kind: 'plan_answer', field: 'meeting_place', empty: false, text: 'SAMPLE Place' }],
    ['an empty meeting place', { type: 'plan_answer', field: 'meeting_place', empty: true },
      { kind: 'plan_answer', field: 'meeting_place', empty: true }],
    ['empty hotlines', { type: 'plan_answer', field: 'hotlines', empty: true, hotlines: [] },
      { kind: 'plan_answer', field: 'hotlines', empty: true, hotlines: [] }],
  ];

  it.each(planCases)('renders a plan_answer for %s', (_label, event, expected) => {
    expect(applyEvent(EMPTY_PLAN, event).main).toEqual(expected);
  });

  it('keeps the first main card when a second main event arrives (one main card)', () => {
    const plan = applyEvent(applyEvent(EMPTY_PLAN, summaryEvent), bulletinEvent);
    expect(plan.main).toEqual(summaryMain);
  });

  it('does not replace a summary with a second summary', () => {
    const secondSummary: AnswerEvent = {
      type: 'summary', passageId: 'p2', title: 'Iba', text: 'Ibang buod.', pinned: true, source,
    };
    const plan = applyEvent(applyEvent(EMPTY_PLAN, summaryEvent), secondSummary);
    expect(plan.main).toEqual(summaryMain);
  });
});

describe('ai_status', () => {
  const statusCases: [string, AnswerEvent, AiState][] = [
    ['loading_model', loading, { state: 'loading_model' }],
    ['thinking', thinking, { state: 'thinking' }],
  ];

  it.each(statusCases)('sets the ai state to %s', (_label, event, expected) => {
    expect(applyEvent(EMPTY_PLAN, event).ai).toEqual(expected);
  });

  it('sets a skipped ai state with its reason', () => {
    expect(applyEvent(EMPTY_PLAN, skipped).ai).toEqual({ state: 'skipped', reason: skipReason });
  });

  const terminal: [string, AnswerPlan][] = [
    ['partial', applyEvent(EMPTY_PLAN, partial('draft'))],
    ['final', applyEvent(EMPTY_PLAN, final('tapos na'))],
    ['rejected', applyEvent(EMPTY_PLAN, rejected)],
  ];

  it.each(terminal)('ignores ai_status once the ai is %s', (_label, plan) => {
    expect(applyEvent(plan, loading).ai).toEqual(plan.ai);
    expect(applyEvent(plan, thinking).ai).toEqual(plan.ai);
  });
});

describe('ai text events', () => {
  it('replaces ai_partial text instead of appending', () => {
    const first = applyEvent(EMPTY_PLAN, partial('simula'));
    const second = applyEvent(first, partial('mas mahabang sagot'));
    expect(first.ai).toEqual({ state: 'partial', text: 'simula' });
    expect(second.ai).toEqual({ state: 'partial', text: 'mas mahabang sagot' });
  });

  it('sets ai_final with the text and used passage ids', () => {
    const plan = applyEvent(applyEvent(EMPTY_PLAN, partial('draft')), final('tapos na'));
    expect(plan.ai).toEqual({ state: 'final', text: 'tapos na', used: ['p1'] });
  });

  it('sets ai_rejected, removes the AI text and keeps the summary as main', () => {
    const plan = fold([summaryEvent, loading, partial('draft'), rejected]);
    expect(plan.ai).toEqual({ state: 'rejected', code: 'unknown_number', fallbackPassageId: 'p1' });
    expect(plan.main).toEqual(summaryMain);
  });
});

describe('phase_change', () => {
  const kinds: ('switched' | 'recommended')[] = ['switched', 'recommended'];

  it.each(kinds)('sets the %s phase line', (kind) => {
    const event: AnswerEvent = {
      type: 'phase_change', kind, from: 'before', to: 'during', source: 'ask',
      copyKey: 'phase_switched', text: 'Lumipat.',
    };
    expect(applyEvent(EMPTY_PLAN, event).phase).toEqual({
      kind, from: 'before', to: 'during', text: 'Lumipat.',
    });
  });
});

describe('closing and done', () => {
  it('sets the closing line', () => {
    expect(applyEvent(EMPTY_PLAN, closing).closing).toBe(closingText);
  });

  const outcomes: Outcome[] = [
    'answered_ai', 'answered_summary', 'refused', 'fixed_reply', 'bulletin_card', 'plan_answer', 'cancelled',
  ];

  it.each(outcomes)('sets the outcome to %s from done', (outcome) => {
    expect(applyEvent(EMPTY_PLAN, done(outcome)).outcome).toBe(outcome);
  });

  it('ignores every event after done', () => {
    const plan = fold([summaryEvent, partial('draft'), done('answered_ai')]);
    const snapshot = clone(plan);
    const after = fold([closing, emergencyEvent, partial('late'), loading], plan);
    expect(after).toEqual(snapshot);
  });
});

describe('robustness', () => {
  const base = fold([emergencyEvent, summaryEvent, partial('draft'), closing]);

  const unknownEvents: [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'closing'],
    ['a number', 42],
    ['an empty object', {}],
    ['an unknown type', { type: 'zzz' }],
    ['a non-string type', { type: 5 }],
    ['an array', []],
  ];

  it.each(unknownEvents)('returns the plan unchanged for %s', (_label, event) => {
    const before = clone(base);
    expect(() => applyEvent(base, event)).not.toThrow();
    expect(applyEvent(base, event)).toEqual(before);
  });

  const incompleteEvents: [string, unknown][] = [
    ['an emergency_card without a card', { type: 'emergency_card' }],
    ['a fixed_reply without text', { type: 'fixed_reply' }],
    ['a bulletin_card without a card', { type: 'bulletin_card' }],
    ['a plan_answer without a field', { type: 'plan_answer' }],
    ['a refusal without text', { type: 'refusal' }],
    ['a summary without a passage', { type: 'summary' }],
    ['an ai_status without a status', { type: 'ai_status' }],
    ['an ai_partial without text', { type: 'ai_partial' }],
    ['an ai_final without text', { type: 'ai_final' }],
    ['an ai_rejected without a fallback', { type: 'ai_rejected' }],
    ['a phase_change without phases', { type: 'phase_change' }],
    ['a closing without text', { type: 'closing' }],
    ['a done without an outcome', { type: 'done' }],
  ];

  it.each(incompleteEvents)('returns the plan unchanged for %s', (_label, event) => {
    const before = clone(base);
    expect(() => applyEvent(base, event)).not.toThrow();
    expect(applyEvent(base, event)).toEqual(before);
  });

  it('does not mutate the plan it is given', () => {
    const plan = fold([emergencyEvent, summaryEvent]);
    const before = clone(plan);
    applyEvent(plan, partial('draft'));
    applyEvent(plan, closing);
    applyEvent(plan, done());
    expect(plan).toEqual(before);
  });
});

describe('failPlan', () => {
  it('marks the plan failed and keeps every other field', () => {
    const plan = fold([emergencyEvent, summaryEvent, loading, partial('draft'), phaseChange, closing]);
    const failed = failPlan(plan);
    expect(failed.failed).toBe(true);
    expect({ ...failed, failed: false }).toEqual(plan);
  });
});

describe('isStreaming and canStop', () => {
  const cases: [string, AnswerPlan, boolean, boolean][] = [
    ['a fresh plan', EMPTY_PLAN, true, false],
    ['while the model loads', fold([loading]), true, true],
    ['while thinking', fold([thinking]), true, true],
    ['while text streams', fold([summaryEvent, partial('draft')]), true, true],
    ['after ai_final', fold([partial('draft'), final('tapos')]), true, false],
    ['after ai_rejected', fold([rejected]), true, false],
    ['after ai is skipped', fold([skipped]), true, false],
    ['after done', fold([loading, done('answered_ai')]), false, false],
    ['after done with no ai', fold([summaryEvent, done('answered_summary')]), false, false],
    ['after the stream threw', failPlan(fold([loading])), false, false],
  ];

  it.each(cases)('%s → streaming %s, stoppable %s', (_label, plan, streaming, stop) => {
    expect(isStreaming(plan)).toBe(streaming);
    expect(canStop(plan)).toBe(stop);
  });
});
