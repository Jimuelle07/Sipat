import type { ModelOutput, Passage, UiLanguage, VerifierFailure, VerifyResult } from '../types/index.ts';

const PHASES: readonly string[] = ['before', 'during', 'after'];

const UNITS: Record<string, number> = {
  // Tagalog
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
  // Spanish-derived
  uno: 1, dos: 2, tres: 3, kwatro: 4, kuwatro: 4, cuatro: 4, singko: 5, sinko: 5, cinco: 5,
  sais: 6, seis: 6, siyete: 7, syete: 7, siete: 7, otso: 8, ocho: 8, nuwebe: 9, nueve: 9,
  diyes: 10, dies: 10, diez: 10, onse: 11, once: 11, dose: 12, doce: 12,
  kinse: 15, quince: 15, beinte: 20, bente: 20, veinte: 20,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
  // Tagalog tens
  dalawampu: 20, tatlumpu: 30, apatnapu: 40, limampu: 50, animnapu: 60, pitumpu: 70,
  walumpu: 80, siyamnapu: 90,
};

/** Tagalog unit stems usable after `labi(ng|n|m)`; ordinals also accept `ikalawa`/`ikatlo`. */
const TL_UNIT: Record<string, number> = {
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
};
const ORDINAL_STEM: Record<string, number> = { ...TL_UNIT, lawa: 2, tlo: 3 };

