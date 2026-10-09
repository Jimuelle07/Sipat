import { describe, expect, it } from 'vitest';
import type { BuiltPrompt, Context, Passage, Profile } from '../types';
import guide from '../../content/guide.tl.json';
import {
  EXAMPLE_1_JSON, EXAMPLE_1_USER, EXAMPLE_PASSAGE_TEXT, PROMPT_TOKEN_BUDGET, buildPrompt,
  estimateTokens, profileSummary, warningsSummary,
} from './prompt';

const passage = (id: string, text: string): Passage => ({
  id, lang: 'tl', title: id, topic: 'go_bag', phase: ['before'],
  warnings: { tcws: [], rainfall: [], surge: [], gale: false },
  profile_tags: [], hazards: [], critical: false, text, summary: text,
  source_id: 's', locator: 'l', reviewed_by: 'r', reviewed_at: '2026-10-09', version: 1,
} as Passage);

const profile: Profile = {
  id: 'p1', name: 'Bahay namin', ownerId: 'm1',
  people: [
    { id: 'm1', name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [], phone: '09171234567', updatedAt: '' },
    { id: 'm2', name: 'Lolo Ben', relation: 'grandparent', ageGroup: 'senior', needs: ['maintenance_meds'], note: 'losartan', updatedAt: '' },
  ],
  petsCount: 0, headcount: 2, members: ['senior', 'maintenance_meds'], home: ['near_river'], livelihood: [],
  plan: { evacuationCenter: 'Covered Court', meetingPlace: 'Plaza', contacts: [{ name: 'Tita Rosa', phone: '09181234567' }] },
  updatedAt: '',
};

const ctx: Context = { phase: 'during', warnings: { tcws: { level: 2, setAt: '' }, rainfall: { level: 'orange', setAt: '' } } };
type UsedSchema = { properties: { used: { items: { enum: string[] }; maxItems: number } } };
const used = (p: BuiltPrompt) => (p.responseFormat.json_schema.schema as UsedSchema).properties.used;
const lastTurn = (p: BuiltPrompt) => p.messages[5]?.content ?? '';
const total = (p: BuiltPrompt) => p.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
const short: [Passage, Passage] = [passage('a-01', 'Lumikas kapag sinabi ng barangay.'), passage('b-01', 'Ihanda ang go bag.')];

describe('buildPrompt', () => {
  it('schema enum equals allowedIds', () => {
    const p = buildPrompt({ question: 'Lilikas na ba?', profile, context: ctx, passages: short });
    expect(used(p).items.enum).toEqual(p.allowedIds);
    expect(p.allowedIds).toEqual(['a-01', 'b-01']);
    expect(p.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user']);
  });

  it('one passage → maxItems 1 and no second Talata', () => {
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: [short[0]] });
    expect(used(p).maxItems).toBe(1);
    const turn = lastTurn(p);
    expect(turn.match(/Talata \[/g)).toHaveLength(1);
  });

  it('never leaks names, notes, places, phones or closing line', () => {
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: short });
    for (const m of p.messages) {
      for (const s of ['Lolo Ben', 'losartan', 'Plaza', 'Covered Court', 'Tita Rosa', '0917', '0918', 'Sundin ang utos', 'Bahay namin', 'Ana']) {
        expect(m.content).not.toContain(s);
      }
    }
    expect(lastTurn(p)).toContain('Sambahayan: 2 tao; may senior at maintenance na gamot; malapit sa ilog');
    expect(lastTurn(p)).toContain('Yugto at babala: Habang; Signal No. 2; orange na babala sa ulan');
  });

  it('drops the second passage over budget', () => {
    const long = [passage('a-01', 'Lumikas agad. '.repeat(60)), passage('b-01', 'Ihanda ang bag. '.repeat(60))];
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: long });
    expect(p.allowedIds).toEqual(['a-01']);
    expect(used(p).items.enum).toEqual(['a-01']);
    expect(lastTurn(p)).not.toContain('b-01');
  });

  // chars/4 heuristic overestimates Tagalog; system-design §6.1 puts the fixed part at ~180 real tokens.
  it('fixed part stays small', () => {
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: short });
    expect(p.messages.slice(0, 5).reduce((n, m) => n + estimateTokens(m.content), 0)).toBeLessThanOrEqual(330);
  });

  it('normal 2-passage input with real passages fits the budget', () => {
    const real = ['during-flood-river-01', 'during-flood-01'].map((id) => guide.items.find((x) => x.id === id) as Passage);
    const p = buildPrompt({ question: 'Malapit kami sa ilog, lilikas na ba kami?', profile, context: ctx, passages: real });
    expect(p.allowedIds).toEqual(['during-flood-river-01', 'during-flood-01']);
    expect(p.allowedIds).toHaveLength(2);
    expect(total(p)).toBeLessThanOrEqual(PROMPT_TOKEN_BUDGET);
  });

  it('EX1 embeds before-gobag-01 summary verbatim', () => {
    const bundled = guide.items.find((x) => x.id === 'before-gobag-01');
    expect(EXAMPLE_PASSAGE_TEXT).toBe(bundled?.summary);
    expect(EXAMPLE_1_USER).toContain(`Talata [before-gobag-01]: ${bundled?.summary}`);
    expect(Object.keys(JSON.parse(EXAMPLE_1_JSON))).toEqual(['used', 'in_guide', 'answer']);
  });
});

describe('summaries', () => {
  it('warnings', () => {
    expect(warningsSummary({ phase: 'before', warnings: {} })).toBe('wala');
    expect(warningsSummary({ phase: 'during', warnings: { surge: { level: 'red', setAt: '' }, gale: { setAt: '' } } }))
      .toBe('red na babala sa storm surge; gale warning');
  });
  it('profile without tags', () => {
    expect(profileSummary({ ...profile, members: [], home: [] })).toBe('2 tao');
  });
});
