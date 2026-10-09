import type { DeviceTier, Result } from '../types/common.ts';
import type {
  BuiltPrompt,
} from '../types/core.ts';
import type {
  CompletionSettings, GenerateRequest, GenerateResult, ModelError, ModelManager, ModelState,
} from '../types/services.ts';

export const MODEL_FILE_NAME = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';

type CompletionParams = {
  messages: BuiltPrompt['messages'];
  response_format?: BuiltPrompt['responseFormat'];
  grammar?: string;
  n_predict: number;
  temperature: number;
  top_p: number;
  stop: string[];
  seed?: number;
};

export interface LlamaTimings { prompt_n?: number; prompt_ms?: number; predicted_n?: number }

export interface LlamaCtx {
  completion(params: CompletionParams, onToken: (tok: string) => void): Promise<{ text: string; timings?: LlamaTimings }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
}

export interface LlamaBackend {
  exists(path: string): Promise<boolean>;
  init(opts: { model: string; n_ctx: number; n_threads?: number }): Promise<LlamaCtx>;
}

/** Native dependencies stay out of module initialization so core logic can run in Node and web. */
export function defaultLlamaBackend(): LlamaBackend | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const llama = require('llama.rn') as { initLlama: (opts: object) => Promise<any> };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system/legacy') as {
      documentDirectory?: string | null;
      getInfoAsync: (path: string) => Promise<{ exists: boolean }>;
    };
    if (!llama?.initLlama || typeof fs?.getInfoAsync !== 'function') return null;
    return {
      exists: async (path) => (await fs.getInfoAsync(path)).exists,
      init: async (opts) => {
        const ctx = await llama.initLlama({ ...opts, use_mmap: true, use_mlock: false });
        return {
          completion: async (params, onToken) => ctx.completion(params, (data: { token?: string }) => {
            if (typeof data?.token === 'string') onToken(data.token);
          }),
          stopCompletion: () => ctx.stopCompletion(),
          release: () => ctx.release(),
        };
      },
    };
  } catch {
    return null;
  }
}

function defaultModelPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system/legacy') as { documentDirectory?: string | null };
    return `${fs.documentDirectory ?? ''}models/${MODEL_FILE_NAME}`;
  } catch {
    return `models/${MODEL_FILE_NAME}`;
  }
}

