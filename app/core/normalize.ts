import type { NormalizedQuery, SynonymEntry } from '../types';

export const MAX_QUERY_CHARS = 200;

export const FILLERS: readonly string[] = [
  'po', 'opo', 'ba', 'naman', 'lang', 'yung', 'yun', 'kasi', 'nga', 'din', 'rin', 'ho', 'eh', 'pa',
];
const IS_FILLER: Record<string, true> = Object.fromEntries(FILLERS.map((f) => [f, true]));
const isFiller = (t: string): boolean => IS_FILLER[t] === true;

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/(.)\1{2,}/gu, '$1');
}

/** Lowercase, strip accents, collapse 3+ repeats, split hyphenated words (whole + parts), drop fillers. */
function tokenize(s: string): string[] {
  const out: string[] = [];
  // Keep letters, digits, hyphens; everything else is a separator.
  for (const word of fold(s).replace(/[^\p{L}\p{N}-]+/gu, ' ').split(' ')) {
    const parts = word.split('-').filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    const pieces = parts.length > 1 ? [parts.join('-'), ...parts] : parts;
    for (const p of pieces) if (!isFiller(p)) out.push(p);
  }
  return out;
}

/** MiniSearch `processTerm`: returns null for fillers or empty terms. */
export function normalizeTerm(term: string): string | null {
  const t = fold(term).trim();
  if (t.length === 0 || isFiller(t)) return null;
  return t;
}

export function normalize(text: string, synonyms: readonly SynonymEntry[]): NormalizedQuery {
  const raw = (typeof text === 'string' ? text : '').trim().slice(0, MAX_QUERY_CHARS);
  const tokens = tokenize(raw);
  const joined = tokens.join(' ');
  const expanded: string[] = [];
  if (tokens.length === 0) return { raw, text: joined, tokens, expanded };

  const tokenSet = new Set(tokens);
  const padded = ` ${joined} `;
  for (const entry of synonyms) {
    const canonical = tokenize(entry.canonical).join(' ');
    if (!canonical || tokenSet.has(canonical) || expanded.includes(canonical)) continue;
    const hit = entry.forms.some((f) => {
      const form = tokenize(f);
      if (form.length === 0) return false;
      return form.length === 1 ? tokenSet.has(form[0]!) : padded.includes(` ${form.join(' ')} `);
    });
    if (hit) expanded.push(canonical);
  }
  return { raw, text: joined, tokens, expanded };
}
