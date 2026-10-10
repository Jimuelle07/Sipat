import { describe, expect, it } from 'vitest';
import type { Passage } from '../types/index.ts';
import { extractNumbers, verify } from './verify.ts';

function passage(id: string, text: string, summary = 'Maghanda bago dumating ang bagyo.'): Passage {
  return {
    id, lang: 'tl', title: id, topic: 'go_bag' as Passage['topic'], phase: ['before'],
    warnings: { tcws: [], rainfall: [], surge: [], gale: false, barangay_order: false },
    profile_tags: [], hazards: [], critical: false, text, summary,
    source_id: 'src', locator: 'p1', reviewed_by: 'test', reviewed_at: '2026-01-01', version: 1,
  };
}

const GOBAG = passage('before-gobag-01', 'Ilagay sa go bag ang tubig, pagkain, gamot at flashlight. Dalhin ito kapag lumikas.');
const SIGNAL = passage('signal-2', 'Sa Signal No. 2, ang hangin ay 62 hanggang 88 km bawat oras. Sa Signal No. 3, 89 hanggang 117 km.');
const out = (
  answer: string, used: string[] = ['before-gobag-01'], in_guide = true, phase_hint: 'before' | 'during' | 'after' | null = null,
): string => JSON.stringify({ used, in_guide, phase_hint, answer });
const code = (raw: string, ps: Passage[] = [GOBAG]): string | undefined => verify(raw, ps).failures[0]?.code;

describe('verify', () => {
  it('accepts a valid cited answer without a closing line', () => {
    const r = verify(out('Ilagay sa go bag ang tubig at pagkain. Dalhin ito sa paglikas.'), [GOBAG]);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.output?.answer).toBe('Ilagay sa go bag ang tubig at pagkain. Dalhin ito sa paglikas.');
    expect(r).not.toHaveProperty('text');
  });

  it('drops an unfinished last sentence cut by the length cap', () => {
    const r = verify(out('Ilagay sa go bag ang tubig at pagkain. Dalhin ito kapag lum'), [GOBAG]);
    expect(r.ok).toBe(true);
    expect(r.output?.answer).toBe('Ilagay sa go bag ang tubig at pagkain.');
  });

  it('rejects non-JSON and malformed objects as schema', () => {
    expect(code('not json')).toBe('schema');
    expect(code(JSON.stringify({ used: ['before-gobag-01'], in_guide: true, phase_hint: null, answer: 'x', extra: 1 }))).toBe('schema');
    expect(code(JSON.stringify({ used: 'before-gobag-01', in_guide: true, phase_hint: null, answer: 'x' }))).toBe('schema');
    expect(code(JSON.stringify({ used: ['before-gobag-01'], in_guide: true, answer: 'x' }))).toBe('schema');
  });

  it('reports not_in_guide', () => {
    expect(code(out('', ['before-gobag-01'], false))).toBe('not_in_guide');
  });

  it('rejects bad citations', () => {
    expect(code(out('Ilagay sa go bag ang tubig.', ['x']))).toBe('bad_citation');
    expect(code(out('Ilagay sa go bag ang tubig.', []))).toBe('bad_citation');
    expect(code(out('Ilagay sa go bag ang tubig.', ['before-gobag-01', 'before-gobag-01']))).toBe('bad_citation');
  });

  it('rejects numbers not in the cited passage', () => {
    const r = verify(out('Magdala ng limang litro ng tubig sa go bag.'), [GOBAG]);
    expect(r.failures).toEqual([{ code: 'unknown_number', detail: '5' }]);
    expect(code(out('Maghanda ng pagkain para sa isang araw.'))).toBe('unknown_number');
  });

  it('allows numbers present in the passage or allowedExtra', () => {
    expect(code(out('Sa Signal No. 3, ang hangin ay 89 hanggang 117 km bawat oras.', ['signal-2']), [SIGNAL])).toBeUndefined();
    expect(verify(out('Para sa limang tao ang go bag.'), [GOBAG], [5]).ok).toBe(true);
  });

  it('treats "isang" without a unit word as an article', () => {
    expect(code(out('Maghanda ng isang bag para sa tubig at pagkain.'))).toBeUndefined();
  });

  it('rejects phone numbers not in the cited passage', () => {
    expect(code(out('Tumawag sa 0917-123-4567 kung may emergency.'))).toBe('phone_number');
    const withPhone = passage('hotline', 'Tumawag sa 0917 123 4567 kung may emergency.');
    expect(code(out('Tumawag sa 0917-123-4567 kung kailangan.', ['hotline']), [withPhone])).toBeUndefined();
  });

  it('rejects answers that are too long', () => {
    expect(code(out('Ilagay ang tubig. Ilagay ang pagkain. Ilagay ang gamot. Ilagay ang flashlight. Dalhin sa paglikas.'))).toBe('too_long');
    expect(code(out(`Ilagay sa go bag ang ${'tubig '.repeat(80)}`))).toBe('too_long');
  });

  it('rejects English-only answers', () => {
    expect(code(out('Put water, food, and medicine in your go bag before leaving.'))).toBe('wrong_language');
  });

  it('parses a valid phase_hint and rejects an invalid one as schema', () => {
    expect(verify(out('Ilagay sa go bag ang tubig.', ['before-gobag-01'], true, 'during'), [GOBAG]).output?.phase_hint).toBe('during');
    expect(code(JSON.stringify({ used: ['before-gobag-01'], in_guide: true, phase_hint: 'soon', answer: 'Ilagay sa go bag ang tubig.' }))).toBe('schema');
  });
});

describe('extractNumbers', () => {
  it.each([
    ['5,000 piso at 2.5 litro', [5000, 2.5]],
    ['89-117 km', [89, 117]],
    ['89 hanggang 117', [89, 117]],
    ['limang litro', [5]],
    ['apat na tao', [4]],
    ['dalawampu\'t apat na oras', [24]],
    ['labing-isa', [11]],
    ['labindalawa', [12]],
    ['labinlima', [15]],
    ['tatlumpu', [30]],
    ['isang daan', [100]],
    ['dalawang libo', [2000]],
    ['alas-tres', [3]],
    ['kinse minuto, beinte piso, dose', [15, 20, 12]],
    ['two hours', [2]],
    ['ika-3 araw', [3]],
    ['ikatlo', [3]],
    ['ikalawa', [2]],
    ['isang bag', []],
    ['isang araw', [1]],
    ['isa pang litro', [1]],
  ])('%s → %j', (text, expected) => {
    expect(extractNumbers(text)).toEqual(expected);
  });
});
