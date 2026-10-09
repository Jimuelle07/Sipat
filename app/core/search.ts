import MiniSearch from 'minisearch';
import type { Context, GuideIndex, NormalizedQuery, Passage, Profile, SearchConfig, SearchHit, SearchResult, TopicGroup } from '../types';
import { normalize, normalizeTerm } from './normalize';
import { gate } from './gate';
import { GENERIC_TERMS } from './config';

interface StoredPassage {
  id: string;
  lang: Passage['lang'];
  phase: Passage['phase'];
  warnings: Passage['warnings'];
  profile_tags: Passage['profile_tags'];
  hazards: Passage['hazards'];
  topic: TopicGroup;
  critical: boolean;
}

interface MiniHit {
  id: string;
  score: number;
  terms: string[];
  [key: string]: unknown;
}

interface SearchableIndex {
  mini: MiniSearch<StoredPassage>;
  passages: Map<string, Passage>;
}

function internals(index: GuideIndex): SearchableIndex {
  return index as unknown as SearchableIndex;
}

export function createIndex(passages: Passage[]): GuideIndex {
  const mini = new MiniSearch<StoredPassage>({
    fields: ['title', 'summary', 'text'],
    storeFields: ['id', 'lang', 'phase', 'warnings', 'profile_tags', 'hazards', 'topic', 'critical'],
    tokenize: (text) => normalize(text, []).tokens,
    processTerm: normalizeTerm,
    searchOptions: { boost: { title: 2, summary: 1.5 } },
  });
  const documents = passages.map((passage) => ({
    id: passage.id,
    title: passage.title,
    summary: passage.summary,
    text: passage.text,
    lang: passage.lang,
    phase: passage.phase,
    warnings: passage.warnings,
    profile_tags: passage.profile_tags,
    hazards: passage.hazards,
    topic: passage.topic,
    critical: passage.critical,
  }));
  mini.addAll(documents);
  return { mini, passages: new Map(passages.map((passage) => [passage.id, passage])) } as unknown as GuideIndex;
}

function activeWarningMatches(passage: Passage, ctx: Context): boolean {
  const warnings = passage.warnings;
  const active = ctx.warnings;
  return Boolean(
    (active.tcws && warnings.tcws.length > 0 && warnings.tcws.includes(active.tcws.level)) ||
    (active.rainfall && warnings.rainfall.length > 0 && warnings.rainfall.includes(active.rainfall.level)) ||
    (active.surge && warnings.surge.length > 0 && warnings.surge.includes(active.surge.level)) ||
    (active.gale && warnings.gale) ||
    (active.barangay_order && warnings.barangay_order),
  );
}

export function boostMultiplier(
  stored: Pick<Passage, 'phase' | 'warnings' | 'profile_tags'>,
  ctx: Context,
  profile: Profile | null, // null before household setup: no profile-tag boost
  boosts: SearchConfig['boosts'],
): number {
  let multiplier = 1;
  if (stored.phase.includes(ctx.phase)) multiplier *= boosts.phase;
  if (activeWarningMatches(stored as Passage, ctx)) multiplier *= boosts.warning;
  if (profile) {
    const tags = new Set<string>([...profile.members, ...profile.home]);
    for (const tag of stored.profile_tags) if (tags.has(tag)) multiplier *= boosts.profileTag;
  }
  return Math.min(multiplier, boosts.cap);
}

function refusalSuggestions(hits: SearchHit[]): TopicGroup[] {
  const suggestions: TopicGroup[] = [];
  for (const hit of hits) {
    if (hit.topic !== 'out_of_guide' && !suggestions.includes(hit.topic)) suggestions.push(hit.topic);
    if (suggestions.length === 3) return suggestions;
  }
  for (const topic of ['signals', 'go_bag', 'evacuation'] as const) {
    if (!suggestions.includes(topic)) suggestions.push(topic);
    if (suggestions.length === 3) break;
  }
  return suggestions;
}

export function search(
  query: NormalizedQuery,
  ctx: Context,
  profile: Profile | null,
  index: GuideIndex,
  config: SearchConfig,
): SearchResult {
  const terms = [...query.tokens, ...query.expanded];
  const internal = internals(index);
  const matches = terms.length === 0 ? [] : internal.mini.search(terms.join(' '), {
    prefix: (term) => term.length >= 4,
    fuzzy: (term) => term.length >= 5 ? 0.2 : false,
    filter: (result) => result.lang === 'tl',
    boostTerm: (term) => GENERIC_TERMS.includes(term) ? 0.5 : 1,
    boostDocument: (_id, _term, stored) => {
      const passage = internal.passages.get(String(_id));
      return passage && stored ? boostMultiplier(passage, ctx, profile, config.boosts) : 1;
    },
  }) as MiniHit[];

  const hits: SearchHit[] = matches.map((match) => {
    const passage = internal.passages.get(String(match.id))!;
    const multiplier = boostMultiplier(passage, ctx, profile, config.boosts);
    return {
      id: String(match.id),
      score: match.score / multiplier,
      boostedScore: match.score,
      terms: match.terms,
      topic: passage.topic,
      critical: passage.critical,
    };
  }).sort((a, b) => b.boostedScore - a.boostedScore).slice(0, 5);

  const gateResult = gate(hits, config);
  const selected: string[] = [];
  if (gateResult.passed && hits[0]) {
    selected.push(hits[0].id);
    const second = hits[1];
    if (config.maxPassages === 2 && second && second.boostedScore >= config.secondPassageRatio * hits[0].boostedScore) {
      selected.push(second.id);
    }
  }
  return { query, hits, selected, gate: gateResult, suggestions: refusalSuggestions(hits) };
}
