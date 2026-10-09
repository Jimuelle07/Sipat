import type { GateResult, SearchConfig, SearchHit } from '../types';

export function gate(hits: SearchHit[], config: SearchConfig): GateResult {
  const topScore = hits.reduce((top, hit) => Math.max(top, hit.score), 0);
  return { passed: topScore >= config.threshold, topScore, threshold: config.threshold };
}
