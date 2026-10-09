import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { BulletinRecord } from '../app/types/index.ts';
import { generateKeyPair, sha256Hex, signedBytes, verifyEd25519 } from '../app/core/signature.ts';
import { bagyoPackZip, makeBlob, signManifest } from './lib/publish.ts';
import { buildFeed } from './build-feed.ts';

/** All fixtures are clearly marked samples; never real bulletin data. */
const SAMPLE = 'SAMPLE – hindi totoong bulletin';

function sampleBulletin(): BulletinRecord {
  return {
    id: 'sample-bulletin-1',
    storm_id: 'sample-storm-1',
    source: { agency: 'PAGASA', title: SAMPLE, url: 'https://example.invalid/sample-bulletin' },
    issued_at: '2026-10-09T09:00:00+08:00',
    scraped_at: '2026-10-09T09:05:00+08:00',
    storm: { name: 'SAMPLE', category: 'TD' },
    position: { lat: 14.6, lon: 121.0, at: '2026-10-09T09:00:00+08:00', text: SAMPLE },
    forecast: [],
    signal_areas: [],
    final: false,
    text: SAMPLE,
  };
}

describe('publish helpers', () => {
  it('signs a manifest so verifyEd25519 passes over its canonical bytes', () => {
    const keys = generateKeyPair();
    const signed = signManifest(
      { schema_version: 1, manifest_id: 'feed', sequence: 7 },
      'feed-test',
      keys.privateKey,
    );

    expect(signed.signature.alg).toBe('Ed25519');
    expect(verifyEd25519(keys.publicKey, signedBytes(signed), signed.signature.sig)).toBe(true);

    const tampered = { ...signed, sequence: 8 };
    expect(verifyEd25519(keys.publicKey, signedBytes(tampered), tampered.signature.sig)).toBe(false);
  });

  it('hashes and sizes the gzip bytes and round-trips the JSON', () => {
    const value = { text: SAMPLE };
    const blob = makeBlob(value);

    expect(blob.ref.sha256).toBe(sha256Hex(blob.gzip));
    expect(blob.ref.size).toBe(blob.gzip.byteLength);
    expect(blob.ref.path).toBe(`/v1/blobs/${blob.ref.sha256}.json.gz`);
    expect(JSON.parse(strFromU8(gunzipSync(blob.gzip)))).toEqual(value);
  });
});

describe('buildFeed', () => {
  it('refuses a bulletin without a source URL', () => {
    const bad = sampleBulletin();
    bad.source.url = '';
    const dir = mkdtempSync(join(tmpdir(), 'bagyo-feed-'));
    try {
      expect(() =>
        buildFeed({
          bulletins: [bad],
          sequence: 1,
          minAppVersion: '1.1.0',
          kid: 'feed-test',
          privateKey: 'not-used',
          outDir: dir,
        }),
      ).toThrow(/source\.url/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a feed manifest that verifies with the feed public key', () => {
    const keys = generateKeyPair();
    const dir = mkdtempSync(join(tmpdir(), 'bagyo-feed-'));
    try {
      const result = buildFeed({
        bulletins: [sampleBulletin()],
        sequence: 3,
        minAppVersion: '1.1.0',
        kid: 'feed-test',
        privateKey: keys.privateKey,
        outDir: dir,
        issuedAt: '2026-10-09T11:05:00+08:00',
      });

      expect(result.manifest.sequence).toBe(3);
      expect(result.manifest.files['bulletins.json'].sha256).toBe(result.blobs[0]!.ref.sha256);

      const onDisk = JSON.parse(readFileSync(join(dir, 'feed', 'manifest.json'), 'utf8')) as {
        signature: { sig: string };
      };
      expect(verifyEd25519(keys.publicKey, signedBytes(onDisk), onDisk.signature.sig)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('bagyoPackZip', () => {
  it('writes the import layout with an unsigned manifest and a detached signature', () => {
    const keys = generateKeyPair();
    const signed = signManifest(
      {
        schema_version: 1,
        manifest_id: 'core',
        issued_at: '2026-10-09T00:00:00+08:00',
        min_app_version: '1.1.0',
        packs: [],
      },
      'pack-test',
      keys.privateKey,
    );
    const blob = makeBlob({ schema_version: 1, pack_id: 'core-tl', version: 1, files: {} });

    const zip = bagyoPackZip({
      entries: [{ manifestId: 'core', manifest: signed, signature: signed.signature }],
      blobs: [blob],
    });
    const files = unzipSync(zip);

    expect(Object.keys(files).sort()).toEqual([
      `blobs/${blob.ref.sha256}.json.gz`,
      'manifests/core.json',
      'manifests/core.sig',
    ]);

    const unsigned = JSON.parse(strFromU8(files['manifests/core.json']!)) as Record<string, unknown>;
    expect(unsigned.signature).toBeUndefined();
    expect(verifyEd25519(keys.publicKey, signedBytes(unsigned), signed.signature.sig)).toBe(true);
  });
});
