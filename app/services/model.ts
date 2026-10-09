import type { DeviceTier, Result } from '../types/common.ts';
import type { BuiltPrompt } from '../types/core.ts';
import type { ModelInstallError } from '../types/engine.ts';
import type {
  CompletionSettings, GenerateRequest, GenerateResult, ModelError, ModelManager, ModelState, PickedFile,
} from '../types/services.ts';
import { EXAMPLE_1_JSON, EXAMPLE_1_USER, EXAMPLE_2_JSON, EXAMPLE_2_USER, SYSTEM_TL } from '../core/prompt.ts';
import { BUNDLED_MODEL } from './modelEntry.ts';

export const MODEL_FILE_NAME = BUNDLED_MODEL.file_name;
export const MODEL_IDLE_UNLOAD_MS = 2 * 60 * 1000;

/** The fixed system + worked-example turns (section 8). Cached as the session prefix; the last user turn is variable. */
export const FIXED_INSTRUCTION_PREFIX: BuiltPrompt['messages'] = [
  { role: 'system', content: SYSTEM_TL },
  { role: 'user', content: EXAMPLE_1_USER },
  { role: 'assistant', content: EXAMPLE_1_JSON },
  { role: 'user', content: EXAMPLE_2_USER },
  { role: 'assistant', content: EXAMPLE_2_JSON },
];

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
  loadSession?(path: string): Promise<boolean>;
  saveSession?(path: string): Promise<void>;
}

export interface LlamaBackend {
  init(opts: { model: string; n_ctx: number; n_threads: number; use_mmap: true; use_mlock: false }): Promise<LlamaCtx>;
}

export interface ModelFiles {
  freeBytes(): Promise<number>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number | null>;
  copyWithSha256(
    srcUri: string, destPath: string, onProgress: (bytes: number, total: number) => void, signal?: AbortSignal,
  ): Promise<string>;
  remove(path: string): Promise<void>;
  move(srcPath: string, destPath: string): Promise<void>;
}

/** Native dependencies are resolved lazily so importing the service remains safe in Node. */
export function defaultModelFiles(): ModelFiles | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as {
      Paths: { document: unknown; availableDiskSpace: number };
      File: new (...parts: unknown[]) => {
        uri: string; exists: boolean; size: number; open(mode?: string): {
          size: number | null; readBytes(length: number): Uint8Array; writeBytes(bytes: Uint8Array): void; close(): void;
        };
        create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
        delete(): void;
        move(destination: unknown): void;
      };
      Directory: new (...parts: unknown[]) => {
        create(options?: { intermediates?: boolean; idempotent?: boolean }): void;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('react-native-quick-crypto') as {
      createHash(algorithm: string): { update(chunk: Uint8Array): void; digest(encoding: 'hex'): string };
    };
    if (!fs?.File || !fs?.Directory || !fs?.Paths || !crypto?.createHash) return null;
    const chunkSize = 1024 * 1024;
    const fileFor = (path: string) => new fs.File(path);
    return {
      freeBytes: async () => fs.Paths.availableDiskSpace,
      exists: async (path) => fileFor(path).exists,
      size: async (path) => {
        const file = fileFor(path);
        return file.exists ? file.size : null;
      },
      copyWithSha256: async (srcUri, destPath, onProgress, signal) => {
        const source = fileFor(srcUri);
        const dest = fileFor(destPath);
        const directory = new fs.Directory(fs.Paths.document, 'models');
        directory.create({ intermediates: true, idempotent: true });
        if (dest.exists) dest.delete();
        dest.create({ intermediates: true, overwrite: true });
        const input = source.open('r');
        const output = dest.open('w');
        const total = input.size ?? source.size;
        const hash = crypto.createHash('sha256');
        let bytes = 0;
        try {
          while (bytes < total) {
            if (signal?.aborted) throw new Error('cancelled');
            const chunk = input.readBytes(Math.min(chunkSize, total - bytes));
            if (chunk.byteLength === 0) throw new Error('Unexpected end of model file');
            hash.update(chunk);
            output.writeBytes(chunk);
            bytes += chunk.byteLength;
            onProgress(bytes, total);
          }
          if (signal?.aborted) throw new Error('cancelled');
          return hash.digest('hex');
        } finally {
          input.close();
          output.close();
        }
      },
      remove: async (path) => { const file = fileFor(path); if (file.exists) file.delete(); },
      move: async (srcPath, destPath) => {
        const destination = fileFor(destPath);
        if (destination.exists) destination.delete();
        await fileFor(srcPath).move(destination);
      },
    };
  } catch {
    return null;
  }
}

