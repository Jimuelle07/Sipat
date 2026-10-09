import { describe, it, expect } from 'vitest';
import { zipSync, gzipSync } from 'fflate';
import type { InstalledPack, KeySet, PackManifest, Signature, Store, StoreKey, StoreSchema } from '../types/index.ts';
import { bundledContent } from '../content/index.ts';
import { generateKeyPair, sha256Hex, signEd25519, signedBytes } from '../core/signature.ts';
import { createPackManager, loadBundledContent } from './packs.ts';

function makeStore(seed: InstalledPack[] = []): Store {
  const map = new Map<string, unknown>([['packs', seed]]);
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
const APP_VERSION = '1.0.0';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);
const jsonBytes = (value: unknown): Uint8Array => enc(JSON.stringify(value));
const gzip = (bytes: Uint8Array): Uint8Array => gzipSync(bytes, { mtime: 0 });

type KeyPair = { privateKey: string; publicKey: string };

const VALID_PAYLOAD = {
  schema_version: 1,
  pack_id: 'core-tl',
  version: 2,
  files: {
    'guide.tl.json': {
      schema_version: 1,
      content_version: 2,
      generated_at: '2026-10-09T00:00:00+08:00',
      items: [{ id: 'p1', source_id: 's1', reviewed_by: 'Reviewer', reviewed_at: '2026-09-01' }],
    },
  },
};

interface BuiltPack {
  zip: Uint8Array;
  manifest: PackManifest;
  packKey: KeyPair;
  files: Map<string, Uint8Array>;
}

function buildZip(over: {
  manifest?: Partial<PackManifest>;
  payload?: unknown;
  blob?: Uint8Array;
  signature?: Signature;
  packKey?: KeyPair;
} = {}): BuiltPack {
  const packKey = over.packKey ?? generateKeyPair();
  const gz = gzip(jsonBytes(over.payload ?? VALID_PAYLOAD));
  const sha = sha256Hex(gz);
  const manifest: PackManifest = {
    schema_version: 1,
    manifest_id: 'core',
    issued_at: '2026-10-09T00:00:00+08:00',
    min_app_version: '1.0.0',
    packs: [{
      pack_id: 'core-tl',
      kind: 'core',
      version: 2,
      guide_date: '2026-10-11',
      full: { sha256: sha, size: gz.length, path: `/v1/blobs/${sha}.json.gz` },
    }],
    ...over.manifest,
  };
  const signature: Signature = over.signature ?? {
    kid: 'pack-1',
    alg: 'Ed25519',
    sig: signEd25519(packKey.privateKey, signedBytes(manifest)),
  };
  const files = new Map<string, Uint8Array>([
    ['manifests/core.json', jsonBytes(manifest)],
    ['manifests/core.sig', jsonBytes(signature)],
    [`blobs/${sha}.json.gz`, over.blob ?? gz],
  ]);
  return { zip: zipSync(Object.fromEntries(files)), manifest, packKey, files };
}

function makeKeySet(packKey: KeyPair, over: Partial<KeySet['keys'][number]> = {}): KeySet {
  return {
    schema_version: 1,
    version: 1,
    keys: [{
      kid: 'pack-1',
      alg: 'Ed25519',
      public_key: packKey.publicKey,
      purpose: 'pack',
      scope: ['core', 'area', 'model'],
      not_before: '2026-01-01T00:00:00+08:00',
      not_after: '2027-01-01T00:00:00+08:00',
      ...over,
    }],
    signature: { kid: 'root-1', alg: 'Ed25519', sig: 'placeholder' },
  };
}

const bytesReader = (bytes: Uint8Array) => async (): Promise<Uint8Array> => bytes;

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

