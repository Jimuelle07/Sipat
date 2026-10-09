import { describe, expect, it } from 'vitest';
import type { BuiltPrompt, ContentFile, Context, Passage, Profile } from '../types/index.ts';
import guideRaw from '../../content/guide.tl.json';
import {
  EXAMPLE_1_JSON, EXAMPLE_1_USER, EXAMPLE_PASSAGE_TEXT, PROMPT_TOKEN_BUDGET, buildPrompt,
  estimateTokens, profileSummary, warningsSummary, PRIVATE_QUESTION_TOKEN, redactQuestion,
} from './prompt.ts';

const guide = guideRaw as unknown as ContentFile<Passage>;

const passage = (id: string, text: string): Passage => ({
  id, lang: 'tl', title: id, topic: 'go_bag' as Passage['topic'], phase: ['before'],
  warnings: { tcws: [], rainfall: [], surge: [], gale: false, barangay_order: false },
  profile_tags: [], hazards: [], critical: false, text, summary: text,
  source_id: 's', locator: 'l', reviewed_by: 'r', reviewed_at: '2026-10-09', version: 1,
});

const profile: Profile = {
  id: 'p1', name: 'Bahay namin', ownerId: 'm1',
  people: [
    { id: 'm1', name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [], phone: '09171234567', photoStatus: 'done', updatedAt: '' },
    { id: 'm2', name: 'Lolo Ben', relation: 'grandparent', ageGroup: 'senior', needs: ['maintenance_meds'], note: 'losartan', photoStatus: 'done', updatedAt: '' },
  ],
  petsCount: 0, headcount: 2, members: ['senior', 'maintenance_meds'], home: ['near_river'], location: null,
  plan: { evacuationCenter: 'Covered Court', meetingPlace: 'Plaza', contacts: [{ name: 'Tita Rosa', phone: '09181234567' }] },
  updatedAt: '',
};

const ctx: Context = {
  phase: 'during', phaseSource: 'manual', reason: { source: 'manual', text: '' },
  changedAt: '', recommended: null, warnings: { tcws: { level: 2, setAt: '' }, rainfall: { level: 'orange', setAt: '' } }, suppressed: [],
};
type UsedSchema = { properties: { used: { items: { enum: string[] }; maxItems: number }; phase_hint: { enum: unknown[] } } };
const schema = (p: BuiltPrompt) => p.responseFormat.json_schema.schema as UsedSchema;
const used = (p: BuiltPrompt) => schema(p).properties.used;
const lastTurn = (p: BuiltPrompt) => p.messages[5]?.content ?? '';
const total = (p: BuiltPrompt) => p.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
const short: [Passage, Passage] = [passage('a-01', 'Lumikas kapag sinabi ng barangay.'), passage('b-01', 'Ihanda ang go bag.')];

describe('buildPrompt', () => {
  it('schema enum equals allowedIds and carries the phase_hint enum', () => {
    const p = buildPrompt({ question: 'Lilikas na ba?', profile, context: ctx, passages: short });
    expect(used(p).items.enum).toEqual(p.allowedIds);
    expect(p.allowedIds).toEqual(['a-01', 'b-01']);
    expect(schema(p).properties.phase_hint.enum).toEqual(['before', 'during', 'after', null]);
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

  it('redacts private values typed in the question before assembling messages', () => {
    const withArea = { ...profile, location: { psgc: 'SAMPLE-AREA-1' } };
    const question = 'Ana at Lolo Ben, losartan, 09171234567, Tita Rosa 09181234567, Plaza, Covered Court, SAMPLE-AREA-1: ano ang go bag?';
    const p = buildPrompt({ question, profile: withArea, context: ctx, passages: short });
    const messages = p.messages.map((message) => message.content).join('\n');
    for (const privateValue of ['Ana', 'Lolo Ben', 'losartan', '09171234567', 'Tita Rosa', '09181234567', 'Plaza', 'Covered Court', 'SAMPLE-AREA-1']) {
      expect(messages).not.toContain(privateValue);
    }
    expect(lastTurn(p)).toContain(PRIVATE_QUESTION_TOKEN);
    expect(lastTurn(p)).toContain('ano ang go bag?');
    expect(redactQuestion('banana, Ana!', profile)).toBe(`banana, ${PRIVATE_QUESTION_TOKEN}!`);
  });

  it('drops the second passage over budget', () => {
    const long = [passage('a-01', 'Lumikas agad. '.repeat(60)), passage('b-01', 'Ihanda ang bag. '.repeat(60))];
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: long });
    expect(p.allowedIds).toEqual(['a-01']);
    expect(used(p).items.enum).toEqual(['a-01']);
    expect(lastTurn(p)).not.toContain('b-01');
  });

  // chars/4 heuristic overestimates Tagalog; system-design §6.1 puts the fixed part at ~180 real tokens.
  // The v2 contract adds the phase_hint line to SYSTEM_TL and phase_hint to both examples, so the bound grows.
  it('fixed part stays small', () => {
    const p = buildPrompt({ question: 'q', profile, context: ctx, passages: short });
    expect(p.messages.slice(0, 5).reduce((n, m) => n + estimateTokens(m.content), 0)).toBeLessThanOrEqual(360);
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
    expect(Object.keys(JSON.parse(EXAMPLE_1_JSON))).toEqual(['used', 'in_guide', 'phase_hint', 'answer']);
  });
});

describe('summaries', () => {
  const ctxOf = (warnings: Context['warnings']): Context => ({
    phase: 'before', phaseSource: 'manual', reason: { source: 'manual', text: '' },
    changedAt: '', recommended: null, warnings, suppressed: [],
  });
  it('warnings', () => {
    expect(warningsSummary(ctxOf({}))).toBe('wala');
    expect(warningsSummary(ctxOf({ surge: { level: 'red', setAt: '' }, gale: { setAt: '' } })))
      .toBe('red na babala sa storm surge; gale warning');
  });
  it('profile without tags', () => {
    expect(profileSummary({ ...profile, members: [], home: [] })).toBe('2 tao');
  });
});
