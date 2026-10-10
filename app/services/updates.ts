import { gunzipSync } from 'fflate';
import type {
  BlobRef,
  Bulletin,
  FeedCache,
  FeedError,
  FeedManifest,
  Hotline,
  ImportPreview,
  InstalledPack,
  KeySet,
  NetworkLogEntry,
  PackEntry,
  PackError,
  PackManifest,
  PinnedKey,
  Result,
  Settings,
  Store,
  TcwsLevel,
  TrustStore,
  UpdateClient,
  UpdateError,
  UpdatePlan,
} from '../types/index.ts';
import { PINNED_ROOT_KEYS } from '../core/pinnedKeys.ts';
import { sha256Hex, signedBytes, utf8, verifyEd25519 } from '../core/signature.ts';
import { canonicalize } from '../core/canonicalJson.ts';
import { verifyPack } from '../core/verifyPack.ts';
import { toManilaIso } from '../core/time.ts';

/** Network log cap (Store doc proposal: 200). */
export const MAX_NETWORK_LOG = 200;

/** Adds one GET to the on-screen network log (AGENTS rule 1: every request appears there). */
export function appendNetworkLog(store: Store, url: string, status: number | 'error', bytes: number, at: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  const entry: NetworkLogEntry = {
    at,
    method: 'GET',
    host: parsed.host,
    path: `${parsed.pathname}${parsed.search}`,
    bytes,
    status: typeof status === 'number' && status > 0 ? status : 'error',
  };
  let current: NetworkLogEntry[] = [];
  try {
    current = store.get('networkLog') ?? [];
  } catch {
    current = [];
  }
  store.set('networkLog', [...current, entry].slice(-MAX_NETWORK_LOG));
}

/** The key set is re-fetched at most once a day (Feed doc step 1, proposal). */
export const KEY_SET_TTL_MS = 24 * 60 * 60 * 1000;
/** Tolerated clock skew when checking that an `issued_at` is not in the future. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

const FEED_MANIFEST_PATH = '/v1/feed/manifest.json';
const KEY_SET_PATH = '/v1/keys.json';
const CORE_MANIFEST_PATH = '/v1/core/manifest.json';
const MODEL_MANIFEST_PATH = '/v1/model/manifest.json';

const STORM_CATEGORIES: readonly string[] = ['TD', 'TS', 'STS', 'TY', 'STY'];

/** The subset of the WHATWG `Response` the client needs; a fake can serve this. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

/** The subset of `fetch` the client uses. Only GET is ever issued, to the one pinned host. */
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

export interface UpdateClientDeps {
  /** The one pinned host (origin, `https://...`) or null when online features are off. */
  host: string | null;
  fetch: FetchLike;
  store: Store;
  /** Clock; defaults to the system clock. */
  now?: () => Date;
  /** Pinned root keys used to verify `/v1/keys.json`; defaults to `PINNED_ROOT_KEYS`. */
  trustedKeys?: PinnedKey[];
  /** The app's semver, checked against each manifest's `min_app_version`. */
  appVersion?: string;
  /** Optional: the household's province PSGC, for the Smart Update area manifest. */
  province?: () => string | null;
  /**
   * Optional: the PackManager's `importArchive`. When present, `download` hands the
   * fetched `.bagyopack`-layout entries to it so `packs.apply(previewId)` installs them.
   */
  importArchive?: (files: Map<string, Uint8Array>) => Promise<Result<ImportPreview, PackError>>;
}

type NetError = 'offline' | 'http' | 'not_allowed' | 'cancelled';
type BlobError = NetError | 'hash_mismatch' | 'schema';
type KeyLookup =
  | { ok: true; publicKey: string }
  | { ok: false; code: 'unknown_key' | 'key_expired' };

const succeed = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** `Result<never, E>` keeps every `Result<T, E>` context happy without repeating the value type. */
function fail<E extends string>(code: E, message?: string): Result<never, E> {
  return { ok: false, error: { code, message: message ?? code } };
}

const decoder = new TextDecoder();

