import type {
  ApplyResult,
  BlobRef,
  ContentFileName,
  ImportPreview,
  InstalledPack,
  KeySet,
  PackEntry,
  PackError,
  PackManager,
  PinnedKey,
  Result,
  Store,
  TrustStore,
  VerifiedPack,
} from '../types/index.ts';
import type { BundledContent } from '../core/validateContent.ts';
import { unzipSync, gunzipSync } from 'fflate';
import { rawContent } from '../content/index.ts';
import { validateContent } from '../core/validateContent.ts';
import { verifyPack } from '../core/verifyPack.ts';
import { PINNED_ROOT_KEYS } from '../core/pinnedKeys.ts';
import { toManilaIso } from '../core/time.ts';

const CORE_PACK_ID = 'core-tl';
const DEFAULT_APP_VERSION = '0.0.0';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function loadBundledContent(): Result<BundledContent, 'content_invalid'> {
  return validateContent(rawContent);
}

function guideVersion(): number {
  const guide = rawContent['guide.tl.json'];
  if (isRec(guide) && typeof guide.content_version === 'number') return guide.content_version;
  return 1;
}

function newestGuideDate(): string {
  const guide = rawContent['guide.tl.json'];
  if (isRec(guide) && Array.isArray(guide.items)) {
    let newest = '';
    for (const passage of guide.items) {
      if (isRec(passage) && typeof passage.reviewed_at === 'string' && passage.reviewed_at > newest) {
        newest = passage.reviewed_at;
      }
    }
    if (newest) return newest;
  }
  if (isRec(guide) && typeof guide.generated_at === 'string') return guide.generated_at.slice(0, 10);
  return '';
}

function parseGzipJson(bytes: Uint8Array): Rec | null {
  try {
    return JSON.parse(new TextDecoder().decode(gunzipSync(bytes))) as Rec;
  } catch {
    return null;
  }
}

function countUpserts(files: unknown): number {
  if (!isRec(files)) return 0;
  let count = 0;
  for (const file of Object.values(files)) {
    if (isRec(file) && Array.isArray(file.items)) count += file.items.length;
    else if (isRec(file) && isRec(file.rules)) count += 1;
  }
  return count;
}

/** Counts the upserts and deletes a full payload or a delta blob carries, for the preview. */
function countChanges(bytes: Uint8Array, isDelta: boolean): { upserts: number; deletes: number } {
  const blob = parseGzipJson(bytes);
  if (!blob) return { upserts: 0, deletes: 0 };
  if (isDelta) {
    let upserts = 0;
    let deletes = 0;
    if (isRec(blob.changes)) {
      for (const change of Object.values(blob.changes)) {
        if (!isRec(change)) continue;
        if (Array.isArray(change.upserts)) upserts += change.upserts.length;
        if (Array.isArray(change.deletes)) deletes += change.deletes.length;
      }
    }
    return { upserts, deletes };
  }
  return { upserts: countUpserts(blob.files), deletes: 0 };
}

/** The ref of a verified pack that actually landed in `blobs`: its delta first, else its full blob. */
function verifiedRef(
  pack: PackEntry,
  installed: number | undefined,
  blobs: Map<string, Uint8Array>,
): (BlobRef & { from_version?: number }) | null {
  const candidates: (BlobRef & { from_version?: number })[] = [];
  if (installed !== undefined && pack.deltas) {
    const delta = pack.deltas.find((entry) => entry.from_version === installed);
    if (delta) candidates.push(delta);
  }
  candidates.push(pack.full);
  return candidates.find((candidate) => blobs.has(candidate.sha256)) ?? null;
}

interface StagedPack {
  preview: ImportPreview;
  contentRaw?: Partial<Record<ContentFileName, unknown>>;
}