describe('importFile through verifyPack', () => {
  it('rejects an unreadable file as bad_archive', async () => {
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: async () => {
        throw new Error('boom');
      },
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_archive');
  });

  it('rejects non-archive bytes as bad_archive', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW, readFile: bytesReader(enc('PK not a zip')) });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_archive');
  });

  it('returns unknown_key when no trusted key covers the pack', async () => {
    const pack = buildZip();
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW, readFile: bytesReader(pack.zip), appVersion: APP_VERSION });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown_key');
  });

  it('returns bad_signature for a signature made by another key', async () => {
    const pack = buildZip();
    const other = generateKeyPair();
    const signature: Signature = { kid: 'pack-1', alg: 'Ed25519', sig: signEd25519(other.privateKey, signedBytes(pack.manifest)) };
    const bad = buildZip({ packKey: pack.packKey, signature });
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(bad.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_signature');
  });

  it('returns app_too_old for a pack needing a newer app', async () => {
    const pack = buildZip({ manifest: { min_app_version: '9.9.9' } });
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(pack.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('app_too_old');
  });

  it('returns rollback for a version below the installed one', async () => {
    const pack = buildZip();
    const seed: InstalledPack[] = [{ packId: 'core-tl', kind: 'core', version: 3, installedAt: NOW }];
    const store = makeStore(seed);
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(pack.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('rollback');
  });

  it('returns hash_mismatch for tampered blob bytes', async () => {
    const pack = buildZip();
    const tampered = buildZip({ packKey: pack.packKey, manifest: pack.manifest, blob: gzip(enc('tampered')) });
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(tampered.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('hash_mismatch');
  });

  it('returns schema when a passage has no reviewer', async () => {
    const payload = {
      schema_version: 1,
      pack_id: 'core-tl',
      version: 2,
      files: {
        'guide.tl.json': { schema_version: 1, content_version: 2, generated_at: '2026-10-09T00:00:00+08:00', items: [{ id: 'p1', source_id: 's1' }] },
      },
    };
    const pack = buildZip({ payload });
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(pack.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('schema');
  });

  it('previews a newer pack, applies then rolls it back', async () => {
    const pack = buildZip();
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(pack.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });

    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signedBy).toBe('pack-1');
    expect(result.value.packs[0]).toMatchObject({
      packId: 'core-tl',
      kind: 'core',
      fromVersion: 1,
      toVersion: 2,
      sizeBytes: pack.manifest.packs?.[0]?.full.size,
      guideDate: '2026-10-11',
      upserts: 1,
      deletes: 0,
    });

    const applied = await manager.apply(result.value.previewId);
    expect(applied.ok).toBe(true);
    expect(coreOf(store)[0]).toMatchObject({ version: 2, previousVersion: 1 });

    const rolled = await manager.rollback('core-tl');
    expect(rolled.ok).toBe(true);
    expect(coreOf(store)[0]).toMatchObject({ version: 1 });
    expect(coreOf(store)[0]?.previousVersion).toBeUndefined();
  });

  it('skips an equal version and previews nothing', async () => {
    const pack = buildZip();
    const seed: InstalledPack[] = [{ packId: 'core-tl', kind: 'core', version: 2, installedAt: NOW }];
    const store = makeStore(seed);
    const manager = createPackManager({
      store,
      now: () => NOW,
      readFile: bytesReader(pack.zip),
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });
    const result = await manager.importFile('x.bagyopack');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.packs).toHaveLength(0);
  });
});

describe('importArchive', () => {
  it('previews then applies an in-memory archive', async () => {
    const pack = buildZip();
    const store = makeStore();
    const manager = createPackManager({
      store,
      now: () => NOW,
      appVersion: APP_VERSION,
      keySet: makeKeySet(pack.packKey),
    });

    const result = await manager.importArchive(pack.files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signedBy).toBe('pack-1');
    expect(result.value.packs[0]).toMatchObject({ packId: 'core-tl', fromVersion: 1, toVersion: 2 });

    const applied = await manager.apply(result.value.previewId);
    expect(applied.ok).toBe(true);
    expect(coreOf(store)[0]).toMatchObject({ version: 2, previousVersion: 1 });
  });

  it('rejects a bad in-memory archive without staging a preview', async () => {
    const store = makeStore();
    const manager = createPackManager({ store, now: () => NOW, appVersion: APP_VERSION });
    const result = await manager.importArchive(new Map([['unknown.txt', enc('nope')]]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_archive');
    expect((await manager.apply('preview-1')).ok).toBe(false);
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
