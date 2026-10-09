import { describe, expect, it, vi } from 'vitest';
import type { AiDecision, Context, GenerateResult, ModelManager, ModelError, QuestionLogEntry, Result } from '../types/index.ts';
import { bundledContent } from '../content/index.ts';
import { createIndex } from '../core/search.ts';
import { fixtureProfile } from './fixtures/households.ts';
import { FIXTURE_PHASE_RULES } from './fixtures/content.ts';
import { COPY } from './copy.ts';
import { runAskPipeline, type AskDeps } from './askPipeline.ts';

function initialContext(): Context {
  return { phase: 'before', phaseSource: 'manual', reason: { source: 'manual', text: '' },
    changedAt: '2026-10-09T12:00:00+08:00', recommended: null, warnings: {}, suppressed: [] };
}

function harness(options: { allowed?: AiDecision; raw?: string } = {}) {
  const content = bundledContent;
  const logs: QuestionLogEntry[] = [];
  const context = initialContext();
  const generate = vi.fn(async (_req: Parameters<ModelManager['generate']>[0], onText: (s: string) => void): Promise<Result<GenerateResult, ModelError>> => {
    onText('Ihanda ang go bag');
    return { ok: true, value: { raw: options.raw ?? JSON.stringify({ used: ['before-gobag-01'], in_guide: true, phase_hint: null, answer: 'Ihanda ang go bag na may tubig at pagkain.' }), timings: {} } };
  });
  const deps: AskDeps = {
    content, index: createIndex(content.passages), profile: () => fixtureProfile(), context: () => context,
    phaseRules: FIXTURE_PHASE_RULES, applyContext: () => undefined,
    power: { aiAllowed: vi.fn(async (): Promise<AiDecision> => options.allowed ?? { allowed: true }) },
    model: {
      state: () => 'ready', tier: async () => 'full', warm: async () => ({ ok: true, value: undefined }),
      generate, stop: async () => undefined, unload: async () => undefined, onStateChange: () => () => undefined,
      install: async () => ({ ok: false, error: { code: 'io', message: 'unavailable' } }), remove: async () => undefined,
    },
    emergencyCard: () => ({ id: 'emergency-default', title: 'Emergency', steps: [], hotlines: [], source: { sourceId: '', agency: '', title: '', date: '', url: '' } }),
    hotlines: () => content.hotlines, evacuationCenters: () => [], latestBulletin: () => null,
    log: (entry) => logs.push(entry), now: () => Date.parse('2026-10-09T12:00:00+08:00'), newId: () => 'log-test',
  };
  return { deps, logs, generate };
}

async function events(question: string, deps: AskDeps, signal?: AbortSignal) {
  const output = [];
  for await (const event of runAskPipeline(question, deps, { signal })) output.push(event);
  return output;
}

describe('runAskPipeline', () => {
  it('refuses below the gate without asking the model and emits closing before done', async () => {
    const { deps, generate, logs } = harness();
    const result = await events('Magkano ang presyo ng bigas?', deps);
    expect(result.map((event) => event.type)).toEqual(['refusal', 'closing', 'done']);
    expect(result[0]).toMatchObject({ type: 'refusal', text: COPY.refusal });
    expect(generate).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ outcome: 'refused', gatePassed: false });
  });

  it('uses the vetted summary when the power policy skips AI', async () => {
    const { deps, generate } = harness({ allowed: { allowed: false, reason: 'low_battery' } });
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.map((event) => event.type)).toEqual(['summary', 'ai_status', 'closing', 'done']);
    expect(result[1]).toMatchObject({ type: 'ai_status', status: 'skipped', reason: 'low_battery' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('shows a cached bulletin for live data and never invokes the model', async () => {
    const { deps, generate } = harness();
    const card = { bulletin: { id: 'fixture', stormId: 'fixture', source: { agency: 'PAGASA' as const, title: 'SAMPLE', url: 'https://example.invalid' }, issuedAt: '', scrapedAt: '', fetchedAt: '', storm: { name: 'SAMPLE', category: 'TD' as const }, position: { lat: 0, lon: 0, at: '', text: '' }, forecast: [], signalAreas: [], final: false, text: 'SAMPLE' }, issuedHoursAgo: 0, fetchedHoursAgo: 0, stale: false, ageText: '' };
    deps.latestBulletin = () => card;
    const result = await events('Nasaan na ang bagyo?', deps);
    expect(result.map((event) => event.type)).toEqual(['bulletin_card', 'closing', 'done']);
    expect(result[0]).toMatchObject({ type: 'bulletin_card', card });
    expect(generate).not.toHaveBeenCalled();
  });

  it('emits phase changes before closing and cancellation skips phase processing', async () => {
    const { deps, logs } = harness();
    const controller = new AbortController(); controller.abort();
    const result = await events('Ano ang ilalagay sa go bag?', deps, controller.signal);
    expect(result).toEqual([{ type: 'done', logId: 'log-test', outcome: 'cancelled' }]);
    expect(logs[0]?.outcome).toBe('cancelled');
  });
});
