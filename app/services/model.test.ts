import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BuiltPrompt } from '../types/core.ts';
import type { DeviceTier } from '../types/common.ts';
import type { LlamaBackend, LlamaCtx, ModelFiles } from './model.ts';
import { createModelManager, extractAnswerText } from './model.ts';
import { BUNDLED_MODEL } from './modelEntry.ts';

const prompt: BuiltPrompt = {
  messages: [{ role: 'user', content: 'test' }],
  responseFormat: { type: 'json_schema', json_schema: { schema: {} } },
  allowedIds: ['p1'],
};
const request = { prompt, settings: { nPredict: 110, temperature: 0.2, topP: 0.9, stop: ['<|eot_id|>'], seed: 7 } };

function fakeFiles(over: Partial<ModelFiles> = {}): ModelFiles & { files: Set<string>; moved: [string, string][] } {
  const files = new Set(['/models/model.gguf', `/models/${BUNDLED_MODEL.file_name}`]);
  const moved: [string, string][] = [];
  return {
    files,
    moved,
    freeBytes: vi.fn(async () => 1000),
    exists: vi.fn(async (path) => files.has(path)),
    size: vi.fn(async (path) => files.has(path) ? 100 : null),
    copyWithSha256: vi.fn(async (_src, dest, onProgress) => { files.add(dest); onProgress(100, 100); return 'abc'; }),
    remove: vi.fn(async (path) => { files.delete(path); }),
    move: vi.fn(async (src, dest) => { files.delete(src); files.add(dest); moved.push([src, dest]); }),
    ...over,
  };
}

function backendFor(ctx: LlamaCtx, init = vi.fn(async () => ctx)): LlamaBackend {
  return { init };
}

function context(): LlamaCtx {
  return {
    completion: vi.fn(async (_params, onToken) => {
      onToken('{"used":["p1"],"in_guide":true,"answer":"Hel');
      onToken('lo!"}');
      return { text: '{"used":["p1"],"in_guide":true,"answer":"Hello!"}', timings: { prompt_n: 45, prompt_ms: 120, predicted_n: 6 } };
    }),
    stopCompletion: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
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
    const files = fakeFiles({ exists: async () => false });
    const manager = createModelManager({ files, backend: backendFor(context()), modelDir: '/models', readTier: async () => 'full', idleUnloadMs: 0 });
    expect(await manager.present()).toBe(false);
    expect(manager.state()).toBe('absent');
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'no_model' } });
  });

  it('streams partial answer text, passes completion settings, and unloads', async () => {
    const ctx = context();
    const manager = createModelManager({ files: fakeFiles(), backend: backendFor(ctx), modelDir: '/models', readTier: async () => 'full', idleUnloadMs: 0 });
    const chunks: string[] = [];
    const result = await manager.generate(request, (text) => chunks.push(text));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ timings: { promptTokens: 45, promptMs: 120, predictedTokens: 6 } });
    expect(chunks).toEqual(['Hel', 'Hello!']);
    expect(ctx.completion).toHaveBeenCalledWith(expect.objectContaining({
      messages: prompt.messages, response_format: prompt.responseFormat, n_predict: 110, seed: 7,
    }), expect.any(Function));
    await manager.unload();
    expect(ctx.release).toHaveBeenCalledOnce();
  });

  it('returns busy for overlapping generation and cancels through stopCompletion', async () => {
    let resolveCompletion!: (value: { text: string }) => void;
    const ctx: LlamaCtx = {
      completion: vi.fn(() => new Promise<{ text: string }>((resolvePromise) => { resolveCompletion = resolvePromise; })),
      stopCompletion: vi.fn(async () => undefined), release: vi.fn(async () => undefined),
    };
    const manager = createModelManager({ files: fakeFiles(), backend: backendFor(ctx), modelDir: '/models', readTier: async () => 'full', idleUnloadMs: 0 });
    const controller = new AbortController();
    const first = manager.generate(request, () => undefined, controller.signal);
    await vi.waitFor(() => expect(manager.state()).toBe('generating'));
    expect(await manager.generate(request, () => undefined)).toMatchObject({ ok: false, error: { code: 'busy' } });
    controller.abort();
    expect(ctx.stopCompletion).toHaveBeenCalledOnce();
    resolveCompletion({ text: '{}' });
    expect(await first).toMatchObject({ ok: false, error: { code: 'cancelled' } });
  });

  it('retries a failed native load once, then remains in error for this session', async () => {
    const init = vi.fn(async () => { throw new Error('native init failed'); });
    const manager = createModelManager({ files: fakeFiles(), backend: { init }, modelDir: '/models', readTier: async () => 'full', idleUnloadMs: 0 });
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'load_failed' } });
    expect(manager.state()).toBe('error');
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'load_failed' } });
    expect(manager.state()).toBe('error');
    expect(await manager.warm()).toMatchObject({ ok: false, error: { code: 'load_failed' } });
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('loads or creates the cached session prefix', async () => {
    const prefix: BuiltPrompt['messages'] = [
      { role: 'system', content: 'gabay' },
      { role: 'user', content: 'halimbawa' },
    ];
    const ctx = { ...context(), loadSession: vi.fn(async () => false), saveSession: vi.fn(async () => undefined) };
    const manager = createModelManager({
      files: fakeFiles(), backend: backendFor(ctx), modelDir: '/models', readTier: async () => 'lite', idleUnloadMs: 0,
      instructionPrefix: () => prefix,
    });
    expect(await manager.warm()).toMatchObject({ ok: true });
    const session = `/models/${BUNDLED_MODEL.file_name}.session`;
    expect(ctx.loadSession).toHaveBeenCalledWith(session);
    expect(ctx.completion).toHaveBeenCalledWith(expect.objectContaining({ messages: prefix, n_predict: 0 }), expect.any(Function));
    expect(ctx.saveSession).toHaveBeenCalledWith(session);
  });
});

