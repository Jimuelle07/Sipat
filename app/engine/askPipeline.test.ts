import { describe, expect, it, vi } from 'vitest';
import type { AiDecision, GenerateResult, ModelManager, QuestionLogEntry, Result } from '../types';
import { bundledContent } from '../content';
import { createIndex } from '../core/search';
import { fixtureHouseholds } from './fixtures/households';
import { COPY } from './copy';
import { runAskPipeline, type AskDeps } from './askPipeline';

function harness(options: { allowed?: AiDecision; raw?: string } = {}) {
  const content = bundledContent;
  const profile = fixtureHouseholds()[0]!;
  const logs: QuestionLogEntry[] = [];
  const generate = vi.fn(async (_req: Parameters<ModelManager['generate']>[0], onText: (s: string) => void): Promise<Result<GenerateResult, 'native'>> => {
    onText('Ihanda ang go bag');
    return {
      ok: true,
      value: { raw: options.raw ?? JSON.stringify({ used: ['before-gobag-01'], in_guide: true, answer: 'Ihanda ang go bag na may tubig at pagkain.' }), timings: {} },
    };
  });
  const deps: AskDeps = {
    content,
    index: createIndex(content.passages),
    profile: () => profile,
    context: () => ({ phase: 'before', warnings: {} }),
    power: { aiAllowed: vi.fn(async (): Promise<AiDecision> => options.allowed ?? { allowed: true }) },
    model: {
      state: () => 'ready', tier: async () => 'full', warm: async () => ({ ok: true, value: undefined }),
      generate, stop: async () => undefined, unload: async () => undefined, onStateChange: () => () => undefined,
    },
    emergencyCard: () => ({ id: 'emergency-default', title: 'Emergency', steps: [], hotlines: [], source: { sourceId: '', agency: '', title: '', date: '', url: '' } }),
    hotlines: () => content.hotlines,
    evacuationCenters: () => [],
    log: (entry) => logs.push(entry),
    now: () => Date.parse('2026-10-09T12:00:00+08:00'),
    newId: () => 'log-test',
  };
  return { deps, logs, generate };
}

async function events(question: string, deps: AskDeps, signal?: AbortSignal) {
  const output = [];
  for await (const event of runAskPipeline(question, deps, { signal })) output.push(event);
  return output;
}

describe('runAskPipeline', () => {
  it('refuses below the gate without asking the model and always closes', async () => {
    const { deps, generate, logs } = harness();
    const result = await events('Magkano ang presyo ng bigas?', deps);
    expect(result.map((e) => e.type)).toEqual(['refusal', 'closing', 'done']);
    expect(result[0]).toMatchObject({ type: 'refusal', text: COPY.refusal });
    expect(generate).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ outcome: 'refused', gatePassed: false });
  });

  it('uses the vetted summary when power policy skips AI for low battery', async () => {
    const { deps, generate, logs } = harness({ allowed: { allowed: false, reason: 'low_battery' } });
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.map((e) => e.type)).toEqual(['summary', 'ai_status', 'closing', 'done']);
    expect(result[1]).toMatchObject({ type: 'ai_status', status: 'skipped', reason: 'low_battery' });
    expect(generate).not.toHaveBeenCalled();
    expect(logs[0]?.aiSkipReason).toBe('low_battery');
  });

  it('emits a verified answer and records its outcome', async () => {
    const { deps, logs } = harness();
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.map((e) => e.type)).toEqual(['summary', 'ai_status', 'ai_status', 'ai_partial', 'ai_final', 'closing', 'done']);
    expect(result.find((e) => e.type === 'ai_final')).toMatchObject({ type: 'ai_final', used: ['before-gobag-01'] });
    expect(logs[0]?.outcome).toBe('answered_ai');
  });

  it('rejects an answer with an unsupported number and keeps the summary fallback', async () => {
    const raw = JSON.stringify({ used: ['before-gobag-01'], in_guide: true, answer: 'Magdala ng 99 litro ng tubig sa go bag.' });
    const { deps, logs } = harness({ raw });
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.find((e) => e.type === 'ai_rejected')).toMatchObject({ type: 'ai_rejected', code: 'unknown_number' });
    expect(result.map((e) => e.type).slice(-2)).toEqual(['closing', 'done']);
    expect(logs[0]?.failures).toEqual(['unknown_number']);
    expect(logs[0]?.outcome).toBe('answered_summary');
  });

  it('routes live data to the fixed reply without invoking AI', async () => {
    const { deps, generate } = harness();
    const result = await events('Nasaan na ang bagyo?', deps);
    expect(result.map((e) => e.type)).toEqual(['fixed_reply', 'closing', 'done']);
    expect(result[0]).toMatchObject({ type: 'fixed_reply', copyKey: 'no_live_data', text: COPY.no_live_data });
    expect(generate).not.toHaveBeenCalled();
  });

  it('shows the emergency card before continuing to a guide answer', async () => {
    const { deps } = harness();
    const result = await events('Lumulubog na ang bahay namin, ano ang gagawin?', deps);
    expect(result[0]?.type).toBe('emergency_card');
    expect(result.some((e) => e.type === 'summary' || e.type === 'refusal')).toBe(true);
  });

  it('answers a go-bag question with the vetted summary before household setup', async () => {
    const { deps } = harness();
    deps.profile = () => null;
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.some((e) => e.type === 'summary')).toBe(true);
    expect(result.some((e) => e.type === 'refusal')).toBe(false);
  });

  it('ends an already-cancelled request without a closing event', async () => {
    const { deps, logs } = harness();
    const controller = new AbortController();
    controller.abort();
    const result = await events('Ano ang ilalagay sa go bag?', deps, controller.signal);
    expect(result).toEqual([{ type: 'done', logId: 'log-test', outcome: 'cancelled' }]);
    expect(logs[0]?.outcome).toBe('cancelled');
    expect(result.some((e) => e.type === 'closing')).toBe(false);
  });
});
