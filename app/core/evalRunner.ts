import type {
  AnswerReport,
  Context,
  EvalQuestion,
  EvalRunner,
  ModelManager,
  Passage,
  Phase,
  PhaseCase,
  PhaseReport,
  PhaseRules,
  RetrievalReport,
  VerifierFailure,
} from '../types/index.ts';
import type { BundledContent } from './validateContent.ts';
import { DEFAULT_SEARCH_CONFIG } from './config.ts';
import { decidePhase } from './decidePhase.ts';
import { normalize } from './normalize.ts';
import { buildPrompt } from './prompt.ts';
import { route } from './route.ts';
import { createIndex, search } from './search.ts';
import { toManilaIso } from './time.ts';
import { verify } from './verify.ts';

export interface EvalRunnerDeps {
  content: BundledContent;
  now?: () => Date; // fixed clock for the phase decisions
}

// Used only when the bundled phase_rules.json is absent (dev fixtures); never a sourced band.
const PLACEHOLDER_RULES: PhaseRules = {
  warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
  bands: {
    near: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
    approach: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
  },
  evacuation_threshold: {
    category_min: null, tcws_min: null,
    placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null,
  },
};

// Same caution order as decidePhase: during > before > after.
const CAUTION: Record<Phase, number> = { during: 3, before: 2, after: 1 };

const ANSWER_SETTINGS = { nPredict: 110, temperature: 0.2, topP: 0.9, stop: ['<|eot_id|>'], seed: 7 };

const ratio = (hit: number, total: number): number => (total === 0 ? 0 : hit / total);

