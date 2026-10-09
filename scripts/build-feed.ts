/**
 * Builds and signs the PAGASA bulletin feed (docs/api-layer.md section 10).
 *
 * Input: a `BulletinRecord[]` (or `ContentFile<BulletinRecord>`) JSON file, e.g.
 * the scraper output, and optionally a reviewed `Hotline[]` file. The build
 * refuses any record missing the provenance fields AGENTS rule 7 requires, then
 * writes gzip blobs and a feed-key-signed `out/v1/feed/manifest.json`.
 *
 * Bulletins are auto-published live data, never reviewed passage by passage, so
 * this script only checks provenance, never content wording.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BulletinRecord, ContentFile, FeedManifest, Hotline } from '../app/types/index.ts';
import {
  makeBlob,
  manilaIso,
  parseArgs,
  readJson,
  readKey,
  signManifest,
  writeBlob,
  writeJson,
  type BlobArtifact,
} from './lib/publish.ts';

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isUrl = (v: unknown): v is string => nonEmpty(v) && /^https?:\/\//.test(v);

/** Required provenance for every bulletin: agency, source title and URL, issued and scraped time. */
export function validateBulletins(records: unknown[]): string[] {
  const problems: string[] = [];
  records.forEach((raw, i) => {
    const where = `bulletins[${i}]`;
    if (!isRec(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = nonEmpty(raw.id) ? raw.id : where;
    if (!nonEmpty(raw.id)) problems.push(`${where}: missing id`);
    if (!nonEmpty(raw.storm_id)) problems.push(`${id}: missing storm_id`);
    if (!isRec(raw.source)) {
      problems.push(`${id}: missing source`);
    } else {
      if (raw.source.agency !== 'PAGASA') problems.push(`${id}: source.agency must be 'PAGASA'`);
      if (!nonEmpty(raw.source.title)) problems.push(`${id}: missing source.title`);
      if (!isUrl(raw.source.url)) problems.push(`${id}: missing source.url`);
    }
    if (!isIso(raw.issued_at)) problems.push(`${id}: missing issued_at`);
    if (!isIso(raw.scraped_at)) problems.push(`${id}: missing scraped_at`);
  });
  return problems;
}

/** Feed hotlines carry only national, reviewer-approved records: source and verified date. */
export function validateHotlines(records: unknown[]): string[] {
  const problems: string[] = [];
  records.forEach((raw, i) => {
    const where = `hotlines[${i}]`;
    if (!isRec(raw)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const id = nonEmpty(raw.id) ? raw.id : where;
    if (!nonEmpty(raw.id)) problems.push(`${where}: missing id`);
    if (!nonEmpty(raw.source_id)) problems.push(`${id}: missing source_id`);
    if (!nonEmpty(raw.verified_at)) problems.push(`${id}: missing verified_at`);
    if (raw.scope !== 'national') problems.push(`${id}: feed hotlines must have scope 'national'`);
    if (!nonEmpty(raw.number)) problems.push(`${id}: missing number`);
  });
  return problems;
}

/** Accepts either a plain array of records or a `ContentFile` envelope. */
export function recordsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRec(value) && Array.isArray(value.items)) return value.items;
  throw new Error('expected an array of records or a ContentFile with an items array');
}

export interface BuildFeedOptions {
  bulletins: BulletinRecord[];
  hotlines?: Hotline[];
  sequence: number;
  minAppVersion: string;
  kid: string;
  privateKey: string;
  outDir: string;
  issuedAt?: string;
  stale?: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  now?: Date;
}

export interface BuildFeedResult {
  manifest: FeedManifest;
  blobs: BlobArtifact[];
}

export function buildFeed(opts: BuildFeedOptions): BuildFeedResult {
  const bulletinProblems = validateBulletins(opts.bulletins as unknown[]);
  if (bulletinProblems.length > 0) throw new Error(`bulletins invalid: ${bulletinProblems.join('; ')}`);
  if (opts.hotlines !== undefined) {
    const hotlineProblems = validateHotlines(opts.hotlines as unknown[]);
    if (hotlineProblems.length > 0) throw new Error(`hotlines invalid: ${hotlineProblems.join('; ')}`);
  }
  if (!Number.isInteger(opts.sequence) || opts.sequence < 1) {
    throw new Error('sequence must be a positive integer');
  }

  const issuedAt = opts.issuedAt ?? manilaIso(opts.now);
  const ordered = [...opts.bulletins].sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));

  const bulletinsFile: ContentFile<BulletinRecord> = {
    schema_version: 1,
    content_version: opts.sequence,
    generated_at: issuedAt,
    items: ordered,
  };
  const bulletinsBlob = makeBlob(bulletinsFile);
  const blobs: BlobArtifact[] = [bulletinsBlob];
  const files: FeedManifest['files'] = { 'bulletins.json': bulletinsBlob.ref };

  if (opts.hotlines !== undefined) {
    const hotlinesFile: ContentFile<Hotline> = {
      schema_version: 1,
      content_version: opts.sequence,
      generated_at: issuedAt,
      items: opts.hotlines,
    };
    const hotlinesBlob = makeBlob(hotlinesFile);
    blobs.push(hotlinesBlob);
    files['hotlines.json'] = hotlinesBlob.ref;
  }

  const base: Omit<FeedManifest, 'signature'> = {
    schema_version: 1,
    manifest_id: 'feed',
    sequence: opts.sequence,
    issued_at: issuedAt,
    min_app_version: opts.minAppVersion,
    stale: opts.stale ?? false,
    last_attempt_at: opts.lastAttemptAt ?? issuedAt,
    last_success_at: opts.lastSuccessAt ?? issuedAt,
    files,
  };
  const manifest = signManifest(base, opts.kid, opts.privateKey);

  for (const blob of blobs) writeBlob(opts.outDir, blob);
  writeJson(join(opts.outDir, 'feed', 'manifest.json'), manifest);

  return { manifest, blobs };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bulletinsPath = args.require('bulletins');
  const hotlinesPath = args.value('hotlines');
  const keysDir = args.value('keys') ?? 'keys';
  const outDir = args.value('out') ?? 'out/v1';
  const sequence = Number(args.require('sequence'));
  const minAppVersion = args.value('min-app-version') ?? '1.1.0';

  const bulletins = recordsOf(readJson(bulletinsPath)) as BulletinRecord[];
  const hotlines = hotlinesPath !== undefined ? (recordsOf(readJson(hotlinesPath)) as Hotline[]) : undefined;
  const key = readKey(keysDir, 'feed');

  const result = buildFeed({
    bulletins,
    ...(hotlines !== undefined ? { hotlines } : {}),
    sequence,
    minAppVersion,
    kid: key.kid,
    privateKey: key.private_key,
    outDir,
    ...(args.value('issued-at') !== undefined ? { issuedAt: args.value('issued-at') as string } : {}),
    stale: args.flag('stale'),
    ...(args.value('last-attempt-at') !== undefined ? { lastAttemptAt: args.value('last-attempt-at') as string } : {}),
    ...(args.value('last-success-at') !== undefined ? { lastSuccessAt: args.value('last-success-at') as string } : {}),
  });

  console.log(`feed sequence ${result.manifest.sequence} (kid ${key.kid})`);
  for (const blob of result.blobs) {
    console.log(`  blob ${blob.ref.path} (${blob.ref.size} bytes)`);
  }
  console.log(`  manifest ${join(outDir, 'feed', 'manifest.json')}`);
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