const INSTALL_EXPECTED = { file_name: 'model.gguf', size: 100, sha256: 'abc' };
const picked = { uri: 'file:///picked/model.gguf', name: 'model.gguf', size: 100 };

function installManager(options: {
  tier?: DeviceTier;
  files?: ReturnType<typeof fakeFiles>;
  file?: typeof picked;
  expected?: typeof INSTALL_EXPECTED;
  installMarginBytes?: number;
} = {}) {
  const files = options.files ?? fakeFiles();
  const manager = createModelManager({
    backend: backendFor(context()), files, modelDir: '/models', readTier: async () => options.tier ?? 'full', idleUnloadMs: 0,
    expected: options.expected ?? INSTALL_EXPECTED, installMarginBytes: options.installMarginBytes ?? 0,
  });
  return { files, manager };
}

describe('ModelManager install', () => {
  it('checks tier before storage and copies nothing on none tier', async () => {
    const { files, manager } = installManager({ tier: 'none' });
    expect(await manager.install(picked, () => undefined)).toMatchObject({ ok: false, error: { code: 'tier' } });
    expect(files.freeBytes).not.toHaveBeenCalled();
    expect(files.copyWithSha256).not.toHaveBeenCalled();
  });

  it('checks free space before validating the selected file', async () => {
    const files = fakeFiles({ freeBytes: async () => 99 });
    const { manager } = installManager({ files, file: { ...picked, name: 'wrong.gguf' } });
    expect(await manager.install({ ...picked, name: 'wrong.gguf' }, () => undefined)).toMatchObject({ ok: false, error: { code: 'no_space' } });
    expect(files.copyWithSha256).not.toHaveBeenCalled();
  });

  it('rejects wrong name or size without copying', async () => {
    const { files, manager } = installManager();
    expect(await manager.install({ ...picked, name: 'wrong.gguf' }, () => undefined)).toMatchObject({ ok: false, error: { code: 'wrong_file' } });
    expect(await manager.install({ ...picked, size: 99 }, () => undefined)).toMatchObject({ ok: false, error: { code: 'wrong_file' } });
    expect(files.copyWithSha256).not.toHaveBeenCalled();
  });

  it('moves a valid partial model into place and relays progress', async () => {
    const { files, manager } = installManager();
    const progress: [number, number][] = [];
    expect(await manager.install(picked, (bytes, total) => progress.push([bytes, total]))).toMatchObject({ ok: true });
    expect(progress).toEqual([[100, 100]]);
    expect(files.moved).toEqual([['/models/model.gguf.part', '/models/model.gguf']]);
  });

  it('deletes the partial file on hash mismatch, cancellation, and I/O failure', async () => {
    const mismatch = fakeFiles({ copyWithSha256: async (_src, dest) => { mismatch.files.add(dest); return 'nope'; } });
    const a = installManager({ files: mismatch });
    expect(await a.manager.install(picked, () => undefined)).toMatchObject({ ok: false, error: { code: 'hash_mismatch' } });
    expect(mismatch.files.has('/models/model.gguf.part')).toBe(false);

    const cancelled = fakeFiles({ copyWithSha256: async (_src, dest) => { cancelled.files.add(dest); throw new Error('cancelled'); } });
    const b = installManager({ files: cancelled });
    expect(await b.manager.install(picked, () => undefined)).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    expect(cancelled.files.has('/models/model.gguf.part')).toBe(false);

    const failed = fakeFiles({ copyWithSha256: async (_src, dest) => { failed.files.add(dest); throw new Error('disk'); } });
    const c = installManager({ files: failed });
    expect(await c.manager.install(picked, () => undefined)).toMatchObject({ ok: false, error: { code: 'io' } });
    expect(failed.files.has('/models/model.gguf.part')).toBe(false);
  });
});

it.skipIf(!existsSync(resolve(process.cwd(), 'models', BUNDLED_MODEL.file_name)))(
  'streams the bundled GGUF through Node and matches its documented size and SHA-256', async () => {
    const path = resolve(process.cwd(), 'models', BUNDLED_MODEL.file_name);
    const info = statSync(path);
    const testFiles: ModelFiles = {
      freeBytes: async () => info.size,
      exists: async () => true,
      size: async () => info.size,
      copyWithSha256: async (srcUri, _dest, onProgress) => new Promise((resolveHash, reject) => {
        const hash = createHash('sha256');
        let bytes = 0;
        createReadStream(srcUri).on('data', (chunk: string | Buffer) => {
          hash.update(chunk);
          bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
          onProgress(bytes, info.size);
        }).on('error', reject).on('end', () => resolveHash(hash.digest('hex')));
      }),
      remove: async () => undefined,
      move: async () => undefined,
    };
    const fileHash = await testFiles.copyWithSha256(path, '', () => undefined);
    expect(info.size).toBe(BUNDLED_MODEL.size);
    expect(fileHash).toBe(BUNDLED_MODEL.sha256);
  }, 5 * 60 * 1000,
);
