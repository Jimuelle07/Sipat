import type { DeviceTier, Result } from '../types/common.ts';
import type {
  BuiltPrompt,
} from '../types/core.ts';
import type { ModelInstallError } from '../types/engine.ts';
import type {
  CompletionSettings, GenerateRequest, GenerateResult, ModelError, ModelManager, ModelState, PickedFile,
} from '../types/services.ts';

export const MODEL_FILE_NAME = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf';

/** Idle time before the loaded context is released (docs: 2 minutes). */
export const MODEL_IDLE_UNLOAD_MS = 2 * 60 * 1000;

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
  /** Restores the cached instruction prefix. Returns true when a session was loaded. */
  loadSession?(path: string): Promise<boolean>;
  /** Persists the instruction prefix after the first load. */
  saveSession?(path: string): Promise<void>;
}

export interface LlamaBackend {
  exists(path: string): Promise<boolean>;
  init(opts: { model: string; n_ctx: number; n_threads?: number }): Promise<LlamaCtx>;
  /** Copies a picked GGUF into app-private storage while hashing it. */
  install?(
    file: PickedFile, destPath: string, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal,
  ): Promise<void>;
  remove?(path: string): Promise<void>;
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
      copyAsync?: (opts: { from: string; to: string }) => Promise<void>;
      deleteAsync?: (path: string, opts?: { idempotent?: boolean }) => Promise<void>;
    };
    if (!llama?.initLlama || typeof fs?.getInfoAsync !== 'function') return null;
    if (typeof fs.copyAsync !== 'function' || typeof fs.deleteAsync !== 'function') return null;
    const ctxWithSession = llama as unknown as { initLlama: (opts: object) => Promise<Record<string, unknown>> };
    return {
      exists: async (path) => (await fs.getInfoAsync(path)).exists,
      init: async (opts) => {
        const ctx = (await ctxWithSession.initLlama({ ...opts, use_mmap: true, use_mlock: false })) as {
          completion: (params: unknown, cb: (data: { token?: string }) => void) => Promise<{ text: string; timings?: LlamaTimings }>;
          stopCompletion: () => Promise<void>;
          release: () => Promise<void>;
          loadSession?: (path: string) => Promise<boolean>;
          saveSession?: (path: string) => Promise<void>;
        };
        return {
          completion: async (params, onToken) => ctx.completion(params, (data) => {
            if (typeof data?.token === 'string') onToken(data.token);
          }),
          stopCompletion: () => ctx.stopCompletion(),
          release: () => ctx.release(),
          ...(typeof ctx.loadSession === 'function'
            ? { loadSession: (path: string) => ctx.loadSession!(path) }
            : {}),
          ...(typeof ctx.saveSession === 'function'
            ? { saveSession: (path: string) => ctx.saveSession!(path) }
            : {}),
        };
      },
      // The streaming SHA-256 check waits on the native module; this copies and reports progress.
      install: async (file, destPath, onProgress, signal) => {
        await fs.copyAsync!({ from: file.uri, to: destPath });
        if (signal?.aborted) {
          await fs.deleteAsync!(destPath, { idempotent: true });
          throw new Error('cancelled');
        }
        onProgress(file.size, file.size);
      },
      remove: async (path) => {
        await fs.deleteAsync!(path, { idempotent: true });
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
const iok = <T>(value: T): Result<T, ModelInstallError> => ({ ok: true, value });
const ierr = (code: ModelInstallError, message: string = code): Result<never, ModelInstallError> => ({ ok: false, error: { code, message } });

export function createModelManager(deps: {
  backend?: LlamaBackend | null;
  modelPath?: string;
  readTier: () => Promise<DeviceTier>;
  nCtx?: number;
  /** Idle time before the loaded context is released; 0 disables the timer (tests). */
  idleUnloadMs?: number;
}): ModelManager & { present(): Promise<boolean> } {
  const backend = deps.backend === undefined ? defaultLlamaBackend() : deps.backend;
  const modelPath = deps.modelPath ?? defaultModelPath();
  const sessionPath = `${modelPath}.session`;
  const nCtx = deps.nCtx ?? 1024;
  const idleUnloadMs = deps.idleUnloadMs ?? MODEL_IDLE_UNLOAD_MS;
  let current: ModelState = backend ? 'unloaded' : 'absent';
  let ctx: LlamaCtx | null = null;
  let generating = false;
  let lastLoadMs = 0;
  let loadAttempts = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
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

  const clearIdle = (): void => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
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
    if (loadAttempts >= 2) return err('load_failed', 'Could not load the on-device model');
    clearIdle();
    setState('loading');
    const started = Date.now();
    try {
      const loaded = await backend!.init({ model: modelPath, n_ctx: nCtx, n_threads: tier === 'lite' ? 2 : 4 });
      // Cache the fixed instruction prefix in a session file.
      let restored = false;
      if (typeof loaded.loadSession === 'function') {
        try { restored = await loaded.loadSession(sessionPath); } catch { restored = false; }
      }
      if (!restored && typeof loaded.saveSession === 'function') {
        try { await loaded.saveSession(sessionPath); } catch { /* prefix cache is optional */ }
      }
      ctx = loaded;
      lastLoadMs = Date.now() - started;
      loadAttempts = 0;
      setState('ready');
      return ok(undefined);
    } catch {
      ctx = null;
      loadAttempts += 1;
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
    clearIdle();
    if (generating) await stop();
    const loaded = ctx;
    ctx = null;
    if (loaded) {
      try { await loaded.release(); } catch { setState('error'); return; }
    }
    setState(await present() ? 'unloaded' : 'absent');
  };

  /** Releases the loaded context after a quiet period so the phone keeps its memory. */
  const armIdle = (): void => {
    if (idleUnloadMs <= 0) return;
    clearIdle();
    idleTimer = setTimeout(() => { void unload(); }, idleUnloadMs);
    (idleTimer as unknown as { unref?: () => void }).unref?.();
  };

  const install = async (
    file: PickedFile, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal,
  ): Promise<Result<void, ModelInstallError>> => {
    let tier: DeviceTier;
    try { tier = await deps.readTier(); } catch {
      return ierr('tier', 'Could not read device tier');
    }
    if (tier === 'none') return ierr('tier', 'This device tier does not support AI');
    if (!backend) return ierr('io', 'No native file backend is available');
    if (file.name !== MODEL_FILE_NAME) return ierr('wrong_file', 'The selected file is not the bundled model');
    if (signal?.aborted) return ierr('cancelled', 'Install was cancelled');
    if (typeof backend.install !== 'function') return ierr('io', 'Model install is not available on this build');
    try {
      await backend.install(file, modelPath, onProgress, signal);
    } catch {
      if (signal?.aborted) return ierr('cancelled', 'Install was cancelled');
      return ierr('io', 'Could not copy the model file');
    }
    await present();
    return iok(undefined);
  };

  const remove = async (): Promise<void> => {
    await unload();
    if (typeof backend?.remove === 'function') {
      try { await backend.remove(modelPath); } catch { /* leave the file in place */ }
    }
    setState(await present() ? 'unloaded' : 'absent');
  };

  const generate = async (
    req: GenerateRequest, onAnswerText: (textSoFar: string) => void, signal?: AbortSignal,
  ): Promise<Result<GenerateResult, ModelError>> => {
    if (generating) return err('busy', 'A generation is already in progress');
    generating = true;
    clearIdle();
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
        if (ctx) armIdle();
      }
    } finally {
      // Early exits before a completion also release the serialization lock.
      if (generating && current !== 'generating') generating = false;
    }
  };

  try {
    // Unload when the app leaves the foreground. Native only; Node tests skip this.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require('react-native') as {
      AppState?: { addEventListener?: (type: string, cb: (state: string) => void) => unknown };
    };
    AppState?.addEventListener?.('change', (state) => {
      if (state !== 'active') void unload();
    });
  } catch {
    /* no app lifecycle outside a React Native build */
  }

  return {
    state: () => current,
    tier: deps.readTier,
    warm,
    generate,
    stop,
    unload,
    present,
    install,
    remove,
    onStateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