export function createPackManager(deps: {
  store: Store;
  now?: () => string;
  readFile?: (uri: string) => Promise<string | Uint8Array | Map<string, Uint8Array>>;
  publicKeys?: Record<string, string>; // legacy; trust now goes through verifyPack
  rootKeys?: PinnedKey[];
  keySet?: KeySet;
  appVersion?: string;
}): PackManager & {
  content(): Result<BundledContent, 'content_invalid'>;
  /** The raw content files behind `content()`, including optional files such as evacuation centers. */
  raw(): Partial<Record<ContentFileName, unknown>>;
  corePack(): InstalledPack;
  importArchive(files: Map<string, Uint8Array>): Promise<Result<ImportPreview, PackError>>;
} {
  const { store } = deps;

  // Never validate or throw here: the engine's init() validates and returns content_invalid.
  const guideDate = newestGuideDate();
  const version = guideVersion();

  const nowIso = (): string => toManilaIso(deps.now ? new Date(deps.now()) : new Date());
  const installedPacks = (): InstalledPack[] => store.get('packs') ?? [];

  const ensureCore = (): void => {
    const packs = installedPacks();
    if (packs.some((pack) => pack.packId === CORE_PACK_ID)) return;
    const core: InstalledPack = {
      packId: CORE_PACK_ID,
      kind: 'core',
      version,
      guideDate,
      installedAt: nowIso(),
    };
    store.set('packs', [...packs, core]);
  };

  ensureCore();

  const staged = new Map<string, StagedPack>();
  let previewCounter = 0;
  let learnedKeySet = deps.keySet;
  let activeContent: BundledContent | null = null;
  let activeRaw: Partial<Record<ContentFileName, unknown>> | null = null;

  const readEntries = async (uri: string): Promise<Map<string, Uint8Array> | null> => {
    if (!deps.readFile) return null;
    let raw: string | Uint8Array | Map<string, Uint8Array>;
    try {
      raw = await deps.readFile(uri);
    } catch {
      return null;
    }
    if (raw instanceof Map) return raw;
    if (raw instanceof Uint8Array) {
      try {
        return new Map(Object.entries(unzipSync(raw)));
      } catch {
        return null;
      }
    }
    return null; // the plain-JSON manifest path is gone; a pack must be a real archive
  };

  const contentFromBlobs = (verified: VerifiedPack, installed: Record<string, number>): StagedPack['contentRaw'] => {
    let files: Partial<Record<ContentFileName, unknown>> | undefined;
    for (const pack of verified.manifest.packs ?? []) {
      const ref = verifiedRef(pack, installed[pack.pack_id], verified.blobs);
      if (!ref || ref.from_version !== undefined) continue; // deltas are not merged into content here
      const blob = verified.blobs.get(ref.sha256);
      if (!blob) continue;
      const payload = parseGzipJson(blob);
      if (payload && isRec(payload.files)) files = { ...(files ?? {}), ...payload.files };
    }
    return files;
  };

  const importArchive = async (entries: Map<string, Uint8Array>): Promise<Result<ImportPreview, PackError>> => {
    const installed: Record<string, number> = {};
    for (const pack of installedPacks()) installed[pack.packId] = pack.version;

    const trust: TrustStore = {
      rootKeys: deps.rootKeys ?? PINNED_ROOT_KEYS,
      ...(learnedKeySet ? { keySet: learnedKeySet } : {}),
      installed,
    };
    const verified = verifyPack(entries, trust, deps.appVersion ?? DEFAULT_APP_VERSION);
    if (!verified.ok) return { ok: false, error: verified.error };
    const value = verified.value;
    if (value.keySet) learnedKeySet = value.keySet;

    const packs: ImportPreview['packs'] = [];
    for (const pack of value.manifest.packs ?? []) {
      const ref = verifiedRef(pack, installed[pack.pack_id], value.blobs);
      if (!ref) continue;
      const bytes = value.blobs.get(ref.sha256);
      if (!bytes) continue;
      const counts = countChanges(bytes, ref.from_version !== undefined);
      packs.push({
        packId: pack.pack_id,
        kind: pack.kind,
        ...(installed[pack.pack_id] !== undefined ? { fromVersion: installed[pack.pack_id] } : {}),
        toVersion: pack.version,
        sizeBytes: ref.size,
        ...(nonEmpty(pack.guide_date) ? { guideDate: pack.guide_date } : guideDate ? { guideDate } : {}),
        upserts: counts.upserts,
        deletes: counts.deletes,
      });
    }

    const preview: ImportPreview = {
      previewId: `preview-${++previewCounter}`,
      signedBy: value.manifest.signature?.kid ?? '',
      packs,
    };
    const contentRaw = contentFromBlobs(value, installed);
    staged.set(preview.previewId, { preview, ...(contentRaw ? { contentRaw } : {}) });
    return { ok: true, value: preview };
  };

  const importFile = async (uri: string): Promise<Result<ImportPreview, PackError>> => {
    const entries = await readEntries(uri);
    if (!entries) return { ok: false, error: { code: 'bad_archive', message: 'The file is not a valid pack archive' } };
    return importArchive(entries);
  };

  const apply = async (previewId: string): Promise<Result<ApplyResult, PackError | 'io'>> => {
    const entry = staged.get(previewId);
    if (!entry) return { ok: false, error: { code: 'io', message: 'Unknown preview' } };
    try {
      // Stage the merged content, swap it in one step, then move the version pointer.
      if (entry.contentRaw) {
        const mergedRaw = { ...rawContent, ...entry.contentRaw };
        const merged = validateContent(mergedRaw);
        if (merged.ok) {
          activeContent = merged.value;
          activeRaw = mergedRaw;
        }
      }
      const current = [...installedPacks()];
      const applied: { packId: string; version: number }[] = [];
      for (const pack of entry.preview.packs) {
        const index = current.findIndex((installed) => installed.packId === pack.packId);
        const existing = index >= 0 ? current[index] : undefined;
        const next: InstalledPack = {
          packId: pack.packId,
          kind: pack.kind,
          version: pack.toVersion,
          ...(pack.guideDate ? { guideDate: pack.guideDate } : {}),
          installedAt: nowIso(),
          ...(existing ? { previousVersion: existing.version } : {}),
        };
        if (index >= 0) current[index] = next;
        else current.push(next);
        applied.push({ packId: pack.packId, version: pack.toVersion });
      }
      store.set('packs', current);
      staged.delete(previewId);
      return { ok: true, value: { applied, ...(entry.preview.packs[0]?.guideDate ? { guideDate: entry.preview.packs[0].guideDate } : {}) } };
    } catch {
      return { ok: false, error: { code: 'io', message: 'Could not save the pack' } };
    }
  };

  const rollback = async (packId: string): Promise<Result<void, 'io' | 'nothing_to_roll_back'>> => {
    const current = [...installedPacks()];
    const index = current.findIndex((pack) => pack.packId === packId);
    const existing = index >= 0 ? current[index] : undefined;
    if (!existing || existing.previousVersion === undefined) {
      return { ok: false, error: { code: 'nothing_to_roll_back', message: 'No previous version' } };
    }
    try {
      const previous = existing.previousVersion;
      current[index] = {
        packId: existing.packId,
        kind: existing.kind,
        version: previous,
        ...(existing.guideDate ? { guideDate: existing.guideDate } : {}),
        installedAt: nowIso(),
      };
      store.set('packs', current);
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: { code: 'io', message: 'Could not save the rollback' } };
    }
  };

  const corePack = (): InstalledPack => {
    const core = installedPacks().find((pack) => pack.packId === CORE_PACK_ID);
    if (core) return core;
    ensureCore();
    return installedPacks().find((pack) => pack.packId === CORE_PACK_ID) as InstalledPack;
  };

  return {
    installed: () => installedPacks().map((pack) => ({ ...pack })),
    importFile,
    importArchive,
    apply,
    rollback,
    content: () => (activeContent ? { ok: true as const, value: activeContent } : loadBundledContent()),
    raw: () => activeRaw ?? rawContent,
    corePack,
  };
}
