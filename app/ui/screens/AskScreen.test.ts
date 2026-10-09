import { describe, expect, it } from 'vitest';
import type { AnswerEvent, TopicGroup } from '../../engine';
import { askStrings } from '../strings/ask';
import { cancelEvents, canSubmitQuestion, chatReducer, sourceLine } from './ask/chat';

const source = { sourceId: 'src-1', agency: 'PAGASA', title: 'Gabay', date: '2026-10-09', url: 'https://example.test' };
const summary: AnswerEvent = { type: 'summary', passageId: 'p1', title: 'Signal', text: 'Buod', pinned: true, source };
const partial = (text: string): AnswerEvent => ({ type: 'ai_partial', text });
const final: AnswerEvent = { type: 'ai_final', text: 'tapos na', used: ['p1'], timings: { routeMs: 0, searchMs: 0, totalMs: 0 } };
const refused: AnswerEvent = { type: 'refusal', copyKey: 'refusal', text: 'Wala ito sa gabay.', suggestions: ['go_bag'] };
const answer = { id: 'a1', kind: 'answer' as const, question: 'tanong', time: '8:00 PM', events: [] };

describe('chat event reducer', () => {
  it('keeps answer event order', () => {
    const result = chatReducer([answer], summary);
    const next = chatReducer(result, { type: 'closing', copyKey: 'closing', text: 'Sundin ang utos ng barangay at ng mga awtoridad.' });
    expect(next[0]?.kind === 'answer' ? next[0].events.map((event) => event.type) : []).toEqual(['summary', 'closing']);
  });

  it('replaces partial text as tokens arrive and final replaces partial', () => {
    const first = chatReducer([answer], partial('simula'));
    const second = chatReducer(first, partial('mas mahabang sagot'));
    const finished = chatReducer(second, final);
    expect(second[0]?.kind === 'answer' ? second[0].events : []).toEqual([partial('mas mahabang sagot')]);
    expect(finished[0]?.kind === 'answer' ? finished[0].events.map((event) => event.type) : []).toEqual(['ai_final']);
  });

  it('removes transient model progress after cancel while keeping vetted events', () => {
    const inProgress = [summary, { type: 'ai_status', status: 'thinking' } as const, partial('draft')];
    expect(cancelEvents(inProgress).map((event) => event.type)).toEqual(['summary']);
  });

  it('keeps a refusal and its suggestion in order', () => {
    const result = chatReducer([answer], refused);
    expect(result[0]?.kind === 'answer' ? result[0].events : []).toEqual([refused]);
  });
});

describe('question and source helpers', () => {
  it('rejects whitespace-only questions and accepts text', () => {
    expect(canSubmitQuestion('   ')).toBe(false);
    expect(canSubmitQuestion('  ano ang go bag?  ')).toBe(true);
  });

  it('formats agency, title, date, and optional locator', () => {
    expect(sourceLine(source)).toBe('PAGASA — Gabay — 2026-10-09');
    expect(sourceLine({ ...source, locator: 'p. 4' })).toBe('PAGASA — Gabay — 2026-10-09 — p. 4');
  });
});

describe('ask strings', () => {
  const keys = Object.keys(askStrings.tl) as (keyof typeof askStrings.tl)[];

  it('has non-empty Filipino and English values for every key', () => {
    for (const key of keys) {
      expect(askStrings.tl[key].length).toBeGreaterThan(0);
      expect(askStrings.en[key].length).toBeGreaterThan(0);
    }
  });

  it('labels each refusal topic in both languages', () => {
    const topics = [
      'signals', 'go_bag', 'home_prep', 'evacuation', 'flood', 'surge', 'landslide', 'infant', 'senior', 'pregnancy',
      'disability', 'pets', 'water_food', 'electrical', 'generator_fire', 'cleanup', 'health_after_flood', 'out_of_guide',
    ] as const satisfies readonly TopicGroup[];
    for (const topic of topics) {
      expect(askStrings.tl[`topic_${topic}`].length).toBeGreaterThan(0);
      expect(askStrings.en[`topic_${topic}`].length).toBeGreaterThan(0);
    }
  });
});
