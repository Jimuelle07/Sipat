import { describe, expect, it, vi } from 'vitest';
import type { AiDecision, Context, GenerateResult, ModelManager, ModelError, QuestionLogEntry, Result } from '../types/index.ts';
import { bundledContent } from '../content/index.ts';
import { createIndex } from '../core/search.ts';
import { fixtureProfile } from './fixtures/households.ts';
import { FIXTURE_PHASE_RULES, FIXTURE_PLACES, FIXTURE_INTENTS } from './fixtures/content.ts';
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
      install: async () => ({ ok: false, error: { code: 'io', message: 'unavailable' } }),
      download: async () => ({ ok: false, error: { code: 'io', message: 'unavailable' } }),
      remove: async () => undefined,
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

  it.each(['ai_off', 'no_model', 'tier', 'battery_saver', 'low_battery'] as const)(
    'keeps the vetted answer when AI is skipped for %s', async (reason) => {
      const { deps, generate, logs } = harness({ allowed: { allowed: false, reason } });
      const result = await events('Ano ang ilalagay sa go bag?', deps);
      expect(result.map((event) => event.type)).toEqual(['summary', 'ai_status', 'closing', 'done']);
      expect(result[1]).toMatchObject({ type: 'ai_status', status: 'skipped', reason });
      expect(result.at(-1)).toMatchObject({ type: 'done', outcome: 'answered_summary' });
      expect(logs[0]?.aiSkipReason).toBe(reason);
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it('redacts household and area values from the prompt and the question log', async () => {
    const { deps, generate, logs } = harness();
    const profile = fixtureProfile();
    profile.plan.contacts = [{ name: 'Tita Rosa', phone: '09990000000' }];
    profile.plan.meetingPlace = 'SAMPLE Plaza';
    deps.profile = () => profile;
    deps.content = { ...deps.content, places: FIXTURE_PLACES };
    const area = FIXTURE_PLACES.items.find((place) => place.psgc === profile.location?.psgc);
    const question = `Nena, Lola Ising, gamot sa presyon, 0000000000, Tita Rosa, 09990000000, SAMPLE Plaza, ${area?.name}, ${profile.location?.psgc}: ano ang ilalagay sa go bag?`;
    await events(question, deps);
    expect(generate).toHaveBeenCalledOnce();
    const prompt = generate.mock.calls[0]?.[0].prompt.messages.map((message) => message.content).join('\n') ?? '';
    const logged = logs[0]?.question ?? '';
    for (const value of ['Nena', 'Lola Ising', 'gamot sa presyon', '0000000000', 'Tita Rosa', '09990000000', 'SAMPLE Plaza', area?.name, profile.location?.psgc]) {
      if (value) {
        expect(prompt).not.toContain(value);
        expect(logged).not.toContain(value);
      }
    }
    expect(prompt).toContain('[pribado]');
    expect(logged).toContain('[pribado]');
    expect(Object.keys(logs[0] ?? {}).sort()).toEqual([
      'at', 'emergency', 'failures', 'gatePassed', 'hint', 'id', 'outcome', 'phaseCue', 'phaseHint',
      'question', 'route', 'timings', 'topIds', 'topScore',
    ].sort());
  });

  it('shows a cached bulletin for live data and never invokes the model', async () => {
    const { deps, generate } = harness();
    const card = { bulletin: { id: 'fixture', stormId: 'fixture', source: { agency: 'PAGASA' as const, title: 'SAMPLE – hindi totoong bulletin', url: 'https://example.invalid' }, issuedAt: '', scrapedAt: '', fetchedAt: '', storm: { name: 'SAMPLE', category: 'TD' as const }, position: { lat: 0, lon: 0, at: '', text: '' }, forecast: [], signalAreas: [], final: false, text: 'SAMPLE – hindi totoong bulletin' }, issuedHoursAgo: 0, fetchedHoursAgo: 0, stale: false, ageText: '' };
    deps.latestBulletin = () => card;
    const result = await events('Nasaan na ang bagyo?', deps);
    expect(result.map((event) => event.type)).toEqual(['bulletin_card', 'closing', 'done']);
    expect(result[0]).toMatchObject({ type: 'bulletin_card', card });
    expect(generate).not.toHaveBeenCalled();
  });

  it('keeps cached bulletin text out of a guide prompt', async () => {
    const { deps, generate } = harness();
    const bulletinText = 'SAMPLE – hindi totoong bulletin: 9999 km ang layo.';
    deps.latestBulletin = () => ({
      bulletin: { id: 'sample', stormId: 'sample', source: { agency: 'PAGASA', title: 'SAMPLE – hindi totoong bulletin', url: 'https://example.invalid' },
        issuedAt: '', scrapedAt: '', fetchedAt: '', storm: { name: 'SAMPLE Bagyo', category: 'TD' },
        position: { lat: 0, lon: 0, at: '', text: 'SAMPLE position' }, forecast: [], signalAreas: [], final: false, text: bulletinText },
      issuedHoursAgo: 0, fetchedHoursAgo: 0, stale: false, ageText: '',
    });
    await events(`Ano ang ilalagay sa go bag? ${bulletinText}`, deps);
    const messages = generate.mock.calls[0]?.[0].prompt.messages.map((message) => message.content).join('\n') ?? '';
    expect(messages).not.toContain(bulletinText);
    expect(messages).not.toContain('9999');
    expect(messages).not.toContain('SAMPLE Bagyo');
  });

  it('keeps a number the user typed even when a bulletin is cached', async () => {
    const { deps, generate, logs } = harness();
    deps.latestBulletin = () => ({
      bulletin: { id: 'sample', stormId: 'sample', source: { agency: 'PAGASA', title: 'SAMPLE – hindi totoong bulletin', url: 'https://example.invalid' },
        issuedAt: '', scrapedAt: '', fetchedAt: '', storm: { name: 'Bagyong SAMPLE', category: 'TD' },
        position: { lat: 0, lon: 0, at: '', text: 'SAMPLE' }, forecast: [], signalAreas: [], final: false, text: 'SAMPLE' },
      issuedHoursAgo: 0, fetchedHoursAgo: 0, stale: false, ageText: '',
    });
    await events('Signal 3 na dito, ano ang ilalagay sa go bag?', deps);
    const messages = generate.mock.calls[0]?.[0].prompt.messages.map((message) => message.content).join('\n') ?? '';
    expect(messages).toContain('Signal 3');
    expect(logs[0]?.question).toContain('3');
  });

  it('emits loading only while warming, then thinking and a terminal AI event', async () => {
    const { deps, generate } = harness();
    let ready = false;
    deps.model.state = () => ready ? 'ready' : 'unloaded';
    const warm = vi.fn(async () => { ready = true; return { ok: true as const, value: undefined }; });
    deps.model.warm = warm;
    const first = await events('Ano ang ilalagay sa go bag?', deps);
    expect(first.map((event) => event.type === 'ai_status' ? `${event.type}:${event.status}` : event.type)).toEqual([
      'summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'closing', 'done',
    ]);
    expect(warm).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0]?.[0].settings).toEqual({ nPredict: 110, temperature: 0.2, topP: 0.9, stop: ['<|eot_id|>'], seed: 7 });
    const second = await events('Ano ang ilalagay sa go bag?', deps);
    expect(second.map((event) => event.type === 'ai_status' ? `${event.type}:${event.status}` : event.type)).not.toContain('ai_status:loading_model');
  });

  it('keeps the summary when the model is absent or loading fails', async () => {
    for (const modelState of ['absent', 'unloaded'] as const) {
      const { deps, generate, logs } = harness();
      deps.model.state = () => modelState;
      const warm = vi.fn(async () => ({ ok: false as const, error: { code: 'load_failed' as const, message: 'SAMPLE load failure' } }));
      deps.model.warm = warm;
      const result = await events('Ano ang ilalagay sa go bag?', deps);
      expect(result.map((event) => event.type === 'ai_status' ? `${event.type}:${event.status}` : event.type)).toEqual(
        modelState === 'absent'
          ? ['summary', 'ai_status:skipped', 'closing', 'done']
          : ['summary', 'ai_status:loading_model', 'ai_status:skipped', 'closing', 'done'],
      );
      expect(result.at(-1)).toMatchObject({ outcome: 'answered_summary' });
      expect(logs[0]?.aiSkipReason).toBe('no_model');
      expect(warm).toHaveBeenCalledTimes(modelState === 'absent' ? 0 : 1);
      expect(generate).not.toHaveBeenCalled();
    }
  });

  it('places a phase change between the AI part and closing', async () => {
    const { deps, logs } = harness();
    deps.content = { ...deps.content, rules: FIXTURE_INTENTS };
    const result = await events('Nandito na ang bagyo, ano ang ilalagay sa go bag?', deps);
    const types = result.map((event) => event.type);
    expect(types.filter((type) => type === 'phase_change')).toHaveLength(1);
    expect(types.indexOf('phase_change')).toBe(types.indexOf('closing') - 1);
    expect(types.at(-1)).toBe('done');
    expect(logs[0]?.phaseChange).toMatchObject({ kind: 'switched', from: 'before', to: 'during' });
  });

  it('rejects an invalid answer, drops its phase hint, and keeps the summary', async () => {
    const raw = JSON.stringify({ used: ['missing-passage'], in_guide: true, phase_hint: 'during', answer: 'Ihanda ang go bag.' });
    const { deps, logs } = harness({ raw });
    const result = await events('Ano ang ilalagay sa go bag?', deps);
    expect(result.map((event) => event.type)).toEqual([
      'summary', 'ai_status', 'ai_partial', 'ai_rejected', 'closing', 'done',
    ]);
    expect(result.find((event) => event.type === 'ai_rejected')).toMatchObject({ code: 'bad_citation' });
    expect(result.at(-1)).toMatchObject({ outcome: 'answered_summary' });
    expect(logs[0]).toMatchObject({ phaseHint: null, failures: ['bad_citation'] });
  });

  it('puts an emergency card before the primary card', async () => {
    const { deps } = harness({ allowed: { allowed: false, reason: 'ai_off' } });
    deps.content = { ...deps.content, rules: FIXTURE_INTENTS };
    const result = await events('Lumulubog, ano ang ilalagay sa go bag?', deps);
    expect(result.map((event) => event.type)).toEqual([
      'emergency_card', 'summary', 'ai_status', 'closing', 'done',
    ]);
  });

  it('emits phase changes before closing and cancellation skips phase processing', async () => {
    const { deps, logs } = harness();
    const controller = new AbortController(); controller.abort();
    const result = await events('Ano ang ilalagay sa go bag?', deps, controller.signal);
    expect(result).toEqual([{ type: 'done', logId: 'log-test', outcome: 'cancelled' }]);
    expect(logs[0]?.outcome).toBe('cancelled');
  });
});
