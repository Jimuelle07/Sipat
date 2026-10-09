import { describe, expect, it } from 'vitest';
import type { SynonymEntry } from '../types';
import { FILLERS, normalize, normalizeTerm } from './normalize';

const SYN: SynonymEntry[] = [
  { canonical: 'lumikas', forms: ['lilikas', 'lumikas', 'paglikas', 'evacuate', 'mag-evacuate', 'lilipat na'], lang: 'tl' },
  { canonical: 'baha', forms: ['bumabaha', 'binaha', 'flood', 'tubig-baha'], lang: 'tl' },
];

describe('normalize', () => {
  it('drops fillers and expands synonyms', () => {
    const q = normalize('Lilikas na ba kami po???', SYN);
    expect(q.raw).toBe('Lilikas na ba kami po???');
    expect(q.tokens).not.toContain('ba');
    expect(q.tokens).not.toContain('po');
    expect(q.text).toBe('lilikas na kami');
    expect(q.expanded).toContain('lumikas');
  });

  it('collapses repeated letters', () => {
    expect(normalize('tulonggg', []).tokens).toEqual(['tulong']);
  });

  it('keeps hyphenated word and its parts', () => {
    const q = normalize('tubig-baha', SYN);
    expect(q.tokens).toEqual(expect.arrayContaining(['tubig-baha', 'tubig', 'baha']));
    expect(q.expanded).not.toContain('baha'); // already a token
  });

  it('caps raw at 200 chars', () => {
    expect(normalize('a'.repeat(250), []).raw.length).toBe(200);
  });

  it('strips accents and keeps digits', () => {
    expect(normalize('Ilán ang Signal 3?', []).tokens).toEqual(['ilan', 'ang', 'signal', '3']);
  });

  it('matches multi-word forms', () => {
    expect(normalize('Lilipat na kami', SYN).expanded).toEqual(['lumikas']);
    expect(normalize('lilipat kami', SYN).expanded).toEqual([]);
  });

  it('handles empty input', () => {
    expect(normalize('   ', SYN)).toEqual({ raw: '', text: '', tokens: [], expanded: [] });
    expect(normalize('po ba', SYN).tokens).toEqual([]);
  });
});

describe('normalizeTerm', () => {
  it('folds and filters', () => {
    expect(normalizeTerm('TULONGGG')).toBe('tulong');
    expect(normalizeTerm('Bagyó')).toBe('bagyo');
    expect(normalizeTerm('')).toBeNull();
    for (const f of FILLERS) expect(normalizeTerm(f)).toBeNull();
  });
});
