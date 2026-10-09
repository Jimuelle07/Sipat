import { describe, it, expect } from 'vitest';
import type { InstalledPack, Store, StoreKey, StoreSchema } from '../types/index.ts';
import { bundledContent } from '../content/index.ts';
import { createPackManager, loadBundledContent } from './packs.ts';

function makeStore(): Store {
  const map = new Map<string, unknown>();
  return {
    get: <K extends StoreKey>(key: K): StoreSchema[K] | undefined =>
      map.get(key) as StoreSchema[K] | undefined,
    set: <K extends StoreKey>(key: K, value: StoreSchema[K]): void => {
      map.set(key, value);
    },
    delete: (key: StoreKey): void => {
      map.delete(key);
    },
  };
}

const NOW = '2026-10-09T12:00:00+08:00';

function manifest(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    manifest_id: 'core',
    issued_at: '2026-10-09T00:00:00+08:00',
    min_app_version: '1.0.0',
    packs: [
      {
        pack_id: 'core-tl',
        kind: 'core',
        version: 2,
        guide_date: '2026-10-10',
        full: { sha256: 'a'.repeat(64), size: 1234, path: '/v1/blobs/aa.json.gz' },
      },
    ],
    signature: { kid: 'content-2026a', alg: 'Ed25519', sig: 'sig' },
    ...over,
  };
}

function reader(value: unknown): (uri: string) => Promise<string> {
  return async () => JSON.stringify(value);
}

function coreOf(store: Store): InstalledPack[] {
  return store.get('packs') ?? [];
}

describe('loadBundledContent', () => {
  it('loads every bundled passage', () => {
    const result = loadBundledContent();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passages.length).toBe(bundledContent.passages.length);
    expect(result.value.passages.length).toBeGreaterThan(0);
    expect(result.value.hotlines.length).toBe(bundledContent.hotlines.length);
  });
});

describe('createPackManager core pack', () => {
  it('registers the bundled core pack once, idempotently', () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW });
    const packs = coreOf(store);
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      packId: 'core-tl',
      kind: 'core',
      version: 1,
      guideDate: '2026-10-09',
      installedAt: NOW,
    });
    expect(manager.corePack().packId).toBe('core-tl');

    createPackManager({ store, now: () => NOW });
    expect(coreOf(store)).toHaveLength(1);
  });
});

describe('importFile', () => {
  it('rejects an unreadable file as bad_archive', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: async () => {
        throw new Error('boom');
      },
      publicKeys: { 'content-2026a': 'key' },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_archive');
  });

  it('rejects non-JSON bytes as bad_archive', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: async () => 'PK\u0003\u0004 not json',
      publicKeys: { 'content-2026a': 'key' },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_archive');
  });

  it('rejects an unsupported schema as schema', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: reader(manifest({ schema_version: 2 })),
      publicKeys: { 'content-2026a': 'key' },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('schema');
  });

  it('rejects an older or equal version as rollback', async () => {
    const store = makeStore();
    const older = manifest({ packs: [{ pack_id: 'core-tl', kind: 'core', version: 1 }] });
    const manager = createPackManager({ store, now: () => NOW, readFile: reader(older) });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('rollback');
  });

  it('returns unknown_key when no signing keys are shipped', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW, readFile: reader(manifest()) });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown_key');
  });

  it('returns unknown_key for an unrecognized signing key', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: reader(manifest()),
      publicKeys: { other: 'key' },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown_key');
  });

  it('returns bad_signature when a known key meets an unsigned manifest', async () => {
    const store = makeStore();
    const unsigned = manifest();
    delete unsigned.signature;
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: reader(unsigned),
      publicKeys: { 'content-2026a': 'key' },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_signature');
  });

  it('previews a newer, signed pack and applies then rolls it back', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: reader(manifest()),
      publicKeys: { 'content-2026a': 'key' },
    });

    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signedBy).toBe('content-2026a');
    expect(result.value.packs[0]).toMatchObject({
      packId: 'core-tl',
      kind: 'core',
      fromVersion: 1,
      toVersion: 2,
      sizeBytes: 1234,
      guideDate: '2026-10-10',
    });

    const applied = await manager.apply(result.value.previewId);
    expect(applied.ok).toBe(true);
    expect(coreOf(store)[0]).toMatchObject({ version: 2, previousVersion: 1 });

    const rolled = await manager.rollback('core-tl');
    expect(rolled.ok).toBe(true);
    expect(coreOf(store)[0]).toMatchObject({ version: 1 });
    expect(coreOf(store)[0]?.previousVersion).toBeUndefined();
  });
});

describe('apply and rollback', () => {
  it('returns io for an unknown preview', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW });
    const result = await manager.apply('missing');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('io');
  });

  it('returns nothing_to_roll_back with no previous version', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW });
    const result = await manager.rollback('core-tl');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('nothing_to_roll_back');
  });

  it('returns nothing_to_roll_back for an unknown pack', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW });
    const result = await manager.rollback('lgu-unknown');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('nothing_to_roll_back');
  });
});
