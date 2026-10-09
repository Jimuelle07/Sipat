import type {
  IntentRules, NormalizedQuery, Phase, PhaseCue, PhaseCueList, PlanField, RouteResult,
} from '../types/index.ts';
import { normalize } from './normalize.ts';

const PLAN_ORDER: readonly PlanField[] = ['evacuation_center', 'meeting_place', 'contacts', 'hotlines'];
const PHASE_CAUTION: readonly Phase[] = ['during', 'before', 'after'];

interface Group { phrases: string[]; keys: string[] }
interface CuePhrase { phrase: string; pattern: RegExp | null }
interface CueGroup { strong: CuePhrase[]; weak: CuePhrase[] }
interface Compiled {
  emergency: Group;
  live_data: Group;
  medical_dose: Group;
  plan: { field: PlanField; group: Group }[];
  cues: Partial<Record<Phase, CueGroup>>;
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const escape = (s: string): string => s.replace(ESCAPE_RE, '\\$&');

const cache = new WeakMap<IntentRules, Compiled>();

function group(phrases: readonly string[] | undefined): Group {
  const list = phrases ?? [];
  return { phrases: [...list], keys: list.map((p) => ` ${normalize(p, []).text} `) };
}

/** A `#` in a cue phrase matches any one number token; words match on word boundaries. */
function cuePhrase(phrase: string): CuePhrase {
  const parts: string[] = [];
  for (const raw of phrase.trim().split(/\s+/)) {
    if (raw === '#') { parts.push('\\d+'); continue; }
    for (const token of normalize(raw, []).tokens) parts.push(escape(token));
  }
  return { phrase, pattern: parts.length > 0 ? new RegExp(`(?:^| )${parts.join(' ')}(?= |$)`) : null };
}

function cuesOf(lists: Partial<Record<Phase, PhaseCueList>>): Partial<Record<Phase, CueGroup>> {
  const out: Partial<Record<Phase, CueGroup>> = {};
  for (const phase of PHASE_CAUTION) {
    const list = lists[phase];
    if (!list) continue;
    out[phase] = { strong: list.strong.map(cuePhrase), weak: list.weak.map(cuePhrase) };
  }
  return out;
}

function compile(rules: IntentRules): Compiled {
  let c = cache.get(rules);
  if (!c) {
    c = {
      emergency: group(rules.emergency.phrases),
      live_data: group(rules.live_data.phrases),
      medical_dose: group(rules.medical_dose.phrases),
      plan: PLAN_ORDER.map((field) => ({ field, group: group(rules.plan[field]) })),
      cues: cuesOf(rules.phase_cues ?? {}),
    };
    cache.set(rules, c);
  }
  return c;
}

/** Collects phrases that fire; returns true if any did. */
function hits(text: string, g: Group, matched: string[]): boolean {
  let any = false;
  g.keys.forEach((k, i) => {
    if (k.trim().length > 0 && text.includes(k)) {
      matched.push(g.phrases[i] ?? k.trim());
      any = true;
    }
  });
  return any;
}

/** The most cautious phase whose cue list matched; null when none did. */
function phaseCueFor(text: string, cues: Partial<Record<Phase, CueGroup>>): PhaseCue | null {
  for (const phase of PHASE_CAUTION) {
    const list = cues[phase];
    if (!list) continue;
    const matched: string[] = [];
    let strong = false;
    for (const cue of list.strong) if (cue.pattern?.test(text)) { matched.push(cue.phrase); strong = true; }
    for (const cue of list.weak) if (cue.pattern?.test(text)) matched.push(cue.phrase);
    if (matched.length > 0) return { phase, strong, matched };
  }
  return null;
}

export function route(query: NormalizedQuery, rules: IntentRules): RouteResult {
  const c = compile(rules);
  const text = ` ${query.text} `;
  const matched: string[] = [];
  const emergency = hits(text, c.emergency, matched);
  const live = hits(text, c.live_data, matched);
  const dose = hits(text, c.medical_dose, matched);
  let planField: PlanField | undefined;
  for (const { field, group: g } of c.plan) {
    if (hits(text, g, matched) && planField === undefined) planField = field;
  }
  const phaseCue = phaseCueFor(text, c.cues);
  if (live) return { emergency, phaseCue, primary: 'live_data', matched };
  if (dose) return { emergency, phaseCue, primary: 'medical_dose', matched };
  if (planField) return { emergency, phaseCue, primary: 'plan', matched, planField };
  return { emergency, phaseCue, primary: 'guide', matched };
}