export function defaultLlamaBackend(): LlamaBackend | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const llama = require('llama.rn') as {
      initLlama: (opts: object) => Promise<{
        completion: (params: unknown, cb: (data: { token?: string }) => void) => Promise<{ text: string; timings?: LlamaTimings }>;
        stopCompletion: () => Promise<void>;
        release: () => Promise<void>;
        loadSession?: (path: string) => Promise<boolean>;
        saveSession?: (path: string) => Promise<void>;
      }>;
    };
    if (typeof llama?.initLlama !== 'function') return null;
    return {
      init: async (opts) => {
        const ctx = await llama.initLlama(opts);
        return {
          completion: async (params, onToken) => ctx.completion(params, (data) => {
            if (typeof data?.token === 'string') onToken(data.token);
          }),
          stopCompletion: () => ctx.stopCompletion(),
          release: () => ctx.release(),
          ...(typeof ctx.loadSession === 'function' ? { loadSession: (path: string) => ctx.loadSession!(path) } : {}),
          ...(typeof ctx.saveSession === 'function' ? { saveSession: (path: string) => ctx.saveSession!(path) } : {}),
        };
      },
    };
  } catch {
    return null;
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
  files?: ModelFiles | null;
  modelDir?: string;
  readTier: () => Promise<DeviceTier>;
  nCtx?: number;
  idleUnloadMs?: number;
  expected?: { file_name: string; size: number; sha256: string };
  installMarginBytes?: number;
  onBackground?: (cb: () => void) => () => void;
  instructionPrefix?: () => BuiltPrompt['messages'];
}): ModelManager & { present(): Promise<boolean> } {
  const backend = deps.backend === undefined ? defaultLlamaBackend() : deps.backend;
  const files = deps.files === undefined ? defaultModelFiles() : deps.files;
  const expected = deps.expected ?? BUNDLED_MODEL;
  const instructionPrefix = deps.instructionPrefix ?? (() => FIXED_INSTRUCTION_PREFIX);
  let modelDir = deps.modelDir;
  if (!modelDir) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('expo-file-system') as { Paths: { document: { uri: string } } };
      modelDir = `${fs.Paths.document.uri.replace(/\/$/, '')}/models`;
    } catch { modelDir = 'models'; }
  }
  const modelPath = `${modelDir}/${expected.file_name}`;
  const partialPath = `${modelPath}.part`;
  const sessionPath = `${modelPath}.session`;
  const nCtx = deps.nCtx ?? 1024;
  const idleUnloadMs = deps.idleUnloadMs ?? MODEL_IDLE_UNLOAD_MS;
  let current: ModelState = backend && files ? 'unloaded' : 'absent';
  let ctx: LlamaCtx | null = null;
  let generating = false;
  let lastLoadMs = 0;
  let loadAttempts = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let removeBackgroundListener: (() => void) | null = null;
  const listeners = new Set<(s: ModelState) => void>();
  const setState = (next: ModelState) => {
    if (current === next) return;
    current = next;
    listeners.forEach((listener) => listener(next));
  };

  const present = async () => {
    if (!files || !backend) { setState('absent'); return false; }
    try {
      const exists = await files.exists(modelPath);
      if (!exists && !generating) setState('absent');
      else if (exists && current === 'absent') setState('unloaded');
      return exists;
    } catch {
      if (!generating) setState('absent');
      return false;
    }
  };
  const clearIdle = (): void => {
    if (idleTimer !== null) { clearTimeout(idleTimer); idleTimer = null; }
  };
  const detachBackground = (): void => {
    removeBackgroundListener?.();
    removeBackgroundListener = null;
  };
  const attachBackground = (): void => {
    if (removeBackgroundListener) return;
    try {
      if (deps.onBackground) removeBackgroundListener = deps.onBackground(() => { void unload(); });
      else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AppState } = require('react-native') as {
          AppState?: { addEventListener?: (type: string, cb: (state: string) => void) => { remove(): void } };
        };
        const subscription = AppState?.addEventListener?.('change', (state) => {
          if (state !== 'active') void unload();
        });
        if (subscription) removeBackgroundListener = () => subscription.remove();
      }
    } catch { /* lifecycle events are unavailable in Node */ }
  };

  const warm = async (): Promise<Result<void, ModelError>> => {
    if (!(await present())) return err('no_model', 'Model file or native backend is unavailable');
    let tier: DeviceTier;
    try { tier = await deps.readTier(); } catch { return err('native', 'Could not read device tier'); }
    if (tier === 'none') return err('tier', 'This device tier does not support AI');
    if (ctx) return ok(undefined);
    if (loadAttempts >= 2) return err('load_failed', 'Could not load the on-device model');
    clearIdle();
    setState('loading');
    const started = Date.now();
    try {
      const loaded = await backend!.init({ model: modelPath, n_ctx: nCtx, n_threads: tier === 'lite' ? 2 : 4, use_mmap: true, use_mlock: false });
      let restored = false;
      if (typeof loaded.loadSession === 'function') {
        try { restored = await loaded.loadSession(sessionPath); } catch { restored = false; }
      }
      if (!restored && typeof loaded.saveSession === 'function') {
        try {
          const prefix = instructionPrefix();
          if (prefix.length > 0) {
            await loaded.completion(
              { messages: prefix, n_predict: 0, temperature: 0, top_p: 1, stop: [] },
              () => undefined,
            );
          }
          await loaded.saveSession(sessionPath);
        } catch { /* prefix cache is optional */ }
      }
      ctx = loaded;
      lastLoadMs = Date.now() - started;
      setState('ready');
      attachBackground();
      armIdle();
      return ok(undefined);
    } catch {
      ctx = null;
      loadAttempts += 1;
      setState('error');
      return err('load_failed', 'Could not load the on-device model');
    }
  };
  const stop = async () => {
    if (ctx && generating) { try { await ctx.stopCompletion(); } catch { /* completion reports its own result */ } }
  };
  const unload = async () => {
    clearIdle();
    if (generating) await stop();
    const loaded = ctx;
    ctx = null;
    detachBackground();
    if (loaded) {
      try { await loaded.release(); } catch { setState('error'); return; }
    }
    setState(await present() ? 'unloaded' : 'absent');
  };
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
    try { tier = await deps.readTier(); } catch { return ierr('tier', 'Could not read device tier'); }
    if (tier === 'none') return ierr('tier', 'This device tier does not support AI');
    if (!files) return ierr('io', 'Model file access is unavailable');
    let freeBytes: number;
    try { freeBytes = await files.freeBytes(); } catch { return ierr('io', 'Could not check free storage'); }
    if (freeBytes < expected.size + (deps.installMarginBytes ?? 64 * 1024 * 1024)) return ierr('no_space', 'Not enough free storage for the model');
    if (file.name !== expected.file_name || file.size !== expected.size) return ierr('wrong_file', 'The selected file is not the bundled model');
    try {
      if (signal?.aborted) throw new Error('cancelled');
      const digest = await files.copyWithSha256(file.uri, partialPath, onProgress, signal);
      if (signal?.aborted) throw new Error('cancelled');
      if (digest.toLowerCase() !== expected.sha256.toLowerCase()) {
        await files.remove(partialPath);
        return ierr('hash_mismatch', 'The selected file hash does not match');
      }
      await files.move(partialPath, modelPath);
      setState('unloaded');
      return iok(undefined);
    } catch (error) {
      try { await files.remove(partialPath); } catch { /* cleanup is best effort */ }
      if (signal?.aborted || (error instanceof Error && error.message === 'cancelled')) return ierr('cancelled', 'Install was cancelled');
      return ierr('io', 'Could not copy the model file');
    }
  };

  const remove = async (): Promise<void> => {
    await unload();
    try { await files?.remove(modelPath); } catch { /* retain the current state if storage rejects deletion */ }
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
      clearIdle();
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
          messages: req.prompt.messages, response_format: req.prompt.responseFormat,
          n_predict: settings.nPredict, temperature: settings.temperature, top_p: settings.topP,
          stop: settings.stop, ...(settings.seed === undefined ? {} : { seed: settings.seed }),
        };
        const result = await activeCtx.completion(params, (token) => {
          if (firstTokenMs === undefined) firstTokenMs = Date.now() - started;
          raw += token;
          onAnswerText(extractAnswerText(raw));
        });
        if (aborted || signal?.aborted) return err('cancelled', 'Generation was cancelled');
        const timings = result.timings ?? {};
        return ok({ raw: result.text || raw, timings: {
          loadMs, promptTokens: timings.prompt_n ?? 0, promptMs: timings.prompt_ms ?? 0,
          firstTokenMs: firstTokenMs ?? 0, predictedTokens: timings.predicted_n ?? 0,
        } });
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
      if (generating && current !== 'generating') generating = false;
    }
  };

  return {
    state: () => current, tier: deps.readTier, warm, generate, stop, unload, present, install, remove,
    onStateChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
