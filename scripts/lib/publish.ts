/**
 * Shared publish helpers for the feed and pack build scripts.
 *
 * Blobs are content-addressed: the SHA-256 and size in a manifest are taken over
 * the gzip bytes (`/v1/blobs/{sha256}.json.gz`), which is exactly what the phone
 * checks (docs/api-layer.md section 10). Manifests are signed with Ed25519 over
 * the RFC 8785 canonical JSON without the top-level `signature` member.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync, zipSync } from 'fflate';
import type { BlobRef, Signature } from '../../app/types/index.ts';
import { sha256Hex, signEd25519, signedBytes, utf8 } from '../../app/core/signature.ts';

/** A gzipped blob and the manifest reference that describes it. */
export interface BlobArtifact {
  ref: BlobRef;
  gzip: Uint8Array;
}

export type KeyName = 'root' | 'pack' | 'feed';

/** On-disk shape of `keys/{name}.private.json`. */
export interface PrivateKeyFile {
  kid: string;
  alg: 'Ed25519';
  private_key: string;
  public_key: string;
}

/** Serializes a JSON value to UTF-8, gzips it, and hashes the gzip bytes. */
export function makeBlob(value: unknown): BlobArtifact {
  const gzip = gzipSync(utf8(JSON.stringify(value)));
  const sha256 = sha256Hex(gzip);
  return { ref: { sha256, size: gzip.byteLength, path: `/v1/blobs/${sha256}.json.gz` }, gzip };
}

/** Writes `out/v1/blobs/{sha256}.json.gz` and returns the manifest reference. */
export function writeBlob(outV1Dir: string, blob: BlobArtifact): BlobRef {
  const path = join(outV1Dir, 'blobs', `${blob.ref.sha256}.json.gz`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, blob.gzip);
  return blob.ref;
}

/** Signs a manifest, replacing any existing top-level `signature` member. */
export function signManifest<T extends object>(
  manifest: T,
  kid: string,
  privateKeyB64url: string,
): T & { signature: Signature } {
  const sig = signEd25519(privateKeyB64url, signedBytes(manifest));
  return { ...manifest, signature: { kid, alg: 'Ed25519', sig } };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readJson<T = unknown>(path: string): T {
  // Strip a UTF-8 BOM so files written by Windows editors still parse.
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text) as T;
}

export function keyPath(keysDir: string, name: KeyName): string {
  return join(keysDir, `${name}.private.json`);
}

/** Reads a private key file written by `scripts/keygen.ts`; throws when missing. */
export function readKey(keysDir: string, name: KeyName): PrivateKeyFile {
  const path = keyPath(keysDir, name);
  if (!existsSync(path)) throw new Error(`missing ${path}; run "npm run keygen" first`);
  return readJson<PrivateKeyFile>(path);
}

export interface BagyoPackManifestEntry {
  manifestId: string;
  manifest: object;
  signature: Signature;
}

export interface BagyoPackInput {
  entries: BagyoPackManifestEntry[];
  blobs: BlobArtifact[];
  keysJson?: unknown;
}

/**
 * Builds the `.bagyopack` zip layout: optional `keys.json`, then
 * `manifests/{id}.json` without the signature, `manifests/{id}.sig`, and
 * `blobs/{sha256}.json.gz` (docs/api-layer.md section 10).
 */
export function bagyoPackZip(input: BagyoPackInput): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  if (input.keysJson !== undefined) {
    files['keys.json'] = utf8(`${JSON.stringify(input.keysJson, null, 2)}\n`);
  }
  for (const entry of input.entries) {
    const unsigned: Record<string, unknown> = { ...(entry.manifest as Record<string, unknown>) };
    delete unsigned.signature;
    files[`manifests/${entry.manifestId}.json`] = utf8(`${JSON.stringify(unsigned, null, 2)}\n`);
    files[`manifests/${entry.manifestId}.sig`] = utf8(`${JSON.stringify(entry.signature, null, 2)}\n`);
  }
  for (const blob of input.blobs) {
    files[`blobs/${blob.ref.sha256}.json.gz`] = blob.gzip;
  }
  return zipSync(files);
}

export function writeBagyoPack(path: string, input: BagyoPackInput): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bagyoPackZip(input));
}

/** ISO 8601 with the +08:00 offset (Asia/Manila). */
export function manilaIso(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

/** The current year in Manila, used for default key IDs. */
export function manilaYear(at: Date = new Date()): number {
  return new Date(at.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear();
}

/** One calendar year later, preserving the +08:00 wall clock. */
export function oneYearAfter(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + 1);
  return new Date(shifted.getTime() - 8 * 60 * 60 * 1000);
}

export interface CliArgs {
  value(name: string): string | undefined;
  require(name: string): string;
  flag(name: string): boolean;
}

/** Minimal `--name value`, `--name=value` and boolean-flag parser. */
export function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined || !token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      values.set(token.slice(2, eq), token.slice(eq + 1));
      continue;
    }
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(name, next);
      i++;
    } else {
      flags.add(name);
    }
  }
  return {
    value: (name) => values.get(name),
    require: (name) => {
      const v = values.get(name);
      if (v === undefined || v.length === 0) throw new Error(`missing required --${name}`);
      return v;
    },
    flag: (name) => flags.has(name),
  };
}
