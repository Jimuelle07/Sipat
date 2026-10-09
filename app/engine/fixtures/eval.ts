import type { EvalSummary } from '../../types';

/**
 * Fixture stand-in for the laptop report that `evaluation.summary()` returns at build time.
 * Placeholder zeros, not measured results: the Node evaluation (eval/) fills the real numbers.
 */
export const EVAL_SUMMARY_FIXTURE: EvalSummary = {
  generatedAt: '2026-10-09T00:00:00+08:00',
  retrieval: { hitAt2: 0, correctRefusal: 0, emergencyTrigger: 0, liveDataReply: 0 },
  answers: { faithfulness: null, numberCheckPass: 0 },
  device: {},
};
