import { describe, expect, it } from 'vitest';
import type {
  Context,
  EvalQuestion,
  GenerateRequest,
  GenerateResult,
  ModelError,
  ModelManager,
  PhaseCase,
  Result,
} from '../types/index.ts';
import type { BundledContent } from './validateContent.ts';
import {
  FIXTURE_CHECKLIST,
  FIXTURE_HOTLINES,
  FIXTURE_INTENTS,
  FIXTURE_PASSAGES,
  FIXTURE_PHASE_RULES,
  FIXTURE_SOURCES,
  FIXTURE_WARNINGS,
} from '../engine/fixtures/content.ts';
import { bundledContent } from '../content/index.ts';
import { createEvalRunner } from './evalRunner.ts';

const NOW = '2026-10-10T08:00:00+08:00';

const fixtureContent: BundledContent = {
  passages: FIXTURE_PASSAGES,
  checklist: FIXTURE_CHECKLIST,
  warnings: FIXTURE_WARNINGS,
  synonyms: [],
  rules: FIXTURE_INTENTS,
  sources: FIXTURE_SOURCES,
  hotlines: FIXTURE_HOTLINES,
  phaseRules: FIXTURE_PHASE_RULES,
};

function ctx(over: Partial<Context> = {}): Context {
  return {
    phase: 'before',
    phaseSource: 'manual',
    reason: { source: 'manual', text: '' },
    changedAt: NOW,
    recommended: null,
    warnings: {},
    suppressed: [],
    ...over,
  };
}

describe('runRetrieval on fixtures', () => {
  const runner = createEvalRunner({ content: fixtureContent, now: () => new Date(NOW) });
  const questions: EvalQuestion[] = [
    { id: 'r1', kind: 'in_scope', text: 'Ano ang dapat ilagay sa go bag?', expect: { passageIds: ['before-gobag-01'], route: 'guide' } },
    { id: 'r2', kind: 'in_scope', text: 'Paano patibayin ang bahay bago ang bagyo?', expect: { passageIds: ['before-home-01'], route: 'guide' } },
    { id: 'r3', kind: 'in_scope', text: 'Malapit kami sa ilog, ano ang gagawin?', expect: { passageIds: ['during-flood-river-01'], route: 'guide' } },
    { id: 'r4', kind: 'out_of_scope', text: 'Magkano ang bigas?', expect: { route: 'guide', refuse: true } },
    { id: 'r5', kind: 'emergency', text: 'Hindi makahinga ang anak ko!', expect: { emergency: true } },
    { id: 'r6', kind: 'phase', text: 'Nandito na ang bagyo, ano ang gagawin sa baha?', expect: { route: 'guide', phaseCue: 'during' } },
  ];
  const report = runner.runRetrieval(questions);

  it('measures hit@2, refusal, emergency, route and phase-cue accuracy', () => {
    expect(report.hitAt2).toBe(1);
    expect(report.correctRefusal).toBe(1);
    expect(report.emergencyTrigger).toBe(1);
    expect(report.routeAccuracy).toBe(1);
    expect(report.phaseCueAccuracy).toBe(1);
    expect(report.failures).toEqual([]);
  });

  it('records the observed values for a failing question', () => {
    const failing = runner.runRetrieval([
      { id: 'bad', kind: 'in_scope', text: 'Ano ang dapat ilagay sa go bag?', expect: { passageIds: ['during-flood-river-01'], route: 'live_data' } },
    ]);
    expect(failing.hitAt2).toBe(0);
    expect(failing.routeAccuracy).toBe(0);
    expect(failing.failures).toHaveLength(1);
    expect(failing.failures[0]?.id).toBe('bad');
    expect(failing.failures[0]?.got.some((g) => g.startsWith('top2:'))).toBe(true);
    expect(failing.failures[0]?.got).toContain('route:guide');
  });
});