/** Nearest-rank percentile; 0 for an empty set. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
}

export function createEvalRunner(deps: EvalRunnerDeps): EvalRunner {
  const index = createIndex(deps.content.passages);
  const clock = deps.now ?? (() => new Date());
  const rules = deps.content.phaseRules ?? PLACEHOLDER_RULES;

  // Neutral phase and no profile: the retrieval score is the content's, not the fixture's.
  const neutralContext = (): Context => ({
    phase: 'before',
    phaseSource: 'manual',
    reason: { source: 'manual', text: '' },
    changedAt: toManilaIso(clock()),
    recommended: null,
    warnings: {},
    suppressed: [],
  });

  const analyze = (q: EvalQuestion) => {
    const query = normalize(q.text, deps.content.synonyms);
    const routed = route(query, deps.content.rules);
    const result = search(query, neutralContext(), null, index, DEFAULT_SEARCH_CONFIG);
    return { routed, result };
  };

  function runRetrieval(set: EvalQuestion[]): RetrievalReport {
    let hitTotal = 0;
    let hitHit = 0;
    let refusalTotal = 0;
    let refusalOk = 0;
    let emergencyTotal = 0;
    let emergencyOk = 0;
    let routeTotal = 0;
    let routeOk = 0;
    let cueTotal = 0;
    let cueOk = 0;
    const failures: { id: string; got: string[] }[] = [];

    for (const q of set) {
      const { routed, result } = analyze(q);
      const top2 = result.hits.slice(0, 2).map((hit) => hit.id);
      const got: string[] = [];
      let ok = true;

      if ((q.kind === 'in_scope' || q.kind === 'phase') && q.expect.passageIds !== undefined) {
        hitTotal += 1;
        const expected = q.expect.passageIds;
        if (expected.some((id) => top2.includes(id))) hitHit += 1;
        else {
          ok = false;
          got.push(`top2:${top2.length > 0 ? top2.join('|') : 'none'}`);
        }
      }

      if (q.kind === 'out_of_scope' || q.expect.refuse === true) {
        refusalTotal += 1;
        // A guide answer is not shown when the route is not 'guide' or nothing passes the gate.
        const refused = routed.primary !== 'guide' || result.selected.length === 0;
        if (refused) refusalOk += 1;
        else {
          ok = false;
          got.push(`selected:${result.selected.join('|')}`);
        }
      }

      if (q.expect.emergency !== undefined) {
        emergencyTotal += 1;
        if (routed.emergency === q.expect.emergency) emergencyOk += 1;
        else {
          ok = false;
          got.push(`emergency:${routed.emergency}`);
        }
      }

      if (q.expect.route !== undefined) {
        routeTotal += 1;
        if (routed.primary === q.expect.route) routeOk += 1;
        else {
          ok = false;
          got.push(`route:${routed.primary}`);
        }
      }

      if (q.expect.phaseCue !== undefined) {
        cueTotal += 1;
        const actual = routed.phaseCue?.phase ?? null;
        if (actual === q.expect.phaseCue) cueOk += 1;
        else {
          ok = false;
          got.push(`phaseCue:${actual ?? 'null'}`);
        }
      }

      if (!ok) failures.push({ id: q.id, got });
    }

    return {
      hitAt2: ratio(hitHit, hitTotal),
      correctRefusal: ratio(refusalOk, refusalTotal),
      emergencyTrigger: ratio(emergencyOk, emergencyTotal),
      routeAccuracy: ratio(routeOk, routeTotal),
      phaseCueAccuracy: ratio(cueOk, cueTotal),
      failures,
    };
  }

  function runPhase(cases: PhaseCase[]): PhaseReport {
    let passed = 0;
    let wrongDirection = 0;
    const failures: string[] = [];
    for (const c of cases) {
      const decision = decidePhase(c.inputs);
      const recommended = decision.state.recommended?.phase ?? null;
      const hintOk = c.expect.hint === undefined || decision.hint === c.expect.hint;
      const ok =
        decision.state.phase === c.expect.phase &&
        (decision.switched !== null) === c.expect.switched &&
        recommended === c.expect.recommended &&
        hintOk;
      if (ok) passed += 1;
      else failures.push(c.id);
      if (decision.switched && CAUTION[decision.switched.to] < CAUTION[decision.switched.from]) {
        wrongDirection += 1;
      }
    }
    return { passed, total: cases.length, wrongDirection, failures };
  }

  async function runAnswers(set: EvalQuestion[], model: Pick<ModelManager, 'generate'>): Promise<AnswerReport> {
    const considered = set.filter((q) => q.kind === 'in_scope' || q.kind === 'phase');
    const latencies: number[] = [];
    const rejectedByCode: Partial<Record<VerifierFailure, number>> = {};
    const phaseHint = { emitted: 0, accepted: 0, dropped: 0 };
    const samples: AnswerReport['samples'] = [];
    let generatedCount = 0;
    let numberFailures = 0;

    for (const q of considered) {
      const { routed, result } = analyze(q);
      if (routed.primary !== 'guide' || !result.gate.passed || result.selected.length === 0) continue;
      const passages = result.selected
        .map((id) => deps.content.passages.find((p) => p.id === id))
        .filter((p): p is Passage => p !== undefined);
      if (passages.length === 0) continue;

      const context = neutralContext();
      const prompt = buildPrompt({ question: q.text, profile: null, context, passages });
      const startedAt = Date.now();
      let generated: Awaited<ReturnType<ModelManager['generate']>>;
      try {
        generated = await model.generate({ prompt, settings: ANSWER_SETTINGS }, () => undefined);
      } catch {
        continue;
      }
      latencies.push(Date.now() - startedAt);
      if (!generated.ok) continue;
      generatedCount += 1;

      const verification = verify(generated.value.raw, passages);
      if (!verification.ok) {
        for (const failure of verification.failures) {
          rejectedByCode[failure.code] = (rejectedByCode[failure.code] ?? 0) + 1;
        }
        if (verification.failures.some((f) => f.code === 'unknown_number' || f.code === 'phone_number')) {
          numberFailures += 1;
        }
        continue;
      }
      const output = verification.output;
      if (!output) continue;
      samples.push({ id: q.id, answer: output.answer, used: output.used, phase_hint: output.phase_hint });

      if (output.phase_hint !== null) {
        phaseHint.emitted += 1;
        const decision = decidePhase({
          context,
          ask: { questionId: q.id, cue: routed.phaseCue, hint: output.phase_hint },
          storm: null,
          rules,
          now: toManilaIso(clock()),
        });
        if (decision.hint === 'accepted') phaseHint.accepted += 1;
        else if (decision.hint === 'dropped') phaseHint.dropped += 1;
      }
    }

    return {
      numberCheckPass: ratio(generatedCount - numberFailures, generatedCount),
      rejectedByCode,
      phaseHint,
      latencyMs: { p50: percentile(latencies, 50), p90: percentile(latencies, 90) },
      samples,
    };
  }

  return { runRetrieval, runAnswers, runPhase };
}
