import type {
  BlobRef,
  ContentFileName,
  KeySet,
  ModelEntry,
  PackEntry,
  PackError,
  PackKind,
  PackManifest,
  Result,
  Signature,
  TrustStore,
  VerifiedPack,
} from '../types/index.ts';
import { gunzipSync } from 'fflate';
import { sha256Hex, signedBytes, verifyEd25519 } from './signature.ts';
import { validateContent, REQUIRED_CONTENT_FILES } from './validateContent.ts';

/**
 * Product limit for a guide pack (docs/api-layer.md section 10, step 1).
 * Not an official figure: the guide is about 600 KB and province bundles are
 * tens of KB, so this is a generous ceiling to reject hostile archives.
 */
export const GUIDE_PACK_MAX_BYTES = 50 * 1024 * 1024;

const PACK_KINDS: readonly PackKind[] = ['core', 'area', 'model'];
const OPTIONAL_CONTENT_FILES = ['evacuation_centers.json', 'advisories.json', 'hazard_notes.json'] as const;

type Rec = Record<string, unknown>;
type ResolvedRef = BlobRef & { from_version?: number };
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const ok = <T>(value: T): Result<T, PackError> => ({ ok: true, value });
const fail = (code: PackError, message: string): Result<never, PackError> => ({
  ok: false,
  error: { code, message },
});

function parseJson<T>(bytes: Uint8Array): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

function parseGzipJson<T>(bytes: Uint8Array): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(gunzipSync(bytes))) as T;
  } catch {
    return null;
  }
}

/**
 * Step 1: read the archive entries and reject unknown top-level entries or a
 * total size above the guide-pack limit. Directory markers are ignored.
 */
function readArchive(files: Map<string, Uint8Array>): Result<Map<string, Uint8Array>, PackError> {
  const entries = new Map<string, Uint8Array>();
  let total = 0;
  for (const [rawPath, bytes] of files) {
    const path = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (path === '' || path.endsWith('/')) continue;
    const segments = path.split('/');
    if (segments.includes('..')) return fail('bad_archive', `Unsafe entry ${path}`);
    const top = segments[0];
    const known =
      path === 'keys.json' ||
      (top === 'manifests' && segments.length === 2 && (path.endsWith('.json') || path.endsWith('.sig'))) ||
      (top === 'blobs' && segments.length === 2 && path.endsWith('.json.gz'));
    if (!known) return fail('bad_archive', `Unknown top-level entry ${path}`);
    entries.set(path, bytes);
    total += bytes.length;
  }
  if (total > GUIDE_PACK_MAX_BYTES) return fail('bad_archive', 'Pack is larger than the guide-pack limit');
  return ok(entries);
}

/** Step 2 gate: a key set is accepted only when a pinned root key signed it and it is not older. */
function acceptKeySet(candidate: unknown, rootKeys: TrustStore['rootKeys'], stored: KeySet | undefined): candidate is KeySet {
  if (!isRec(candidate) || candidate.schema_version !== 1 || !isNumber(candidate.version)) return false;
  if (!isRec(candidate.signature)) return false;
  if (stored && !(candidate.version >= stored.version)) return false;
  if (!Array.isArray(candidate.keys)) return false;
  const sig = candidate.signature;
  if (sig.alg !== 'Ed25519' || !nonEmpty(sig.sig)) return false;
  const sigText = sig.sig as string;
  const message = signedBytes(candidate);
  return rootKeys.some((root) => verifyEd25519(root.public_key, message, sigText));
}

/** Reads a manifest's signature: embedded, or detached as `manifests/{id}.sig`. */
function resolveSignature(manifest: PackManifest, detached?: Uint8Array): Signature | null {
  const embedded = manifest.signature;
  if (isRec(embedded) && embedded.alg === 'Ed25519' && nonEmpty(embedded.kid) && nonEmpty(embedded.sig)) {
    return { kid: embedded.kid, alg: 'Ed25519', sig: embedded.sig };
  }
  if (detached) {
    const parsed = parseJson<unknown>(detached);
    if (isRec(parsed) && parsed.alg === 'Ed25519' && nonEmpty(parsed.kid) && nonEmpty(parsed.sig)) {
      return { kid: parsed.kid, alg: 'Ed25519', sig: parsed.sig };
    }
  }
  return null;
}

/** The kinds a manifest covers, derived from its packs and models. */
function manifestKinds(manifest: PackManifest): PackKind[] {
  const kinds = new Set<PackKind>();
  for (const pack of manifest.packs ?? []) {
    if (PACK_KINDS.includes(pack.kind)) kinds.add(pack.kind);
  }
  if ((manifest.models?.length ?? 0) > 0) kinds.add('model');
  return [...kinds];
}

/** Step 3 gate: the key must be a pack key, valid at `issued_at`, and cover every kind in the manifest. */
function keyCovers(key: KeySet['keys'][number], manifest: PackManifest): boolean {
  if (key.alg !== 'Ed25519' || key.purpose !== 'pack') return false;
  const at = Date.parse(manifest.issued_at);
  const notBefore = Date.parse(key.not_before);
  const notAfter = Date.parse(key.not_after);
  if (!Number.isFinite(at) || !Number.isFinite(notBefore) || !Number.isFinite(notAfter)) return false;
  if (at < notBefore || at > notAfter) return false;
  if (key.scope) {
    const kinds = manifestKinds(manifest);
    if (kinds.some((kind) => !key.scope!.includes(kind))) return false;
  }
  return true;
}