function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** Numeric semver compare; missing or malformed parts count as 0. Returns -1 | 0 | 1. */
export function compareVersions(a: string | undefined, b: string | undefined): number {
  const parts = (value: string | undefined): number[] =>
    (value ?? '0')
      .split('-')[0]!
      .split('.')
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function isEd25519(value: unknown): value is 'Ed25519' {
  return value === 'Ed25519';
}

function isSignature(value: unknown): value is { kid: string; alg: 'Ed25519'; sig: string } {
  return isRecord(value) && nonEmpty(value.kid) && isEd25519(value.alg) && nonEmpty(value.sig);
}

function isBlobRef(value: unknown): value is BlobRef {
  return (
    isRecord(value) &&
    typeof value.sha256 === 'string' &&
    value.sha256.length === 64 &&
    isFiniteNumber(value.size) &&
    value.size >= 0 &&
    nonEmpty(value.path)
  );
}

export function createUpdateClient(deps: UpdateClientDeps): UpdateClient {
  const { store } = deps;
  const fetchImpl = deps.fetch;
  const clock = deps.now ?? ((): Date => new Date());
  const appVersion = deps.appVersion ?? '0.0.0';

  let baseOrigin: string | null = null;
  if (typeof deps.host === 'string' && deps.host.startsWith('https://')) {
    try {
      baseOrigin = new URL(deps.host).origin;
    } catch {
      baseOrigin = null;
    }
  }
  const enabled = baseOrigin !== null;

  const nowIso = (): string => toManilaIso(clock());
  const nowMs = (): number => clock().getTime();

  let keySet: KeySet | null = null;
  let keySetAt = 0;
  let baseUrl = baseOrigin ?? '';
  if (baseUrl !== '') baseUrl = `${baseUrl}/`;

  function safeSettings(): Settings | undefined {
    try {
      return store.get('settings');
    } catch {
      return undefined;
    }
  }

  function safeFeed(): FeedCache | undefined {
    try {
      return store.get('feed');
    } catch {
      return undefined;
    }
  }

  function installedVersion(packId: string): number | undefined {
    try {
      const packs: InstalledPack[] = store.get('packs') ?? [];
      return packs.find((pack) => pack.packId === packId)?.version;
    } catch {
      return undefined;
    }
  }

  function installedMap(): Record<string, number> {
    const out: Record<string, number> = {};
    try {
      for (const pack of store.get('packs') ?? []) out[pack.packId] = pack.version;
    } catch {
      /* no installed packs */
    }
    return out;
  }

  function appendLog(url: string, status: number | 'error', bytes: number): void {
    appendNetworkLog(store, url, status, bytes, nowIso());
  }

  /** Resolves a host-relative path or a same-origin absolute URL; anything else is refused. */
  function absoluteUrl(path: string): string | null {
    if (baseOrigin === null) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
      try {
        const url = new URL(path);
        return url.protocol === 'https:' && url.origin === baseOrigin ? url.toString() : null;
      } catch {
        return null;
      }
    }
    try {
      const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
      return url.origin === baseOrigin ? url.toString() : null;
    } catch {
      return null;
    }
  }

  async function request(path: string, signal?: AbortSignal): Promise<Result<{ status: number; bytes: Uint8Array }, NetError>> {
    const url = absoluteUrl(path);
    if (url === null) return fail('not_allowed', 'Refused a URL outside the pinned host');

    let response: FetchResponseLike;
    try {
      response = await fetchImpl(url, signal ? { signal } : undefined);
    } catch {
      appendLog(url, 'error', 0);
      return fail(signal?.aborted ? 'cancelled' : 'offline');
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      appendLog(url, 'error', 0);
      return fail('http');
    }

    appendLog(url, response.status, bytes.length);
    if (!response.ok) return fail('http', `HTTP ${response.status}`);
    return succeed({ status: response.status, bytes });
  }


  function findKey(set: KeySet, kid: string, purpose: 'pack' | 'feed', atMs: number): KeyLookup {
    const key = (set.keys ?? []).find((entry) => entry.kid === kid);
    if (!key) return { ok: false, code: 'unknown_key' };
    if (!isEd25519(key.alg) || key.purpose !== purpose) return { ok: false, code: 'key_expired' };
    const notBefore = Date.parse(key.not_before);
    const notAfter = Date.parse(key.not_after);
    if (Number.isFinite(notBefore) && atMs < notBefore) return { ok: false, code: 'key_expired' };
    if (Number.isFinite(notAfter) && atMs > notAfter) return { ok: false, code: 'key_expired' };
    return { ok: true, publicKey: key.public_key };
  }

  function verifyKeySet(set: KeySet, roots: PinnedKey[]): boolean {
    const signature = set.signature;
    if (!isSignature(signature)) return false;
    const root = roots.find((entry) => entry.kid === signature.kid);
    if (!root) return false;
    return verifyEd25519(root.public_key, signedBytes(set), signature.sig);
  }

  /** Dev/test fallback: treats explicit `trustedKeys` as feed keys when keys.json is unavailable. */
  function fallbackKeySet(): KeySet | null {
    const roots = deps.trustedKeys;
    if (!roots || roots.length === 0) return null;
    return {
      schema_version: 1,
      version: 0,
      keys: roots.map((root) => ({
        kid: root.kid,
        alg: 'Ed25519',
        public_key: root.public_key,
        purpose: 'feed',
        not_before: '',
        not_after: '',
      })),
      signature: { kid: '', alg: 'Ed25519', sig: '' },
    };
  }

  async function loadKeySet(signal?: AbortSignal): Promise<KeySet | null> {
    if (keySet !== null && nowMs() - keySetAt < KEY_SET_TTL_MS) return keySet;

    const roots = deps.trustedKeys ?? PINNED_ROOT_KEYS;
    const response = await request(KEY_SET_PATH, signal);
    if (!response.ok) return keySet ?? fallbackKeySet();

    let parsed: unknown;
    try {
      parsed = JSON.parse(decode(response.value.bytes));
    } catch {
      return keySet ?? fallbackKeySet();
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.keys)) return keySet ?? fallbackKeySet();

    const set = parsed as unknown as KeySet;
    if (!verifyKeySet(set, roots)) return keySet ?? fallbackKeySet();
    keySet = set;
    keySetAt = nowMs();
    return set;
  }

  function trustStore(current: KeySet | null): TrustStore {
    return {
      rootKeys: deps.trustedKeys ?? PINNED_ROOT_KEYS,
      ...(current ? { keySet: current } : {}),
      installed: installedMap(),
    };
  }

  async function fetchBlobRaw(ref: BlobRef, signal?: AbortSignal): Promise<Result<Uint8Array, BlobError>> {
    const response = await request(ref.path, signal);
    if (!response.ok) return fail(response.error.code, response.error.message);
    const bytes = response.value.bytes;
    if (bytes.length !== ref.size) return fail('hash_mismatch', 'Blob size mismatch');
    if (sha256Hex(bytes) !== ref.sha256) return fail('hash_mismatch', 'Blob hash mismatch');
    return succeed(bytes);
  }

  function toFeedError(code: BlobError): FeedError {
    if (code === 'offline') return 'offline';
    if (code === 'hash_mismatch') return 'hash_mismatch';
    if (code === 'schema') return 'schema';
    return 'http';
  }

  // --- Feed -------------------------------------------------------------

  function hydrateBulletin(record: Record<string, unknown>, fetchedAt: string): Bulletin | null {
    const source = record.source;
    const storm = record.storm;
    const position = record.position;
    if (!nonEmpty(record.id) || !nonEmpty(record.storm_id) || !nonEmpty(record.issued_at)) return null;
    if (!isRecord(source) || source.agency !== 'PAGASA' || !nonEmpty(source.title) || !nonEmpty(source.url)) {
      return null;
    }
    if (!isRecord(storm) || !nonEmpty(storm.name) || !STORM_CATEGORIES.includes(String(storm.category))) {
      return null;
    }
    if (!isRecord(position) || !isFiniteNumber(position.lat) || !isFiniteNumber(position.lon)) return null;
    if (!inRange(position.lat, -90, 90) || !inRange(position.lon, -180, 180)) return null;
    if (!nonEmpty(position.at) || !nonEmpty(position.text)) return null;

    const signalAreas: { level: TcwsLevel; psgc: string[] }[] = [];
    if (!Array.isArray(record.signal_areas)) return null;
    for (const area of record.signal_areas) {
      if (!isRecord(area)) return null;
      const level = area.level;
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 5) return null;
      if (!Array.isArray(area.psgc) || area.psgc.some((code) => !nonEmpty(code))) return null;
      signalAreas.push({ level: level as TcwsLevel, psgc: [...(area.psgc as string[])] });
    }

    const forecast: { lat: number; lon: number; at: string }[] = [];
    if (record.forecast !== undefined) {
      if (!Array.isArray(record.forecast)) return null;
      for (const point of record.forecast) {
        if (!isRecord(point) || !isFiniteNumber(point.lat) || !isFiniteNumber(point.lon)) return null;
        if (!inRange(point.lat, -90, 90) || !inRange(point.lon, -180, 180)) return null;
        forecast.push({ lat: point.lat, lon: point.lon, at: nonEmpty(point.at) ? point.at : '' });
      }
    }

    const international = nonEmpty(storm.international_name) ? storm.international_name : undefined;
    const movement = isRecord(record.movement) && nonEmpty(record.movement.text)
      ? { text: record.movement.text }
      : undefined;

    return {
      id: record.id,
      stormId: record.storm_id,
      source: { agency: 'PAGASA', title: source.title, url: source.url },
      issuedAt: record.issued_at,
      scrapedAt: nonEmpty(record.scraped_at) ? record.scraped_at : record.issued_at,
      fetchedAt,
      storm: {
        name: storm.name,
        ...(international ? { internationalName: international } : {}),
        category: storm.category as Bulletin['storm']['category'],
      },
      position: {
        lat: position.lat,
        lon: position.lon,
        at: position.at,
        text: position.text,
      },
      ...(movement ? { movement } : {}),
      forecast,
      signalAreas,
      final: record.final === true,
      text: nonEmpty(record.text) ? record.text : '',
    };
  }

  function parseBulletins(bytes: Uint8Array): Result<Bulletin[], 'schema'> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decode(bytes));
    } catch {
      return fail('schema', 'Bulletins file is not valid JSON');
    }
    if (!isRecord(parsed) || parsed.schema_version !== 1 || !Array.isArray(parsed.items)) {
      return fail('schema', 'Unsupported bulletins schema');
    }

    const fetchedAt = nowIso();
    const limit = nowMs() + FUTURE_SKEW_MS;
    const bulletins: Bulletin[] = [];
    for (const item of parsed.items) {
      if (!isRecord(item)) return fail('schema', 'Invalid bulletin record');
      const issued = Date.parse(String(item.issued_at));
      if (!Number.isFinite(issued) || issued > limit) return fail('schema', 'Bulletin issued_at is missing or in the future');
      const bulletin = hydrateBulletin(item, fetchedAt);
      if (bulletin === null) return fail('schema', 'Invalid bulletin record');
      bulletins.push(bulletin);
    }
    bulletins.sort((a, b) => {
      if (a.issuedAt !== b.issuedAt) return a.issuedAt < b.issuedAt ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return succeed(bulletins);
  }

  function parseHotlines(bytes: Uint8Array): Result<Hotline[], 'schema'> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decode(bytes));
    } catch {
      return fail('schema', 'Hotlines file is not valid JSON');
    }
    if (!isRecord(parsed) || parsed.schema_version !== 1 || !Array.isArray(parsed.items)) {
      return fail('schema', 'Unsupported hotlines schema');
    }
    const hotlines: Hotline[] = [];
    for (const item of parsed.items) {
      if (!isRecord(item)) return fail('schema', 'Invalid hotline record');
      if (!nonEmpty(item.id) || !nonEmpty(item.name) || !nonEmpty(item.number)) return fail('schema', 'Invalid hotline record');
      if (item.scope !== 'national' && item.scope !== 'lgu') return fail('schema', 'Invalid hotline scope');
      if (!nonEmpty(item.source_id) || !nonEmpty(item.verified_at)) return fail('schema', 'Hotline lacks a source or reviewer');
      hotlines.push(item as unknown as Hotline);
    }
    return succeed(hotlines);
  }

  function isFeedManifest(value: unknown): value is FeedManifest {
    return (
      isRecord(value) &&
      value.schema_version === 1 &&
      value.manifest_id === 'feed' &&
      isFiniteNumber(value.sequence) &&
      nonEmpty(value.issued_at) &&
      isRecord(value.files) &&
      isBlobRef(value.files['bulletins.json']) &&
      isSignature(value.signature)
    );
  }

  async function fetchFeed(opts: { trigger: 'open' | 'pull' }): Promise<Result<FeedCache | 'unchanged', FeedError>> {
    if (!enabled) return fail('disabled');
    const settings = safeSettings();
    if (settings && settings.feedEnabled === false) return fail('disabled');

    const keys = await loadKeySet();
    if (keys === null) return fail('offline');

    const manifestResponse = await request(FEED_MANIFEST_PATH);
    if (!manifestResponse.ok) return fail(toFeedError(manifestResponse.error.code));

    let raw: unknown;
    try {
      raw = JSON.parse(decode(manifestResponse.value.bytes));
    } catch {
      return fail('schema', 'Feed manifest is not valid JSON');
    }
    if (!isFeedManifest(raw)) return fail('schema', 'Invalid feed manifest');
    const manifest = raw;

    const issuedMs = Date.parse(manifest.issued_at);
    if (!Number.isFinite(issuedMs)) return fail('schema', 'Feed manifest has no issued_at');
    const lookup = findKey(keys, manifest.signature.kid, 'feed', issuedMs);
    if (!lookup.ok) return fail(lookup.code);
    if (!verifyEd25519(lookup.publicKey, signedBytes(manifest), manifest.signature.sig)) {
      return fail('bad_signature');
    }
    if (compareVersions(manifest.min_app_version, appVersion) > 0) return fail('app_too_old');

    const cached = safeFeed();
    if (cached && manifest.sequence < cached.sequence) return fail('rollback');
    if (cached && manifest.sequence === cached.sequence) {
      store.set('feed', { ...cached, checkedAt: nowIso() });
      return succeed('unchanged' as const);
    }

    const bulletinsBlob = await fetchBlobRaw(manifest.files['bulletins.json']);
    if (!bulletinsBlob.ok) return fail(toFeedError(bulletinsBlob.error.code));
    let bulletinsBytes: Uint8Array;
    try {
      bulletinsBytes = gunzipSync(bulletinsBlob.value);
    } catch {
      return fail('schema', 'Bulletins blob is not gzip');
    }
    const bulletins = parseBulletins(bulletinsBytes);
    if (!bulletins.ok) return fail('schema', bulletins.error.message);

    let hotlines: Hotline[] | undefined;
    const hotlinesRef = manifest.files['hotlines.json'];
    if (hotlinesRef) {
      const hotlinesBlob = await fetchBlobRaw(hotlinesRef);
      if (!hotlinesBlob.ok) return fail(toFeedError(hotlinesBlob.error.code));
      try {
        const parsed = parseHotlines(gunzipSync(hotlinesBlob.value));
        if (!parsed.ok) return fail('schema', parsed.error.message);
        hotlines = parsed.value;
      } catch {
        return fail('schema', 'Hotlines blob is not gzip');
      }
    }

    const checkedAt = nowIso();
    const cache: FeedCache = {
      sequence: manifest.sequence,
      issuedAt: manifest.issued_at,
      serverStale: manifest.stale === true,
      bulletins: bulletins.value,
      ...(hotlines ? { hotlines } : {}),
      fetchedAt: checkedAt,
      checkedAt,
    };
    store.set('feed', cache);
    return succeed(cache);
  }

  // --- Packs (centers and Smart Update) ---------------------------------

  function isPackManifest(value: unknown): value is PackManifest {
    return (
      isRecord(value) &&
      value.schema_version === 1 &&
      nonEmpty(value.manifest_id) &&
      nonEmpty(value.issued_at) &&
      Array.isArray(value.packs) &&
      isSignature(value.signature)
    );
  }

  function verifyPackManifest(manifest: PackManifest, keys: KeySet): Result<PackManifest, UpdateError> {
    if (manifest.schema_version !== 1 || !nonEmpty(manifest.manifest_id)) return fail('schema');
    const issued = Date.parse(manifest.issued_at);
    if (!Number.isFinite(issued)) return fail('schema');
    const signature = manifest.signature;
    if (!isSignature(signature)) return fail('bad_signature');
    const lookup = findKey(keys, signature.kid, 'pack', issued);
    if (!lookup.ok) return fail(lookup.code);
    if (!verifyEd25519(lookup.publicKey, signedBytes(manifest), signature.sig)) return fail('bad_signature');
    if (compareVersions(manifest.min_app_version, appVersion) > 0) return fail('app_too_old');
    return succeed(manifest);
  }

  function previewFromManifest(manifest: PackManifest): ImportPreview {
    const packs = (manifest.packs ?? []).map((pack) => {
      const from = installedVersion(pack.pack_id);
      return {
        packId: pack.pack_id,
        kind: pack.kind,
        ...(from !== undefined ? { fromVersion: from } : {}),
        toVersion: pack.version,
        sizeBytes: pack.full.size,
        ...(pack.guide_date ? { guideDate: pack.guide_date } : {}),
        upserts: 0,
        deletes: 0,
      };
    });
    return {
      previewId: `download-${manifest.manifest_id}-${manifest.issued_at}`,
      signedBy: manifest.signature?.kid ?? '',
      packs,
    };
  }

  /** Builds the `.bagyopack`-layout entries verifyPack expects from fetched manifests. */
  function manifestFiles(
    manifests: PackManifest[],
    blobs: Map<string, Uint8Array>,
    current: KeySet | null,
  ): Map<string, Uint8Array> {
    const files = new Map<string, Uint8Array>();
    for (const manifest of manifests) {
      const unsigned: Record<string, unknown> = { ...manifest };
      delete unsigned.signature;
      files.set(`manifests/${manifest.manifest_id}.json`, utf8(canonicalize(unsigned)));
      if (manifest.signature) {
        files.set(`manifests/${manifest.manifest_id}.sig`, utf8(JSON.stringify(manifest.signature)));
      }
    }
    for (const [sha, bytes] of blobs) files.set(`blobs/${sha}.json.gz`, bytes);
    if (current) files.set('keys.json', utf8(JSON.stringify(current)));
    return files;
  }

  async function fetchManifest(path: string, keys: KeySet, signal?: AbortSignal): Promise<Result<PackManifest, UpdateError>> {
    const response = await request(path, signal);
    if (!response.ok) {
      const code = response.error.code;
      return fail(code === 'offline' ? 'offline' : 'http');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(decode(response.value.bytes));
    } catch {
      return fail('schema', 'Manifest is not valid JSON');
    }
    if (!isPackManifest(parsed)) return fail('schema', 'Invalid manifest');
    return verifyPackManifest(parsed, keys);
  }

  async function fetchCenters(provinceCode: string): Promise<Result<ImportPreview | 'unchanged', UpdateError>> {
    if (!enabled) return fail('disabled');
    if (!nonEmpty(provinceCode)) return fail('schema', 'No province code');
    const keys = await loadKeySet();
    if (keys === null) return fail('offline');

    const path = `/v1/areas/${encodeURIComponent(provinceCode)}/manifest.json`;
    const manifestResult = await fetchManifest(path, keys);
    if (!manifestResult.ok) return manifestResult;
    const manifest = manifestResult.value;

    const packId = `centers-${provinceCode}`;
    const entry = (manifest.packs ?? []).find((pack) => pack.pack_id === packId);
    if (!entry) return fail('schema', 'Manifest has no centers bundle');
    const installed = installedVersion(packId);
    if (installed !== undefined && entry.version <= installed) return succeed('unchanged' as const);

    const blob = await fetchBlobRaw(entry.full);
    if (!blob.ok) return fail(blob.error.code, blob.error.message);

    const blobs = new Map<string, Uint8Array>([[entry.full.sha256, blob.value]]);
    const files = manifestFiles([manifest], blobs, keys);
    if (deps.importArchive) return deps.importArchive(files);
    const verified = verifyPack(files, trustStore(keys), appVersion);
    if (!verified.ok) return fail(verified.error.code, verified.error.message);
    return succeed(previewFromManifest(verified.value.manifest));
  }

  async function check(opts: { trigger: 'auto' | 'user' }): Promise<Result<UpdatePlan | null, UpdateError>> {
    if (!enabled) return fail('disabled');
    const settings = safeSettings();
    if (opts.trigger === 'auto' && settings?.autoCheckUpdates !== true) return fail('not_allowed');

    const keys = await loadKeySet();
    if (keys === null) return fail('offline');

    const manifests: PackManifest[] = [];
    const core = await fetchManifest(CORE_MANIFEST_PATH, keys);
    if (!core.ok) return core;
    manifests.push(core.value);

    if (opts.trigger === 'user') {
      const model = await fetchManifest(MODEL_MANIFEST_PATH, keys);
      if (model.ok) manifests.push(model.value);
    }

    const province = deps.province?.() ?? null;
    if (province) {
      const area = await fetchManifest(`/v1/areas/${encodeURIComponent(province)}/manifest.json`, keys);
      if (area.ok) manifests.push(area.value);
    }

    const items: UpdatePlan['items'] = [];
    let totalBytes = 0;
    let guideDate: string | undefined;
    for (const manifest of manifests) {
      for (const pack of manifest.packs ?? []) {
        const from = installedVersion(pack.pack_id);
        if (from !== undefined && pack.version <= from) continue;
        const delta = from !== undefined ? (pack.deltas ?? []).find((entry) => entry.from_version === from) : undefined;
        const blob = delta ?? pack.full;
        items.push({
          packId: pack.pack_id,
          kind: pack.kind,
          ...(from !== undefined ? { fromVersion: from } : {}),
          toVersion: pack.version,
          blob,
          delta: delta !== undefined,
        });
        totalBytes += blob.size;
        if (!guideDate && pack.guide_date) guideDate = pack.guide_date;
      }
    }
    if (items.length === 0) return succeed(null);

    const plan: UpdatePlan = {
      planId: `plan-${items.map((item) => `${item.packId}@${item.toVersion}`).join(',')}`,
      ...(province ? { provinceCode: province } : {}),
      items,
      totalBytes,
      ...(guideDate ? { guideDate } : {}),
    };
    return succeed(plan);
  }

  async function download(
    plan: UpdatePlan,
    onProgress: (bytes: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<Result<ImportPreview, UpdateError>> {
    if (!enabled) return fail('disabled');
    const keys = await loadKeySet();
    if (keys === null) return fail('offline');

    // Re-fetch the manifests the plan refers to so verification stays in one path.
    const manifests: PackManifest[] = [];
    const seen = new Set<string>();
    const wanted = new Set(plan.items.map((item) => item.packId));
    const sources = [CORE_MANIFEST_PATH];
    if (plan.provinceCode) sources.push(`/v1/areas/${encodeURIComponent(plan.provinceCode)}/manifest.json`);
    for (const path of sources) {
      const result = await fetchManifest(path, keys, signal);
      if (!result.ok) return result;
      if (seen.has(result.value.manifest_id)) continue;
      seen.add(result.value.manifest_id);
      manifests.push(result.value);
    }

    const entryByPack = new Map<string, PackEntry>();
    for (const manifest of manifests) {
      for (const pack of manifest.packs ?? []) entryByPack.set(pack.pack_id, pack);
    }

    const blobs = new Map<string, Uint8Array>();
    let done = 0;
    for (const item of plan.items) {
      if (signal?.aborted) return fail('cancelled');
      if (!wanted.has(item.packId)) continue;
      const entry = entryByPack.get(item.packId);
      if (!entry) return fail('schema', `Plan pack ${item.packId} is missing from the manifests`);
      const delta = item.delta ? (entry.deltas ?? []).find((blob) => blob.sha256 === item.blob.sha256) : undefined;
      const ref: BlobRef = delta ?? entry.full;
      const blob = await fetchBlobRaw(ref, signal);
      if (!blob.ok) return fail(blob.error.code, blob.error.message);
      blobs.set(ref.sha256, blob.value);
      done += ref.size;
      onProgress(done, plan.totalBytes);
    }

    const primary = manifests[0];
    if (!primary) return fail('schema', 'No manifest to verify against');
    const files = manifestFiles(manifests, blobs, keys);
    if (deps.importArchive) return deps.importArchive(files);
    const verified = verifyPack(files, trustStore(keys), appVersion);
    if (!verified.ok) return fail(verified.error.code, verified.error.message);
    return succeed(previewFromManifest(verified.value.manifest));
  }

  return { fetchFeed, fetchCenters, check, download };
}