describe('runPhase on fixtures', () => {
  const runner = createEvalRunner({ content: fixtureContent, now: () => new Date(NOW) });
  const cases: PhaseCase[] = [
    {
      id: 'c1',
      inputs: { context: ctx(), rules: FIXTURE_PHASE_RULES, now: NOW },
      expect: { phase: 'before', switched: false, recommended: null },
    },
    {
      id: 'c2',
      inputs: { context: ctx({ warnings: { tcws: { level: 3, setAt: NOW } } }), rules: FIXTURE_PHASE_RULES, now: NOW },
      expect: { phase: 'during', switched: true, recommended: 'during' },
    },
    {
      id: 'c3',
      inputs: {
        context: ctx({ phase: 'during' }),
        ask: { questionId: 'c3', cue: { phase: 'after', strong: true, matched: ['humupa na ang bagyo'] }, hint: null },
        rules: FIXTURE_PHASE_RULES,
        now: NOW,
      },
      expect: { phase: 'during', switched: false, recommended: 'after' },
    },
    {
      id: 'c4',
      inputs: {
        context: ctx({ phase: 'before' }),
        ask: { questionId: 'c4', cue: { phase: 'during', strong: false, matched: ['lumalakas na ang hangin'] }, hint: 'during' },
        rules: FIXTURE_PHASE_RULES,
        now: NOW,
      },
      expect: { phase: 'during', switched: true, recommended: 'during', hint: 'accepted' },
    },
  ];

  it('passes the table and never moves away from caution', () => {
    const report = runner.runPhase(cases);
    expect(report.passed).toBe(4);
    expect(report.total).toBe(4);
    expect(report.wrongDirection).toBe(0);
    expect(report.failures).toEqual([]);
  });

  it('lists a failing case id', () => {
    const report = runner.runPhase([{ ...cases[0]!, expect: { phase: 'during', switched: true, recommended: 'during' } }]);
    expect(report.passed).toBe(0);
    expect(report.failures).toEqual(['c1']);
  });
});

function fakeModel(phaseHint: 'before' | 'during' | 'after' | null): Pick<ModelManager, 'generate'> {
  return {
    generate: async (
      req: GenerateRequest,
      onAnswerText: (textSoFar: string) => void,
    ): Promise<Result<GenerateResult, ModelError>> => {
      const id = req.prompt.allowedIds[0] ?? '';
      const raw = JSON.stringify({
        used: id ? [id] : [],
        in_guide: true,
        phase_hint: phaseHint,
        answer: 'Sundin ang mga tagubilin sa talata para sa inyong kaligtasan.',
      });
      onAnswerText(raw);
      return { ok: true, value: { raw, timings: {} } };
    },
  };
}

describe('runAnswers with a scripted fake model', () => {
  const runner = createEvalRunner({ content: bundledContent, now: () => new Date(NOW) });
  const questions: EvalQuestion[] = [
    { id: 'a1', kind: 'in_scope', text: 'Ano ang ilalagay sa go bag?', expect: { passageIds: ['before-gobag-01'], route: 'guide' } },
    { id: 'a2', kind: 'phase', text: 'Nandito na ang bagyo, ano ang dapat ilagay sa go bag?', expect: { passageIds: ['before-gobag-01'], route: 'guide', phaseCue: 'during' } },
  ];

  it('runs the prompt, verifies the output and records samples', async () => {
    const report = await runner.runAnswers(questions, fakeModel(null));
    expect(report.samples.length).toBeGreaterThanOrEqual(1);
    expect(report.numberCheckPass).toBe(1);
    expect(report.rejectedByCode).toEqual({});
    expect(report.phaseHint.emitted).toBe(0);
    expect(report.samples[0]?.phase_hint).toBeNull();
    expect(report.latencyMs.p50).toBeGreaterThanOrEqual(0);
  });

  it('accounts for emitted phase hints as accepted or dropped', async () => {
    const report = await runner.runAnswers(questions, fakeModel('during'));
    expect(report.samples.length).toBeGreaterThanOrEqual(2);
    expect(report.phaseHint.emitted).toBe(report.samples.length);
    expect(report.phaseHint.accepted + report.phaseHint.dropped).toBe(report.phaseHint.emitted);
    expect(report.phaseHint.accepted).toBeGreaterThanOrEqual(1);
  });

  it('counts a rejected answer by its verifier code', async () => {
    const bad: Pick<ModelManager, 'generate'> = {
      generate: async (req): Promise<Result<GenerateResult, ModelError>> => {
        const id = req.prompt.allowedIds[0] ?? '';
        const raw = JSON.stringify({ used: [id], in_guide: true, phase_hint: null, answer: 'May 999 na tao.' });
        return { ok: true, value: { raw, timings: {} } };
      },
    };
    const report = await runner.runAnswers(questions, bad);
    expect(report.numberCheckPass).toBeLessThan(1);
    expect(report.rejectedByCode.unknown_number ?? 0).toBeGreaterThanOrEqual(1);
  });
});