/** `a > b` is > 0. Missing or unparseable versions compare as 0.0.0. */
function compareSemver(a: string, b: string): number {
  const pa = (a ?? '').split('.').map((part) => Number.parseInt(part, 10));
  const pb = (b ?? '').split('.').map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i++) {
    const x = Number.isFinite(pa[i]) ? (pa[i] as number) : 0;
    const y = Number.isFinite(pb[i]) ? (pb[i] as number) : 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/** Step 6: the delta whose `from_version` equals the installed version, else the full blob. */
function chosenRef(pack: PackEntry, installed: number | undefined): ResolvedRef {
  if (installed !== undefined && pack.deltas) {
    const delta = pack.deltas.find((entry) => entry.from_version === installed);
    if (delta) return delta;
  }
  return pack.full;
}

const KNOWN_CONTENT_FILES = new Set<string>([...REQUIRED_CONTENT_FILES, ...OPTIONAL_CONTENT_FILES]);
const isContentFileName = (name: string): name is ContentFileName => KNOWN_CONTENT_FILES.has(name);

/** Step 8 for a partial payload: reuse `validateContent` when the full set is present, else targeted checks. */
function validateFiles(files: Rec, problems: string[]): void {
  for (const name of Object.keys(files)) {
    if (!isContentFileName(name)) problems.push(`files: unknown file ${name}`);
  }
  const hasAllRequired = REQUIRED_CONTENT_FILES.every((name) => name in files);
  if (hasAllRequired) {
    const result = validateContent(files as Partial<Record<ContentFileName, unknown>>);
    if (!result.ok) problems.push(result.error.message);
    return;
  }
  validatePresentFiles(files, problems);
}

/** Targeted validation for a pack that carries only some content files. */
function validatePresentFiles(files: Rec, problems: string[]): void {
  const items = (name: string): Rec[] | null => {
    const envelope = files[name];
    if (!isRec(envelope)) {
      problems.push(`${name}: not an object`);
      return null;
    }
    if (envelope.schema_version !== 1) problems.push(`${name}: schema_version must be 1`);
    if (!Array.isArray(envelope.items)) {
      problems.push(`${name}: items must be an array`);
      return null;
    }
    const list = envelope.items.filter(isRec);
    if (list.length !== envelope.items.length) problems.push(`${name}: every item must be an object`);
    return list;
  };

  if ('guide.tl.json' in files) {
    const list = items('guide.tl.json');
    list?.forEach((passage, i) => {
      if (!nonEmpty(passage.source_id)) problems.push(`guide.tl.json: item ${i} missing a source`);
      if (!nonEmpty(passage.reviewed_by)) problems.push(`guide.tl.json: item ${i} missing a reviewer`);
    });
  }
  if ('checklist.json' in files || 'warnings.json' in files || 'hotlines.json' in files) {
    for (const name of ['checklist.json', 'warnings.json', 'hotlines.json']) {
      if (!(name in files)) continue;
      const list = items(name);
      list?.forEach((item, i) => {
        if (!nonEmpty(item.source_id)) problems.push(`${name}: item ${i} missing a source`);
        if (name === 'hotlines.json' && !nonEmpty(item.verified_at)) {
          problems.push(`${name}: item ${i} missing verified_at`);
        }
      });
    }
  }
  if ('evacuation_centers.json' in files) {
    const list = items('evacuation_centers.json');
    list?.forEach((center, i) => {
      if (!nonEmpty(center.source_id)) problems.push(`evacuation_centers.json: item ${i} missing a source`);
      if (!nonEmpty(center.reviewed_by)) problems.push(`evacuation_centers.json: item ${i} missing a reviewer`);
      const coords = center.coords;
      if (!isRec(coords) || !isNumber(coords.lat) || !isNumber(coords.lon) || (coords.lat === 0 && coords.lon === 0)) {
        problems.push(`evacuation_centers.json: item ${i} needs real coordinates`);
      }
    });
  }
  for (const name of ['sources.json', 'synonyms.json', 'phase_rules.json', 'places.json', 'advisories.json', 'hazard_notes.json']) {
    if (!(name in files)) continue;
    const envelope = files[name];
    if (!isRec(envelope)) {
      problems.push(`${name}: not an object`);
      continue;
    }
    if (envelope.schema_version !== 1) problems.push(`${name}: schema_version must be 1`);
    if (!Array.isArray(envelope.items)) problems.push(`${name}: items must be an array`);
  }
}

/** Step 8: parse and validate one staged blob (a full payload or a delta). */
function verifyBlob(bytes: Uint8Array, pack: PackEntry, ref: ResolvedRef): string[] {
  const problems: string[] = [];
  const payload = parseGzipJson<Rec>(bytes);
  if (!isRec(payload)) return ['payload is not valid JSON'];
  if (payload.schema_version !== 1) problems.push('schema_version must be 1');
  if (payload.pack_id !== pack.pack_id) problems.push('pack_id does not match the manifest');
  if (ref.from_version !== undefined) {
    if (payload.base_version !== ref.from_version) problems.push('delta base_version does not match the manifest');
    if (payload.target_version !== pack.version) problems.push('delta target_version does not match the manifest');
    if (!isRec(payload.changes)) problems.push('changes must be an object');
    return problems;
  }
  if (payload.version !== pack.version) problems.push('version does not match the manifest');
  if (!isRec(payload.files)) {
    problems.push('files must be an object');
    return problems;
  }
  validateFiles(payload.files, problems);
  return problems;
}

/**
 * Steps 1 to 9 of docs/api-layer.md section 10 "Verification steps". Pure: no I/O
 * and no clock; `issued_at` drives key-validity checks. `files` are the entries of
 * a `.bagyopack` archive (or the same layout as a directory). Steps 3 to 8 run per
 * manifest; the returned manifest carries every verified pack.
 */
export function verifyPack(
  files: Map<string, Uint8Array>,
  trust: TrustStore,
  appVersion: string,
): Result<VerifiedPack, PackError> {
  const archiveResult = readArchive(files);
  if (!archiveResult.ok) return archiveResult;
  const archive = archiveResult.value;

  // Step 2: an embedded keys.json may rotate the pack key if a root key signed it.
  let keySet = trust.keySet;
  const keysBytes = archive.get('keys.json');
  if (keysBytes) {
    const candidate = parseJson<unknown>(keysBytes);
    if (acceptKeySet(candidate, trust.rootKeys, trust.keySet)) keySet = candidate;
  }
  const keysById = new Map((keySet?.keys ?? []).map((key) => [key.kid, key]));

  const manifestIds: string[] = [];
  for (const path of archive.keys()) {
    if (path.startsWith('manifests/') && path.endsWith('.json')) {
      manifestIds.push(path.slice('manifests/'.length, -'.json'.length));
    }
  }
  if (manifestIds.length === 0) return fail('bad_archive', 'The archive carries no manifest');

  const blobs = new Map<string, Uint8Array>();
  let primary: PackManifest | null = null;
  let primarySignature: Signature | null = null;
  const allPacks: PackEntry[] = [];
  const allModels: ModelEntry[] = [];

  for (const manifestId of manifestIds) {
    const manifest = parseJson<PackManifest>(archive.get(`manifests/${manifestId}.json`)!);
    if (!isRec(manifest)) return fail('schema', `Manifest ${manifestId} is not valid JSON`);

    const signature = resolveSignature(manifest, archive.get(`manifests/${manifestId}.sig`));
    if (!signature) return fail('bad_signature', `Manifest ${manifestId} has no signature`);

    // Step 3.
    const key = keysById.get(signature.kid);
    if (!key) return fail('unknown_key', `Unknown signing key ${signature.kid}`);
    if (!keyCovers(key, manifest)) return fail('key_expired', `Key ${signature.kid} does not cover this manifest`);

    // Step 4.
    if (!verifyEd25519(key.public_key, signedBytes(manifest), signature.sig)) {
      return fail('bad_signature', `Manifest ${manifestId} failed signature verification`);
    }

    // Step 5.
    if (compareSemver(manifest.min_app_version, appVersion) > 0) {
      return fail('app_too_old', `Pack needs app ${manifest.min_app_version}`);
    }

    // Steps 6 to 8, once per listed pack whose blob is present.
    for (const pack of manifest.packs ?? []) {
      const installed = trust.installed[pack.pack_id];
      const ref = chosenRef(pack, installed);
      const bytes = archive.get(`blobs/${ref.sha256}.json.gz`);
      if (!bytes) continue; // a listed blob the archive does not carry is skipped, not an error
      if (installed !== undefined && pack.version < installed) {
        return fail('rollback', `Pack ${pack.pack_id} is older than the installed version`);
      }
      if (installed !== undefined && pack.version === installed) continue; // equal version is a no-op
      if (bytes.length !== ref.size || sha256Hex(bytes) !== ref.sha256) {
        return fail('hash_mismatch', `Blob ${ref.sha256} does not match the manifest`);
      }
      const problems = verifyBlob(bytes, pack, ref);
      if (problems.length > 0) return fail('schema', problems.join('; '));
      blobs.set(ref.sha256, bytes);
    }

    allPacks.push(...(manifest.packs ?? []));
    allModels.push(...(manifest.models ?? []));
    if (!primary) {
      primary = manifest;
      primarySignature = signature;
    }
  }

  // Step 9.
  const manifest: PackManifest = {
    ...(primary as PackManifest),
    ...(primarySignature ? { signature: primarySignature } : {}),
    ...(allPacks.length > 0 ? { packs: allPacks } : {}),
    ...(allModels.length > 0 ? { models: allModels } : {}),
  };
  return ok({
    manifest,
    blobs,
    ...(keySet && keySet !== trust.keySet ? { keySet } : {}),
  });
}
