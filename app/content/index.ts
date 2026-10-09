import type { ContentFileName, IntentRules, Result } from '../types/index.ts';
import { validateContent } from '../core/validateContent.ts';
import type { BundledContent } from '../core/validateContent.ts';
import guide from '../../content/guide.tl.json';
import checklist from '../../content/checklist.json';
import warnings from '../../content/warnings.json';
import synonyms from '../../content/synonyms.json';
import intents from '../../content/intents.json';
import sources from '../../content/sources.json';
import hotlines from '../../content/hotlines.json';
import phaseRules from '../../content/phase_rules.json';
import places from '../../content/places.json';

export const rawContent: Partial<Record<ContentFileName, unknown>> = {
  'guide.tl.json': guide,
  'checklist.json': checklist,
  'warnings.json': warnings,
  'synonyms.json': synonyms,
  'intents.json': intents,
  'sources.json': sources,
  'hotlines.json': hotlines,
  'phase_rules.json': phaseRules,
  'places.json': places,
};

const EMPTY_RULES: IntentRules = {
  emergency: { phrases: [], card_id: '' },
  live_data: { phrases: [], reply_key: 'no_live_data' },
  medical_dose: { phrases: [], reply_key: 'medical_dose' },
  plan: { evacuation_center: [], meeting_place: [], contacts: [], hotlines: [] },
  phase_cues: {
    before: { strong: [], weak: [] },
    during: { strong: [], weak: [] },
    after: { strong: [], weak: [] },
  },
  emergency_cards: [],
};

function emptyBundledContent(): BundledContent {
  return {
    passages: [],
    checklist: [],
    warnings: [],
    synonyms: [],
    rules: EMPTY_RULES,
    sources: [],
    hotlines: [],
  };
}

/** Validates the bundled files on demand; never throws. The engine reports `content_invalid` from `init()`. */
export function loadBundledContent(): Result<BundledContent, 'content_invalid'> {
  return validateContent(rawContent);
}

let resolved: BundledContent | null = null;

function resolvedBundled(): BundledContent {
  if (resolved) return resolved;
  const result = loadBundledContent();
  resolved = result.ok ? result.value : emptyBundledContent();
  return resolved;
}

/**
 * Best-effort bundled content for callers that do not handle a Result. Resolves lazily on first field
 * access, so importing this module never validates or throws. Invalid content yields empty content; the
 * engine's `init()` still returns `content_invalid` from `loadBundledContent()`.
 */
export const bundledContent: BundledContent = {
  get passages() { return resolvedBundled().passages; },
  get checklist() { return resolvedBundled().checklist; },
  get warnings() { return resolvedBundled().warnings; },
  get synonyms() { return resolvedBundled().synonyms; },
  get rules() { return resolvedBundled().rules; },
  get sources() { return resolvedBundled().sources; },
  get hotlines() { return resolvedBundled().hotlines; },
  get phaseRules() { return resolvedBundled().phaseRules; },
  get places() { return resolvedBundled().places; },
};