const MULTIPLIER: Record<string, number> = { daan: 100, raan: 100, libo: 1000 };
const UNIT_WORDS: Record<string, true> = {
  oras: true, araw: true, linggo: true, litro: true, galon: true, piraso: true, tao: true, beses: true, metro: true, km: true,
};
const FUNCTION_WORDS: Record<UiLanguage, Record<string, true>> = {
  tl: { ang: true, ng: true, sa: true, mga: true, ay: true, kung: true, para: true, na: true, at: true, si: true, ni: true },
  en: {
    the: true, a: true, an: true, and: true, to: true, of: true, in: true, for: true, with: true, your: true, you: true,
    is: true, are: true, it: true, on: true, or: true,
  },
};
const TOKEN_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|[a-zñ']+/g;
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;

type Word = { value: number; joinNext: boolean; isa: boolean } | { mult: number } | null;

/** Classifies one lowercase word token; strips `'t` compounds and `-ng` linkers. */
function classify(raw: string): Word {
  let tok = raw.replace(/^'+/, '');
  let joinNext = false;
  if (tok.endsWith("'t")) { tok = tok.slice(0, -2); joinNext = true; }
  tok = tok.replace(/'+$/, '');
  const stem = tok.endsWith('ng') ? tok.slice(0, -2) : tok;
  const mult = MULTIPLIER[tok] ?? MULTIPLIER[stem];
  if (mult) return { mult };
  const v = UNITS[tok] ?? UNITS[stem];
  if (v !== undefined) return { value: v, joinNext, isa: stem === 'isa' };
  const teen = /^labi(?:ng|n|m)?(.+)$/.exec(stem)?.[1];
  const t = teen === undefined ? undefined : TL_UNIT[teen];
  if (t !== undefined && t < 10) return { value: 10 + t, joinNext, isa: false };
  const ord = /^ika(.+)$/.exec(stem)?.[1];
  const o = ord === undefined ? undefined : ORDINAL_STEM[ord];
  if (o !== undefined) return { value: o, joinNext, isa: false };
  return null;
}

/** Every number mentioned in `text`, in order (digits and number words). */
export function extractNumbers(text: string): number[] {
  const tokens = text.toLowerCase().replace(/[’‘]/g, "'").match(TOKEN_RE) ?? [];
  const out: number[] = [];
  let total = 0;
  let cur = 0;
  let active = false;
  let joinable = false; // the next number word adds to the current one ("dalawampu't apat", "isang daan at lima")
  let pendingTeen = false; // hyphen-split "labing-isa": the next unit is a teen
  const flush = (): void => {
    if (active) out.push(total + cur);
    total = 0; cur = 0; active = false; joinable = false;
  };

  for (const [i, tok] of tokens.entries()) {
    if (/^\d/.test(tok)) {
      flush();
      pendingTeen = false;
      out.push(Number(tok.replace(/,/g, '')));
      continue;
    }
    if (tok === 'labing' || tok === 'labin' || tok === 'labim') { flush(); pendingTeen = true; continue; }
    if (tok === 'ika' || tok === 'alas') { flush(); pendingTeen = false; continue; }
    const w = classify(tok);
    if (w && 'mult' in w) {
      if (w.mult === 1000) { total += (cur || 1) * 1000; cur = 0; } else { cur = (cur || 1) * 100; }
      active = true; joinable = true; pendingTeen = false;
      continue;
    }
    if (w) {
      let value = w.value;
      if (pendingTeen && value < 10) value += 10;
      else if (w.isa && !(active && joinable)) {
        // "isa"/"isang" is the article "a" unless a multiplier or unit word follows within two words.
        const next = tokens.slice(i + 1, i + 3);
        const nx = next[0] === undefined ? null : classify(next[0]);
        if (!(nx && 'mult' in nx) && !next.some((n) => UNIT_WORDS[n])) { flush(); continue; }
      }
      pendingTeen = false;
      if (active && !joinable) flush();
      cur += value; active = true; joinable = w.joinNext;
      continue;
    }
    pendingTeen = false;
    if ((tok === 'at' || tok === 'na') && active && joinable) continue;
    const after = tokens[i + 1];
    if (tok === 'na' && active && after !== undefined) {
      const nx = classify(after);
      if (nx && 'mult' in nx) { joinable = true; continue; } // "apat na raan"
    }
    flush();
  }
  flush();
  return out;
}

const digitsOnly = (s: string): string => s.replace(/\D/g, '');

function fail(code: VerifierFailure, output?: ModelOutput, detail?: string): VerifyResult {
  return { ok: false, ...(output ? { output } : {}), failures: [detail === undefined ? { code } : { code, detail }] };
}

function parse(raw: string): ModelOutput | null {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 4 || !keys.every((k) => k === 'used' || k === 'in_guide' || k === 'phase_hint' || k === 'answer')) return null;
  if (!Array.isArray(o.used) || !o.used.every((u) => typeof u === 'string')) return null;
  if (typeof o.in_guide !== 'boolean' || typeof o.answer !== 'string') return null;
  const hint = o.phase_hint;
  if (hint !== null && !(typeof hint === 'string' && PHASES.includes(hint))) return null;
  return { used: o.used as string[], in_guide: o.in_guide, phase_hint: hint as ModelOutput['phase_hint'], answer: finishedSentences(o.answer) };
}

/**
 * The schema's `maxLength` (and `n_predict`) can stop the answer mid-sentence. Keep only the
 * finished sentences so the screen never shows a cut-off word; an answer with no finished
 * sentence is kept as written. This only removes model text, never adds any.
 */
function finishedSentences(answer: string): string {
  const text = answer.trimEnd();
  if (/[.!?]$/.test(text)) return text;
  const lastEnd = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '), text.lastIndexOf('? '));
  return lastEnd === -1 ? text : text.slice(0, lastEnd + 1);
}

/** `lang` is the answer language the prompt asked for; `wrong_language` fires when the answer is not in it. */
export function verify(raw: string, passages: Passage[], allowedExtra: number[] = [], lang: UiLanguage = 'tl'): VerifyResult {
  const output = parse(raw);
  if (!output) return fail('schema');
  if (!output.in_guide) return fail('not_in_guide', output);

  const { used, answer } = output;
  const byId = new Map(passages.map((p) => [p.id, p]));
  if (used.length === 0) return fail('bad_citation', output, 'empty');
  if (new Set(used).size !== used.length) return fail('bad_citation', output, 'duplicate');
  const unknown = used.find((id) => !byId.has(id));
  if (unknown !== undefined) return fail('bad_citation', output, unknown);
  const citedText = used.map((id) => `${byId.get(id)!.text}\n${byId.get(id)!.summary}`).join('\n');

  // Phone-like runs (≥ 7 digits) are left to the phone check instead of the number check.
  const phones = (answer.match(PHONE_RE) ?? []).filter((c) => digitsOnly(c).length >= 7);
  let numberText = answer;
  for (const p of phones) numberText = numberText.replace(p, ' ');
  const allowed = new Set([...extractNumbers(citedText), ...allowedExtra]);
  const bad = extractNumbers(numberText).find((n) => !allowed.has(n));
  if (bad !== undefined) return fail('unknown_number', output, String(bad));

  const citedDigits = digitsOnly(citedText);
  const badPhone = phones.find((p) => !citedDigits.includes(digitsOnly(p)));
  if (badPhone !== undefined) return fail('phone_number', output, badPhone.trim());

  if (answer.length > 400) return fail('too_long', output, `${answer.length} chars`);
  const sentences = answer.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim() !== '').length;
  if (sentences > 4) return fail('too_long', output, `${sentences} sentences`);

  const letters = answer.match(/\p{L}/gu) ?? [];
  const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
  if (letters.length === 0 || latin / letters.length < 0.8) return fail('wrong_language', output, 'script');
  const tokens = answer.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  const fn = tokens.filter((t) => FUNCTION_WORDS[lang][t]).length;
  if (fn / tokens.length < 0.1) return fail('wrong_language', output, 'function_words');

  return { ok: true, output, failures: [] };
}
