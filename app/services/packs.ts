import type {
  ApplyResult,
  BundledContent,
  ImportPreview,
  InstalledPack,
  PackError,
  PackKind,
  PackManager,
  Result,
  Store,
} from '../types/index.ts';
import { rawContent } from '../content/index.ts';
import { validateContent } from '../core/validateContent.ts';
import { toManilaIso } from '../core/time.ts';

const CORE_PACK_ID = 'core-tl';
const SUPPORTED_SCHEMA_VERSION = 1;
const PACK_KINDS: readonly PackKind[] = ['core', 'area', 'language', 'model'];

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function loadBundledContent(): Result<BundledContent, string> {
  const result = validateContent(rawContent);
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, error: { code: result.error.code, message: result.error.message } };
}

function guideVersion(): number {
  const guide = rawContent['guide.tl.json'];
  if (isRec(guide) && typeof guide.content_version === 'number') return guide.content_version;
  return 1;
}

function newestGuideDate(content: BundledContent): string {
  let newest = '';
  for (const passage of content.passages) {
    if (typeof passage.reviewed_at === 'string' && passage.reviewed_at > newest) newest = passage.reviewed_at;
  }
  if (newest) return newest;
  const guide = rawContent['guide.tl.json'];
  if (isRec(guide) && typeof guide.generated_at === 'string') return guide.generated_at.slice(0, 10);
  return '';
}

function blobSize(full: unknown): number {
  return isRec(full) && typeof full.size === 'number' ? full.size : 0;
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

function decode(data: string | Uint8Array): string {
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

export function createPackManager(deps: {
  store: Store;
  now?: () => string;
  readFile?: (uri: string) => Promise<string | Uint8Array>;
  publicKeys?: Record<string, string>;
}): PackManager & { content(): BundledContent; corePack(): InstalledPack } {
  const { store, publicKeys } = deps;

  const loaded = loadBundledContent();
  if (!loaded.ok) throw new Error(`Bundled content is invalid: ${loaded.error.message}`);
  const contentValue = loaded.value;
  const guideDate = newestGuideDate(contentValue);
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

  const previews = new Map<string, ImportPreview>();
  let previewCounter = 0;

  const fail = (code: PackError, message: string): Result<ImportPreview, PackError> => ({
    ok: false,
    error: { code, message },
  });

  const importFile = async (uri: string): Promise<Result<ImportPreview, PackError>> => {
    if (!deps.readFile) return fail('bad_archive', 'No file reader available');

    let text: string;
    try {
      text = decode(await deps.readFile(uri));
    } catch {
      return fail('bad_archive', 'Could not read the file');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fail('bad_archive', 'The file is not a valid pack archive');
    }
    if (!isRec(parsed)) return fail('bad_archive', 'The file is not a valid pack archive');

    const bundle = parsed;
    const manifest = isRec(bundle.manifest) ? bundle.manifest : bundle;

    if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      return fail('schema', 'Unsupported schema version');
    }
    if (!nonEmpty(manifest.manifest_id) || !Array.isArray(manifest.packs)) {
      return fail('schema', 'Manifest is missing required fields');
    }

    const packs = manifest.packs.filter(isRec);
    if (packs.length !== manifest.packs.length) return fail('schema', 'Invalid pack entry');
    for (const pack of packs) {
      if (!nonEmpty(pack.pack_id) || !nonEmpty(pack.kind) || !PACK_KINDS.includes(pack.kind as PackKind)) {
        return fail('schema', 'Invalid pack entry');
      }
      if (typeof pack.version !== 'number' || !Number.isInteger(pack.version) || pack.version < 1) {
        return fail('schema', 'Invalid pack version');
      }
    }

    const current = installedPacks();
    for (const pack of packs) {
      const existing = current.find((installed) => installed.packId === pack.pack_id);
      if (existing && (pack.version as number) <= existing.version) {
        return fail('rollback', 'Pack version is not newer than the installed one');
      }
    }

    if (!publicKeys || Object.keys(publicKeys).length === 0) {
      return fail('unknown_key', 'No trusted signing key for this pack');
    }
    const signature = manifest.signature;
    if (!isRec(signature) || !nonEmpty(signature.kid)) {
      return fail('bad_signature', 'Manifest has no signature');
    }
    if (!(signature.kid in publicKeys)) {
      return fail('unknown_key', `Unknown signing key ${signature.kid}`);
    }

    const payloads = isRec(bundle.payloads) ? bundle.payloads : {};
    const preview: ImportPreview = {
      previewId: `preview-${++previewCounter}`,
      signedBy: signature.kid,
      packs: packs.map((pack) => {
        const existing = current.find((installed) => installed.packId === pack.pack_id);
        const payload = payloads[pack.pack_id as string];
        return {
          packId: pack.pack_id as string,
          kind: pack.kind as PackKind,
          fromVersion: existing?.version,
          toVersion: pack.version as number,
          sizeBytes: blobSize(pack.full),
          guideDate: nonEmpty(pack.guide_date) ? pack.guide_date : guideDate,
          upserts: countUpserts(isRec(payload) ? payload.files : undefined),
          deletes: 0,
        };
      }),
    };
    previews.set(preview.previewId, preview);
    return { ok: true, value: preview };
  };

  const apply = async (previewId: string): Promise<Result<ApplyResult, PackError | 'io'>> => {
    const preview = previews.get(previewId);
    if (!preview) return { ok: false, error: { code: 'io', message: 'Unknown preview' } };
    try {
      const current = [...installedPacks()];
      const applied: { packId: string; version: number }[] = [];
      for (const pack of preview.packs) {
        const index = current.findIndex((installed) => installed.packId === pack.packId);
        const existing = index >= 0 ? current[index] : undefined;
        const next: InstalledPack = {
          packId: pack.packId,
          kind: pack.kind,
          version: pack.toVersion,
          guideDate: pack.guideDate,
          installedAt: nowIso(),
          previousVersion: existing ? existing.version : undefined,
        };
        if (index >= 0) current[index] = next;
        else current.push(next);
        applied.push({ packId: pack.packId, version: pack.toVersion });
      }
      store.set('packs', current);
      previews.delete(previewId);
      return { ok: true, value: { applied, guideDate: preview.packs[0]?.guideDate ?? guideDate } };
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
        guideDate: existing.guideDate,
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
    apply,
    rollback,
    content: () => contentValue,
    corePack,
  };
}
