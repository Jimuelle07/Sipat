import { describe, expect, it } from 'vitest';
import { gzipSync } from 'fflate';
import type { FeedCache, KeySet, PinnedKey, Store, UpdatePlan } from '../types/index.ts';
import {
  generateKeyPair,
  sha256Hex,
  signEd25519,
  signedBytes,
  utf8,
} from '../core/signature.ts';
import { createMemoryStore } from './store.ts';
import { createPackManager } from './packs.ts';
import { updateHost } from './updateConfig.ts';
import {
  MAX_NETWORK_LOG,
  createUpdateClient,
  type FetchLike,
  type FetchResponseLike,
  type UpdateClientDeps,
} from './updates.ts';

const HOST = 'https://cdn.test';
const NOW = new Date('2026-10-09T12:00:00+08:00');
const APP_VERSION = '1.1.0';

const root = generateKeyPair();
const feedKey = generateKeyPair();
const otherKey = generateKeyPair();

const ROOT_KEYS: PinnedKey[] = [{ kid: 'root-1', public_key: root.publicKey }];

function response(body: Uint8Array, status = 200): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    async arrayBuffer() {
      return body.slice().buffer;
    },
    async text() {
      return new TextDecoder().decode(body);
    },
  };
}

interface FakeFetch {
  fetch: FetchLike;
  calls: string[];
}

type Routes = Map<string, { status?: number; body: Uint8Array }>;

function makeFetch(routes: Routes): FakeFetch {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const route = routes.get(url);
    if (!route) return response(utf8('not found'), 404);
    return response(route.body, route.status ?? 200);
  };
  return { fetch, calls };
}

function json(value: unknown): Uint8Array {
  return utf8(JSON.stringify(value));
}

function makeKeySet(keys: KeySet['keys']): KeySet {
  const unsigned = { schema_version: 1 as const, version: 1, keys };
  const sig = signEd25519(root.privateKey, signedBytes(unsigned));
  return { ...unsigned, signature: { kid: 'root-1', alg: 'Ed25519', sig } };
}

function feedKeySet(purpose: 'feed' | 'pack' = 'feed'): KeySet {
  return makeKeySet([
    {
      kid: 'feed-1',
      alg: 'Ed25519',
      public_key: feedKey.publicKey,
      purpose,
      not_before: '2026-01-01T00:00:00+08:00',
      not_after: '2027-01-01T00:00:00+08:00',
    },
  ]);
}

interface BlobFixture {
  body: Uint8Array;
  sha256: string;
  size: number;
  path: string;
}

function bulletinsBlob(): BlobFixture {
  const file = {
    schema_version: 1,
    content_version: 1,
    generated_at: '2026-10-09T11:00:00+08:00',
    items: [
      {
        id: 'b1',
        storm_id: 'storm-1',
        source: { agency: 'PAGASA', title: 'SAMPLE - hindi totoong bulletin', url: 'https://example.test/b' },
        issued_at: '2026-10-09T08:00:00+08:00',
        scraped_at: '2026-10-09T11:00:00+08:00',
        storm: { name: 'SAMPLE', category: 'TS' },
        position: { lat: 14.5, lon: 121.0, at: '2026-10-09T11:00:00+08:00', text: 'SAMPLE' },
        forecast: [],
        signal_areas: [{ level: 2, psgc: ['012801000'] }],
        final: false,
        text: 'SAMPLE - hindi totoong bulletin',
      },
    ],
  };
  const body = gzipSync(utf8(JSON.stringify(file)), { mtime: 0 });
  const sha256 = sha256Hex(body);
  return { body, sha256, size: body.length, path: `/v1/blobs/${sha256}.json.gz` };
}

function feedManifest(over: Record<string, unknown> = {}, signingKey = feedKey): Record<string, unknown> {
  const blob = bulletinsBlob();
  const unsigned = {
    schema_version: 1,
    manifest_id: 'feed',
    sequence: 5,
    issued_at: '2026-10-09T11:05:00+08:00',
    min_app_version: '1.0.0',
    stale: false,
    last_attempt_at: '2026-10-09T11:04:40+08:00',
    last_success_at: '2026-10-09T11:04:40+08:00',
    files: {
      'bulletins.json': { sha256: blob.sha256, size: blob.size, path: blob.path },
    },
    ...over,
  };
  const sig = signEd25519(signingKey.privateKey, signedBytes(unsigned));
  return { ...unsigned, signature: { kid: 'feed-1', alg: 'Ed25519', sig } };
}

interface Fixture {
  fetch: FakeFetch;
  routes: Routes;
  blob: BlobFixture;
}

function makeFixture(opts: { keySet?: KeySet; manifest?: Record<string, unknown> } = {}): Fixture {
  const blob = bulletinsBlob();
  const routes: Routes = new Map();
  routes.set(`${HOST}/v1/keys.json`, { body: json(opts.keySet ?? feedKeySet()) });
  routes.set(`${HOST}/v1/feed/manifest.json`, { body: json(opts.manifest ?? feedManifest()) });
  routes.set(`${HOST}${blob.path}`, { body: blob.body });
  return { fetch: makeFetch(routes), routes, blob };
}

