/**
 * Builds and signs guide packs (docs/api-layer.md section 10 "Pack format").
 *
 * `core` is built from the `content/` files and validated with
 * `validateContent`. An area pack (`centers-{provinceCode}`) can be built from a
 * reviewed evacuation-center file. Both write a full gzip blob and a
 * pack-key-signed manifest under the CDN layout (`out/v1/`), and optionally a
 * `.bagyopack` zip with the exact import layout.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  ContentFile,
  ContentFileName,
  EvacuationCenter,
  PackEntry,
  PackManifest,
  PackPayload,
  Signature,
} from '../app/types/index.ts';
import { REQUIRED_CONTENT_FILES, validateContent } from '../app/core/validateContent.ts';
import {
  makeBlob,
  manilaIso,
  parseArgs,
  readJson,
  readKey,
  signManifest,
  writeBagyoPack,
  writeBlob,
  writeJson,
  type BagyoPackManifestEntry,
  type BlobArtifact,
} from './lib/publish.ts';

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BuiltPack {
  manifest: PackManifest;
  manifestId: string;
  signature: Signature;
  blobs: BlobArtifact[];
}

function deriveGuideDate(content: Partial<Record<ContentFileName, unknown>>): string | undefined {
  const guide = content['guide.tl.json'];
  if (isRec(guide) && typeof guide.generated_at === 'string') return guide.generated_at.slice(0, 10);
  return undefined;
}

export interface BuildCorePackOptions {
  content: Partial<Record<ContentFileName, unknown>>;
  version: number;
  kid: string;
  privateKey: string;
  outDir: string;
  minAppVersion: string;
  packId?: string;
  manifestId?: string;
  guideDate?: string;
  issuedAt?: string;
  now?: Date;
}

export function buildCorePack(opts: BuildCorePackOptions): BuiltPack {
  const validated = validateContent(opts.content);
  if (!validated.ok) throw new Error(`content invalid: ${validated.error.message}`);

  const packId = opts.packId ?? 'core-tl';
  const manifestId = opts.manifestId ?? 'core';
  const issuedAt = opts.issuedAt ?? manilaIso(opts.now);

  const payload: PackPayload = {
    schema_version: 1,
    pack_id: packId,
    version: opts.version,
    files: opts.content,
  };
  const blob = makeBlob(payload);
  writeBlob(opts.outDir, blob);

  const entry: PackEntry = { pack_id: packId, kind: 'core', version: opts.version, full: blob.ref };
  const guideDate = opts.guideDate ?? deriveGuideDate(opts.content);
  if (guideDate !== undefined) entry.guide_date = guideDate;

  const base: Omit<PackManifest, 'signature'> = {
    schema_version: 1,
    manifest_id: manifestId,
    issued_at: issuedAt,
    min_app_version: opts.minAppVersion,
    packs: [entry],
  };
  const signed = signManifest(base, opts.kid, opts.privateKey);
  writeJson(join(opts.outDir, manifestId, 'manifest.json'), signed);

  return { manifest: signed, manifestId, signature: signed.signature, blobs: [blob] };
}

/** Every center needs a source, a reviewer with a date, and real coordinates. */
export function validateCenters(centers: unknown[]): string[] {
  const problems: string[] = [];
  centers.forEach((raw, i) => {
    const where = `evacuation_centers[${i}]`;
    if (!isRec(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = nonEmpty(raw.id) ? raw.id : where;
    if (!nonEmpty(raw.id)) problems.push(`${where}: missing id`);
    if (!nonEmpty(raw.psgc)) problems.push(`${id}: missing psgc`);
    if (!nonEmpty(raw.source_id)) problems.push(`${id}: missing source_id`);
    if (!nonEmpty(raw.reviewed_by)) problems.push(`${id}: missing reviewed_by`);
    if (typeof raw.reviewed_at !== 'string' || !DATE_RE.test(raw.reviewed_at)) {
      problems.push(`${id}: reviewed_at must be YYYY-MM-DD`);
    }
    const coords = raw.coords;
    const badCoords =
      !isRec(coords) ||
      typeof coords.lat !== 'number' ||
      typeof coords.lon !== 'number' ||
      (coords.lat === 0 && coords.lon === 0) ||
      coords.lat < -90 ||
      coords.lat > 90 ||
      coords.lon < -180 ||
      coords.lon > 180;
    if (badCoords) problems.push(`${id}: coords must be real numbers in range, not 0,0`);
  });
  return problems;
}

export interface BuildAreaPackOptions {
  centers: EvacuationCenter[];
  provinceCode: string;
  version: number;
  kid: string;
  privateKey: string;
  outDir: string;
  minAppVersion: string;
  issuedAt?: string;
  now?: Date;
}

export function buildAreaPack(opts: BuildAreaPackOptions): BuiltPack {
  const problems = validateCenters(opts.centers as unknown[]);
  if (problems.length > 0) throw new Error(`evacuation centers invalid: ${problems.join('; ')}`);

  const packId = `centers-${opts.provinceCode}`;
  const manifestId = `area-${opts.provinceCode}`;
  const issuedAt = opts.issuedAt ?? manilaIso(opts.now);

  const envelope: ContentFile<EvacuationCenter> = {
    schema_version: 1,
    content_version: opts.version,
    generated_at: issuedAt,
    items: opts.centers,
  };
  const payload: PackPayload = {
    schema_version: 1,
    pack_id: packId,
    version: opts.version,
    files: { 'evacuation_centers.json': envelope },
  };
  const blob = makeBlob(payload);
  writeBlob(opts.outDir, blob);

  const entry: PackEntry = {
    pack_id: packId,
    kind: 'area',
    version: opts.version,
    applies_to: { psgc: [opts.provinceCode] },
    full: blob.ref,
  };

  const base: Omit<PackManifest, 'signature'> = {
    schema_version: 1,
    manifest_id: manifestId,
    issued_at: issuedAt,
    min_app_version: opts.minAppVersion,
    packs: [entry],
  };
  const signed = signManifest(base, opts.kid, opts.privateKey);
  writeJson(join(opts.outDir, 'areas', opts.provinceCode, 'manifest.json'), signed);

  return { manifest: signed, manifestId, signature: signed.signature, blobs: [blob] };
}

function readContentDir(dir: string): Partial<Record<ContentFileName, unknown>> {
  const content: Partial<Record<ContentFileName, unknown>> = {};
  for (const file of REQUIRED_CONTENT_FILES) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    content[file] = JSON.parse(readFileSync(path, 'utf8'));
  }
  return content;
}

function recordsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRec(value) && Array.isArray(value.items)) return value.items;
  throw new Error('expected an array of records or a ContentFile with an items array');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const keysDir = args.value('keys') ?? 'keys';
  const outDir = args.value('out-dir') ?? 'out/v1';
  const contentDir = args.value('content') ?? 'content';
  const version = Number(args.value('version') ?? '1');
  const minAppVersion = args.value('min-app-version') ?? '1.1.0';
  if (!Number.isInteger(version) || version < 1) throw new Error('--version must be a positive integer');

  const key = readKey(keysDir, 'pack');
  const built: BuiltPack[] = [];

  const core = buildCorePack({
    content: readContentDir(contentDir),
    version,
    kid: key.kid,
    privateKey: key.private_key,
    outDir,
    minAppVersion,
    ...(args.value('pack-id') !== undefined ? { packId: args.value('pack-id') as string } : {}),
    ...(args.value('manifest-id') !== undefined ? { manifestId: args.value('manifest-id') as string } : {}),
    ...(args.value('guide-date') !== undefined ? { guideDate: args.value('guide-date') as string } : {}),
    ...(args.value('issued-at') !== undefined ? { issuedAt: args.value('issued-at') as string } : {}),
  });
  built.push(core);
  console.log(`core pack ${core.manifest.packs?.[0]?.pack_id} version ${version} (kid ${key.kid})`);

  const centersPath = args.value('centers');
  if (centersPath !== undefined) {
    const province = args.require('province');
    const centers = recordsOf(readJson(centersPath)) as EvacuationCenter[];
    const area = buildAreaPack({
      centers,
      provinceCode: province,
      version,
      kid: key.kid,
      privateKey: key.private_key,
      outDir,
      minAppVersion,
      ...(args.value('issued-at') !== undefined ? { issuedAt: args.value('issued-at') as string } : {}),
    });
    built.push(area);
    console.log(`area pack centers-${province} version ${version}`);
  }

  for (const pack of built) {
    for (const blob of pack.blobs) console.log(`  blob ${blob.ref.path} (${blob.ref.size} bytes)`);
  }

  const bagyoPackPath = args.value('out');
  if (bagyoPackPath !== undefined) {
    const keysJsonPath = args.value('keys-json') ?? join(outDir, 'keys.json');
    const includeKeys = args.value('keys-json') !== undefined || args.flag('with-keys');
    const keysJson = includeKeys && existsSync(keysJsonPath) ? readJson(keysJsonPath) : undefined;
    const entries: BagyoPackManifestEntry[] = built.map((pack) => ({
      manifestId: pack.manifestId,
      manifest: pack.manifest,
      signature: pack.signature,
    }));
    writeBagyoPack(bagyoPackPath, {
      entries,
      blobs: built.flatMap((pack) => pack.blobs),
      ...(keysJson !== undefined ? { keysJson } : {}),
    });
    console.log(`bagyopack ${bagyoPackPath} (${entries.length} manifest${entries.length === 1 ? '' : 's'})`);
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