/** Reads the answer string from an incomplete JSON stream, including escaped characters. */
export function extractAnswerText(partialJson: string): string {
  const key = /"answer"\s*:\s*"/g;
  const match = key.exec(partialJson);
  if (!match) return '';
  let text = '';
  let escaped = false;
  for (let i = match.index + match[0].length; i < partialJson.length; i += 1) {
    const ch = partialJson[i];
    if (escaped) {
      if (ch === 'n') text += '\n';
      else if (ch === 'r') text += '\r';
      else if (ch === 't') text += '\t';
      else if (ch === 'b') text += '\b';
      else if (ch === 'f') text += '\f';
      else if (ch === 'u') {
        const hex = partialJson.slice(i + 1, i + 5);
        if (hex.length < 4 || !/^[\da-f]{4}$/i.test(hex)) break;
        text += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else text += ch;
      escaped = false;
    } else if (ch === '\\') escaped = true;
    else if (ch === '"') break;
    else text += ch;
  }
  return text;
}

const ok = <T>(value: T): Result<T, ModelError> => ({ ok: true, value });
const err = (code: ModelError, message: string = code): Result<never, ModelError> => ({ ok: false, error: { code, message } });

export function createModelManager(deps: {
  backend?: LlamaBackend | null;
  modelPath?: string;
  readTier: () => Promise<DeviceTier>;
  nCtx?: number;
}): ModelManager & { present(): Promise<boolean> } {
  const backend = deps.backend === undefined ? defaultLlamaBackend() : deps.backend;
  const modelPath = deps.modelPath ?? defaultModelPath();
  const nCtx = deps.nCtx ?? 1024;
  let current: ModelState = backend ? 'unloaded' : 'absent';
  let ctx: LlamaCtx | null = null;
  let generating = false;
  let lastLoadMs = 0;
  const listeners = new Set<(s: ModelState) => void>();
  const setState = (next: ModelState) => {
    if (current === next) return;
    current = next;
    listeners.forEach((listener) => listener(next));
  };

  const present = async () => {
    if (!backend) { setState('absent'); return false; }
    try {
      const exists = await backend.exists(modelPath);
      if (!exists && !generating) setState('absent');
      else if (exists && current === 'absent') setState('unloaded');
      return exists;
    } catch {
      if (!generating) setState('absent');
      return false;
    }
  };

  const warm = async (): Promise<Result<void, ModelError>> => {
    if (!(await present())) return err('no_model', 'Model file or native backend is unavailable');
    let tier: DeviceTier;
    try { tier = await deps.readTier(); } catch {
      return err('native', 'Could not read device tier');
    }
    if (tier === 'none') return err('tier', 'This device tier does not support AI');
    if (ctx) return ok(undefined);
    setState('loading');
    const started = Date.now();
    try {
      ctx = await backend!.init({ model: modelPath, n_ctx: nCtx, n_threads: tier === 'lite' ? 2 : 4 });
      lastLoadMs = Date.now() - started;
      setState('ready');
      return ok(undefined);
    } catch {
      ctx = null;
      setState('error');
      return err('load_failed', 'Could not load the on-device model');
    }
  };

  const stop = async () => {
    if (ctx && generating) {
      try { await ctx.stopCompletion(); } catch { /* completion will report its own result */ }
    }
  };

  const unload = async () => {
    if (generating) await stop();
    const loaded = ctx;
    ctx = null;
    if (loaded) {
      try { await loaded.release(); } catch { setState('error'); return; }
    }
    setState(await present() ? 'unloaded' : 'absent');
  };

  const generate = async (
    req: GenerateRequest, onAnswerText: (textSoFar: string) => void, signal?: AbortSignal,
  ): Promise<Result<GenerateResult, ModelError>> => {
    if (generating) return err('busy', 'A generation is already in progress');
    generating = true;
    let aborted = signal?.aborted ?? false;
    let loadMs = 0;
    try {
      if (aborted) return err('cancelled', 'Generation was cancelled');
      const alreadyLoaded = ctx !== null;
      const loaded = await warm();
      if (!loaded.ok) return loaded;
      loadMs = alreadyLoaded ? 0 : lastLoadMs;
      const activeCtx = ctx;
      if (!activeCtx) return err('load_failed', 'Model context was not created');
      setState('generating');
      let raw = '';
      let firstTokenMs: number | undefined;
      const started = Date.now();
      const onAbort = () => { aborted = true; void activeCtx.stopCompletion().catch(() => undefined); };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
      try {
        const settings: CompletionSettings = req.settings;
        const params: CompletionParams = {
          messages: req.prompt.messages,
          response_format: req.prompt.responseFormat,
          n_predict: settings.nPredict,
          temperature: settings.temperature,
          top_p: settings.topP,
          stop: settings.stop,
          ...(settings.seed === undefined ? {} : { seed: settings.seed }),
        };
        const result = await activeCtx.completion(params, (token) => {
          if (firstTokenMs === undefined) firstTokenMs = Date.now() - started;
          raw += token;
          onAnswerText(extractAnswerText(raw));
        });
        if (aborted || signal?.aborted) return err('cancelled', 'Generation was cancelled');
        const timings = result.timings ?? {};
        return ok({
          raw: result.text || raw,
          timings: {
            loadMs,
            promptTokens: timings.prompt_n ?? 0,
            promptMs: timings.prompt_ms ?? 0,
            firstTokenMs: firstTokenMs ?? 0,
            predictedTokens: timings.predicted_n ?? 0,
          },
        });
      } catch {
        if (aborted || signal?.aborted) return err('cancelled', 'Generation was cancelled');
        setState('error');
        return err('native', 'On-device generation failed');
      } finally {
        signal?.removeEventListener('abort', onAbort);
        generating = false;
        if (current !== 'error') setState(ctx ? 'ready' : (await present() ? 'unloaded' : 'absent'));
      }
    } finally {
      // Early exits before a completion also release the serialization lock.
      if (generating && current !== 'generating') generating = false;
    }
  };

  return {
    state: () => current,
    tier: deps.readTier,
    warm,
    generate,
    stop,
    unload,
    present,
    onStateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
