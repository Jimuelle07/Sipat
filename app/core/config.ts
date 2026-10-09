import type { SearchConfig } from '../types';

// Calibrated in search.test.ts: max out-of-scope 17.53; min in-scope 36.87.
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  threshold: 27.20,
  secondPassageRatio: 0.6,
  maxPassages: 2,
  boosts: { phase: 1.2, warning: 1.2, profileTag: 1.2, cap: 1.5 },
};

export const GENERIC_TERMS: readonly string[] = ['bagyo', 'signal', 'ulan'];