interface CoreBlob {
  body: Uint8Array;
  sha256: string;
  size: number;
  path: string;
}

const CORE_PAYLOAD = {
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

interface CoreFixture {
  fetch: FakeFetch;
  routes: Routes;
  blob: CoreBlob;
  manifest: Record<string, unknown>;
}

function makeCoreFixture(): CoreFixture {
  const body = gzipSync(utf8(JSON.stringify(CORE_PAYLOAD)), { mtime: 0 });
  const sha256 = sha256Hex(body);
  const blob: CoreBlob = { body, sha256, size: body.length, path: `/v1/blobs/${sha256}.json.gz` };
  const unsigned = {
    schema_version: 1,
    manifest_id: 'core',
    issued_at: '2026-10-09T11:05:00+08:00',
    min_app_version: '1.0.0',
    packs: [
      {
        pack_id: 'core-tl',
        kind: 'core',
        version: 2,
        guide_date: '2026-10-11',
        full: { sha256, size: blob.size, path: blob.path },
      },
    ],
  };
  const sig = signEd25519(feedKey.privateKey, signedBytes(unsigned));
  const manifest = { ...unsigned, signature: { kid: 'feed-1', alg: 'Ed25519', sig } };
  const routes: Routes = new Map();
  routes.set(`${HOST}/v1/keys.json`, { body: json(feedKeySet('pack')) });
  routes.set(`${HOST}/v1/core/manifest.json`, { body: json(manifest) });
  routes.set(`${HOST}${blob.path}`, { body: blob.body });
  return { fetch: makeFetch(routes), routes, blob, manifest };
}

function corePlan(fixture: CoreFixture): UpdatePlan {
  return {
    planId: 'plan-core-tl@2',
    items: [
      {
        packId: 'core-tl',
        kind: 'core',
        fromVersion: 1,
        toVersion: 2,
        blob: { sha256: fixture.blob.sha256, size: fixture.blob.size, path: fixture.blob.path },
        delta: false,
      },
    ],
    totalBytes: fixture.blob.size,
  };
}

function client(
  fixture: Fixture,
  store: Store,
  over: Partial<Omit<UpdateClientDeps, 'fetch' | 'store'>> = {},
): ReturnType<typeof createUpdateClient> {
  return createUpdateClient({
    host: HOST,
    fetch: fixture.fetch.fetch,
    store,
    now: () => NOW,
    trustedKeys: ROOT_KEYS,
    appVersion: APP_VERSION,
    ...over,
  });
}

function oldCache(sequence = 3): FeedCache {
  return {
    sequence,
    issuedAt: '2026-10-09T06:00:00+08:00',
    serverStale: false,
    bulletins: [],
    fetchedAt: '2026-10-09T06:05:00+08:00',
    checkedAt: '2026-10-09T06:05:00+08:00',
  };
}

describe('updateHost', () => {
  it('returns null in Node without expo-constants', () => {
    expect(updateHost()).toBeNull();
  });
});

describe('createUpdateClient feed', () => {
  it('caches a signed feed and logs every request', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore();
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe('unchanged');
    const cache = result.value as FeedCache;
    expect(cache.sequence).toBe(5);
    expect(cache.issuedAt).toBe('2026-10-09T11:05:00+08:00');
    expect(cache.bulletins).toHaveLength(1);
    expect(cache.bulletins[0]?.id).toBe('b1');
    expect(cache.bulletins[0]?.fetchedAt).toBe('2026-10-09T12:00:00+08:00');

    expect(store.get('feed')?.sequence).toBe(5);
    expect(store.get('networkLog')).toHaveLength(3);
    for (const entry of store.get('networkLog') ?? []) {
      expect(entry.method).toBe('GET');
      expect(entry.host).toBe('cdn.test');
      expect(entry.status).toBe(200);
    }
  });

  it('returns unchanged and only moves checkedAt on an equal sequence', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore({ feed: oldCache(5) });
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'pull' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('unchanged');
    expect(store.get('feed')?.checkedAt).toBe('2026-10-09T12:00:00+08:00');
    expect(store.get('feed')?.fetchedAt).toBe('2026-10-09T06:05:00+08:00');
  });

  it('keeps the old cache and returns bad_signature on a bad signature', async () => {
    const fixture = makeFixture({ manifest: feedManifest({}, otherKey) });
    const store = createMemoryStore({ feed: oldCache(3) });
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('bad_signature');
    expect(store.get('feed')).toEqual(oldCache(3));
  });

  it('rejects a key with the wrong purpose', async () => {
    const fixture = makeFixture({ keySet: feedKeySet('pack') });
    const store = createMemoryStore();
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('key_expired');
    expect(store.get('feed')).toBeUndefined();
  });

  it('returns hash_mismatch and keeps the old cache when a blob is wrong', async () => {
    const fixture = makeFixture();
    const manifest = feedManifest({
      files: { 'bulletins.json': { sha256: 'f'.repeat(64), size: fixture.blob.size, path: fixture.blob.path } },
    });
    fixture.routes.set(`${HOST}/v1/feed/manifest.json`, { body: json(manifest) });
    const store = createMemoryStore({ feed: oldCache(3) });
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('hash_mismatch');
    expect(store.get('feed')).toEqual(oldCache(3));
  });

  it('refuses a blob URL outside the pinned host and never calls it', async () => {
    const fixture = makeFixture();
    const manifest = feedManifest({
      files: {
        'bulletins.json': { sha256: fixture.blob.sha256, size: fixture.blob.size, path: 'https://evil.test/v1/blobs/x.json.gz' },
      },
    });
    fixture.routes.set(`${HOST}/v1/feed/manifest.json`, { body: json(manifest) });
    const store = createMemoryStore();
    const updates = client(fixture, store);

    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('http');
    expect(fixture.fetch.calls.some((url) => url.includes('evil.test'))).toBe(false);
  });

  it('returns rollback and keeps the cache on a lower sequence', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore({ feed: oldCache(9) });
    const updates = client(fixture, store);
    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('rollback');
    expect(store.get('feed')?.sequence).toBe(9);
  });

  it('caps the network log at MAX_NETWORK_LOG entries', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore({ feed: oldCache(5) });
    const updates = client(fixture, store);

    for (let i = 0; i < 210; i += 1) {
      await updates.fetchFeed({ trigger: 'pull' });
    }
    const log = store.get('networkLog') ?? [];
    expect(log).toHaveLength(MAX_NETWORK_LOG);
    expect(log.every((entry) => entry.bytes > 0)).toBe(true);
  });

  it('logs only request metadata, never household data', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore();
    const updates = client(fixture, store, { province: () => '012801000' });
    await updates.fetchFeed({ trigger: 'open' });
    const keys = Object.keys((store.get('networkLog') ?? [])[0] ?? {});
    expect(keys.sort()).toEqual(['at', 'bytes', 'host', 'method', 'path', 'status']);
  });
});

