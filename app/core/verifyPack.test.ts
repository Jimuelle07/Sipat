import { describe, it, expect } from 'vitest';
import { zipSync, gzipSync, unzipSync } from 'fflate';
import type { KeySet, PackManifest, Signature, TrustStore } from '../types/index.ts';
import { generateKeyPair, sha256Hex, signEd25519, signedBytes } from './signature.ts';
import { verifyPack } from './verifyPack.ts';

const enc = (text: string): Uint8Array => new TextEncoder().encode(text);
const jsonBytes = (value: unknown): Uint8Array => enc(JSON.stringify(value));
const gzip = (bytes: Uint8Array): Uint8Array => gzipSync(bytes, { mtime: 0 });

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

type KeyPair = { privateKey: string; publicKey: string };

interface BuiltPack {
  entries: Map<string, Uint8Array>;
  manifest: PackManifest;
  sha: string;
  size: number;
  packKey: KeyPair;
}

function buildPack(over: {
  manifest?: Partial<PackManifest>;
  payload?: unknown;
  blob?: Uint8Array;
  signature?: Signature;
  extraEntries?: [string, Uint8Array][];
  packKey?: KeyPair;
} = {}): BuiltPack {
  const packKey = over.packKey ?? generateKeyPair();
  const payload = over.payload ?? VALID_PAYLOAD;
  const gz = gzip(jsonBytes(payload));
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
      full: { sha256: sha, size: gz.length, path: `/v1/blobs/${sha}.json.gz` },
    }],
    ...over.manifest,
  };
  const signature: Signature = over.signature ?? {
    kid: 'pack-1',
    alg: 'Ed25519',
    sig: signEd25519(packKey.privateKey, signedBytes(manifest)),
  };
  const entries = new Map<string, Uint8Array>();
  entries.set('manifests/core.json', jsonBytes(manifest));
  entries.set('manifests/core.sig', jsonBytes(signature));
  entries.set(`blobs/${sha}.json.gz`, over.blob ?? gz);
  for (const [path, bytes] of over.extraEntries ?? []) entries.set(path, bytes);
  return { entries, manifest, sha, size: gz.length, packKey };
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

function makeTrust(packKey: KeyPair, over: Partial<TrustStore> = {}, keyOver: Partial<KeySet['keys'][number]> = {}): TrustStore {
  return { rootKeys: [], keySet: makeKeySet(packKey, keyOver), installed: {}, ...over };
}

const codeOf = (result: { ok: boolean; error?: { code: string } }): string | undefined =>
  result.ok ? undefined : result.error?.code;

