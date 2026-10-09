import type { IntentRules, NormalizedQuery, PlanField, RouteResult } from '../types';
import { normalize } from './normalize';

const PLAN_ORDER: readonly PlanField[] = ['evacuation_center', 'meeting_place', 'contacts', 'hotlines'];

interface Group { phrases: string[]; keys: string[] }
interface Compiled {
  emergency: Group;
  live_data: Group;
  medical_dose: Group;
  plan: { field: PlanField; group: Group }[];
}

const cache = new WeakMap<IntentRules, Compiled>();

function group(phrases: readonly string[] | undefined): Group {
  const list = phrases ?? [];
  return { phrases: [...list], keys: list.map((p) => ` ${normalize(p, []).text} `) };
}

function compile(rules: IntentRules): Compiled {
  let c = cache.get(rules);
  if (!c) {
    c = {
      emergency: group(rules.emergency.phrases),
      live_data: group(rules.live_data.phrases),
      medical_dose: group(rules.medical_dose.phrases),
      plan: PLAN_ORDER.map((field) => ({ field, group: group(rules.plan[field]) })),
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
  if (live) return { emergency, primary: 'live_data', matched };
  if (dose) return { emergency, primary: 'medical_dose', matched };
  if (planField) return { emergency, primary: 'plan', matched, planField };
  return { emergency, primary: 'guide', matched };
}
