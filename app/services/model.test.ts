import { describe, expect, it, vi } from 'vitest';
import type { BuiltPrompt } from '../types/core.ts';
import type { DeviceTier } from '../types/common.ts';
import type { LlamaBackend, LlamaCtx } from './model.ts';
import { createModelManager, extractAnswerText } from './model.ts';

const prompt: BuiltPrompt = {
  messages: [{ role: 'user', content: 'test' }],
  responseFormat: { type: 'json_schema', json_schema: { schema: {} } },
  allowedIds: ['p1'],
};
const request = { prompt, settings: { nPredict: 110, temperature: 0.2, topP: 0.9, stop: ['<|eot_id|>'], seed: 7 } };

function harness(tier: DeviceTier = 'full') {
  const completion = vi.fn(async (_params: unknown, onToken: (token: string) => void) => {
    onToken('{"used":["p1"],"in_guide":true,"answer":"Hel');
    onToken('lo!"}');
    return {
      text: '{"used":["p1"],"in_guide":true,"answer":"Hello!"}',
      timings: { prompt_n: 45, prompt_ms: 120, predicted_n: 6 },
    };
  });
  const stopCompletion = vi.fn(async () => undefined);
  const release = vi.fn(async () => undefined);
  const ctx: LlamaCtx = { completion, stopCompletion, release };
  const backend: LlamaBackend = { exists: vi.fn(async () => true), init: vi.fn(async () => ctx) };
  const manager = createModelManager({ backend, modelPath: '/model.gguf', readTier: async () => tier });
  return { manager, backend, ctx, completion, stopCompletion, release };
}

describe('extractAnswerText', () => {
  it('extracts progressively decoded JSON strings and handles escapes', () => {
    expect(extractAnswerText('{"used":[],"answer":"Kamusta\\nsa \\"bahay')).toBe('Kamusta\nsa "bahay');
    expect(extractAnswerText('{"answer":"hello\\')).toBe('hello');
    expect(extractAnswerText('{"answer":')).toBe('');
  });
});

describe('ModelManager', () => {
  it('reports an absent model and refuses to warm a missing file', async () => {
    const manager = createModelManager({
      backend: { exists: async () => false, init: vi.fn() }, readTier: async () => 'full',
    });
    expect(await manager.present()).toBe(false);
    expect(manager.state()).toBe('absent');
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'no_model' } });
  });

  it('does not initialize on the none tier', async () => {
    const { manager, backend } = harness('none');
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'tier' } });
    expect(backend.init).not.toHaveBeenCalled();
  });

  it('streams the partial answer, reports native timings, serializes, and unloads', async () => {
    const { manager, completion, ctx } = harness();
    const chunks: string[] = [];
    const result = await manager.generate(request, (text) => chunks.push(text));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ raw: expect.any(String), timings: {
      loadMs: expect.any(Number), promptTokens: 45, promptMs: 120, predictedTokens: 6,
    } });
    expect(chunks).toEqual(['Hel', 'Hello!']);
    expect(manager.state()).toBe('ready');
    expect(completion).toHaveBeenCalledWith(expect.objectContaining({
      messages: prompt.messages, response_format: prompt.responseFormat, n_predict: 110, seed: 7,
    }), expect.any(Function));
    await manager.unload();
    expect(ctx.release).toHaveBeenCalledOnce();
    expect(manager.state()).toBe('unloaded');
  });

  it('returns busy for overlapping generation and cancels through stopCompletion', async () => {
    const { stopCompletion } = harness();
    let resolveCompletion!: (value: { text: string }) => void;
    // A dedicated deferred backend lets the first completion remain active.
    const ctx: LlamaCtx = {
      completion: vi.fn(() => new Promise<{ text: string }>((resolve) => { resolveCompletion = resolve; })),
      stopCompletion,
      release: vi.fn(async () => undefined),
    };
    const live = createModelManager({
      backend: { exists: async () => true, init: async () => ctx }, readTier: async () => 'full',
    });
    const controller = new AbortController();
    const first = live.generate(request, () => undefined, controller.signal);
    await vi.waitFor(() => expect(live.state()).toBe('generating'));
    expect(await live.generate(request, () => undefined)).toMatchObject({ ok: false, error: { code: 'busy' } });
    controller.abort();
    expect(stopCompletion).toHaveBeenCalledOnce();
    resolveCompletion({ text: '{}' });
    expect(await first).toMatchObject({ ok: false, error: { code: 'cancelled' } });
  });
});