describe('verifyPack', () => {
  it('verifies a valid pack and returns its manifest and blobs', () => {
    const pack = buildPack();
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.manifest.packs?.[0]?.pack_id).toBe('core-tl');
    expect(result.value.manifest.signature?.kid).toBe('pack-1');
    expect(result.value.blobs.get(pack.sha)?.length).toBe(pack.size);
  });

  it('rejects an unknown kid with unknown_key', () => {
    const pack = buildPack({ signature: { kid: 'other', alg: 'Ed25519', sig: 'x' } });
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('unknown_key');
  });

  it('rejects a key outside its validity window with key_expired', () => {
    const pack = buildPack();
    const trust = makeTrust(pack.packKey, {}, { not_before: '2026-11-01T00:00:00+08:00', not_after: '2027-01-01T00:00:00+08:00' });
    const result = verifyPack(pack.entries, trust, '1.0.0');
    expect(codeOf(result)).toBe('key_expired');
  });

  it('rejects a feed-purpose key on a pack with key_expired', () => {
    const pack = buildPack();
    const trust = makeTrust(pack.packKey, {}, { purpose: 'feed' });
    const result = verifyPack(pack.entries, trust, '1.0.0');
    expect(codeOf(result)).toBe('key_expired');
  });

  it('rejects a manifest whose kind is not in the key scope with key_expired', () => {
    const pack = buildPack();
    const trust = makeTrust(pack.packKey, {}, { scope: ['area'] });
    const result = verifyPack(pack.entries, trust, '1.0.0');
    expect(codeOf(result)).toBe('key_expired');
  });

  it('rejects a tampered signature with bad_signature', () => {
    const pack = buildPack();
    const other = generateKeyPair();
    const signature: Signature = { kid: 'pack-1', alg: 'Ed25519', sig: signEd25519(other.privateKey, signedBytes(pack.manifest)) };
    const entries = new Map(pack.entries);
    entries.set('manifests/core.sig', jsonBytes(signature));
    const result = verifyPack(entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('bad_signature');
  });

  it('rejects a pack that needs a newer app with app_too_old', () => {
    const pack = buildPack({ manifest: { min_app_version: '2.0.0' } });
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('app_too_old');
  });

  it('rejects a version below the installed one with rollback', () => {
    const pack = buildPack();
    const trust = makeTrust(pack.packKey, { installed: { 'core-tl': 3 } });
    const result = verifyPack(pack.entries, trust, '1.0.0');
    expect(codeOf(result)).toBe('rollback');
  });

  it('skips an equal version without staging its blob', () => {
    const pack = buildPack();
    const trust = makeTrust(pack.packKey, { installed: { 'core-tl': 2 } });
    const result = verifyPack(pack.entries, trust, '1.0.0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blobs.size).toBe(0);
  });

  it('rejects a blob whose bytes do not match the manifest with hash_mismatch', () => {
    const pack = buildPack({ blob: gzip(enc('different bytes entirely')) });
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('hash_mismatch');
  });

  it('rejects a payload whose passage has no reviewer with schema', () => {
    const payload = {
      schema_version: 1,
      pack_id: 'core-tl',
      version: 2,
      files: {
        'guide.tl.json': {
          schema_version: 1,
          content_version: 2,
          generated_at: '2026-10-09T00:00:00+08:00',
          items: [{ id: 'p1', source_id: 's1' }],
        },
      },
    };
    const pack = buildPack({ payload });
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('schema');
  });

  it('rejects an unknown top-level entry with bad_archive', () => {
    const pack = buildPack({ extraEntries: [['readme.txt', enc('hello')]] });
    const result = verifyPack(pack.entries, makeTrust(pack.packKey), '1.0.0');
    expect(codeOf(result)).toBe('bad_archive');
  });

  it('learns a rotated pack key from a keys.json signed by a pinned root key', () => {
    const pack = buildPack();
    const root = generateKeyPair();
    const keySet = makeKeySet(pack.packKey);
    const keysJson: KeySet = {
      ...keySet,
      signature: { kid: 'root-1', alg: 'Ed25519', sig: signEd25519(root.privateKey, signedBytes(keySet)) },
    };
    const entries = new Map(pack.entries);
    entries.set('keys.json', jsonBytes(keysJson));
    const trust: TrustStore = { rootKeys: [{ kid: 'root-1', public_key: root.publicKey }], installed: {} };
    const result = verifyPack(entries, trust, '1.0.0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.keySet?.version).toBe(1);
  });

  it('ignores a keys.json whose root signature does not verify', () => {
    const pack = buildPack();
    const keysJson = makeKeySet(pack.packKey);
    const entries = new Map(pack.entries);
    entries.set('keys.json', jsonBytes(keysJson));
    const root = generateKeyPair();
    const trust: TrustStore = { rootKeys: [{ kid: 'root-1', public_key: root.publicKey }], installed: {} };
    const result = verifyPack(entries, trust, '1.0.0');
    expect(codeOf(result)).toBe('unknown_key');
  });

  it('round-trips through a real zip archive', () => {
    const pack = buildPack();
    const zipped = zipSync(Object.fromEntries(pack.entries));
    const result = verifyPack(new Map(Object.entries(unzipSync(zipped))), makeTrust(pack.packKey), '1.0.0');
    expect(result.ok).toBe(true);
  });
});