describe('createUpdateClient download', () => {
  it('downloads a signed core pack and applies it through the PackManager', async () => {
    const fixture = makeCoreFixture();
    const store = createMemoryStore();
    const packStore = createMemoryStore();
    const manager = createPackManager({
      store: packStore,
      now: () => NOW.toISOString(),
      appVersion: APP_VERSION,
      rootKeys: ROOT_KEYS,
      keySet: feedKeySet('pack'),
    });
    const updates = createUpdateClient({
      host: HOST,
      fetch: fixture.fetch.fetch,
      store,
      now: () => NOW,
      trustedKeys: ROOT_KEYS,
      appVersion: APP_VERSION,
      importArchive: (files) => manager.importArchive(files),
    });

    let progressBytes = 0;
    const result = await updates.download(corePlan(fixture), (bytes, total) => {
      progressBytes = bytes;
      expect(total).toBe(fixture.blob.size);
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.packs[0]).toMatchObject({ packId: 'core-tl', toVersion: 2 });
    expect(progressBytes).toBe(fixture.blob.size);

    const applied = await manager.apply(result.value.previewId);
    expect(applied.ok).toBe(true);
    expect(packStore.get('packs')?.find((pack) => pack.packId === 'core-tl')?.version).toBe(2);
  });

  it('returns cancelled when the signal is aborted', async () => {
    const fixture = makeCoreFixture();
    const store = createMemoryStore();
    const manager = createPackManager({
      store: createMemoryStore(),
      now: () => NOW.toISOString(),
      appVersion: APP_VERSION,
      rootKeys: ROOT_KEYS,
      keySet: feedKeySet('pack'),
    });
    const updates = createUpdateClient({
      host: HOST,
      fetch: fixture.fetch.fetch,
      store,
      now: () => NOW,
      trustedKeys: ROOT_KEYS,
      appVersion: APP_VERSION,
      importArchive: (files) => manager.importArchive(files),
    });

    const controller = new AbortController();
    controller.abort();
    const result = await updates.download(corePlan(fixture), () => {}, controller.signal);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('cancelled');
  });
});

describe('createUpdateClient disabled and host guard', () => {
  it('is disabled with no host and makes no request', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore();
    const updates = createUpdateClient({
      host: null,
      fetch: fixture.fetch.fetch,
      store,
      now: () => NOW,
      appVersion: APP_VERSION,
    });

    expect((await updates.fetchFeed({ trigger: 'open' })).ok).toBe(false);
    expect((await updates.check({ trigger: 'user' })).ok).toBe(false);
    expect((await updates.fetchCenters('012801000')).ok).toBe(false);
    expect(fixture.fetch.calls).toHaveLength(0);
    expect(store.get('networkLog')).toBeUndefined();
  });

  it('treats a non-https host as disabled', async () => {
    const fixture = makeFixture();
    const store = createMemoryStore();
    const updates = createUpdateClient({
      host: 'http://cdn.test',
      fetch: fixture.fetch.fetch,
      store,
      now: () => NOW,
      appVersion: APP_VERSION,
    });
    const result = await updates.fetchFeed({ trigger: 'open' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('disabled');
  });
});
