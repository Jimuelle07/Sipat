import type { Store, StoreKey, StoreSchema } from '../types/services.ts';

interface MMKVLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove?: (key: string) => unknown;
  delete?: (key: string) => unknown;
}

export interface CreateStoreOptions {
  backend?: 'auto' | 'mmkv' | 'memory';
}

type RawGet = (key: string) => string | undefined;
type RawSet = (key: string, value: string) => void;
type RawDelete = (key: string) => void;

function parseJson<T>(raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Shared store behavior: values are JSON strings, so reads always return a fresh clone. */
function makeStore(getRaw: RawGet, setRaw: RawSet, deleteRaw: RawDelete): Store {
  return {
    get<K extends StoreKey>(key: K): StoreSchema[K] | undefined {
      return parseJson<StoreSchema[K]>(getRaw(key as string));
    },
    set<K extends StoreKey>(key: K, value: StoreSchema[K]): void {
      const raw = JSON.stringify(value);
      if (raw === undefined) deleteRaw(key as string);
      else setRaw(key as string, raw);
    },
    delete(key: StoreKey): void {
      deleteRaw(key as string);
    },
  };
}

/**
 * Map-backed store. Values are serialized on write and parsed on read, so callers can
 * neither mutate the stored state through a returned object nor through the object they set.
 */
export function createMemoryStore(initial: Partial<StoreSchema> = {}): Store {
  const data = new Map<string, string>();
  const store = makeStore(
    (key) => data.get(key),
    (key, value) => {
      data.set(key, value);
    },
    (key) => {
      data.delete(key);
    },
  );
  for (const [key, value] of Object.entries(initial)) {
    if (value !== undefined) store.set(key as StoreKey, value as never);
  }
  return store;
}

function loadMmkv(id: string): MMKVLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-mmkv') as {
      createMMKV?: (config: { id: string }) => MMKVLike;
      MMKV?: new (config: { id: string }) => MMKVLike;
    };
    let storage: MMKVLike | null = null;
    if (typeof mod.createMMKV === 'function') storage = mod.createMMKV({ id });
    else if (typeof mod.MMKV === 'function') storage = new mod.MMKV({ id });
    if (!storage) return null;
    if (typeof storage.getString !== 'function' || typeof storage.set !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
}

/**
 * MMKV-backed store. Returns null when the native module is unavailable (Node, web,
 * or a device without it), so callers can fall back to memory.
 */
export function createMmkvStore(id = 'bagyo-buddy'): Store | null {
  const storage = loadMmkv(id);
  if (!storage) return null;
  return makeStore(
    (key) => storage.getString(key),
    (key, value) => {
      storage.set(key, value);
    },
    (key) => {
      if (typeof storage.remove === 'function') storage.remove(key);
      else if (typeof storage.delete === 'function') storage.delete(key);
    },
  );
}

/** `auto` uses MMKV when available and memory otherwise (web/tests). */
export function createStore(opts: CreateStoreOptions = {}): Store {
  if (opts.backend === 'memory') return createMemoryStore();
  return createMmkvStore() ?? createMemoryStore();
}

/** Read a key, returning `fallback` when it was never stored. */
export function readOr<K extends StoreKey>(
  store: Store,
  key: K,
  fallback: StoreSchema[K],
): StoreSchema[K] {
  const value = store.get(key);
  return value === undefined ? fallback : value;
}
