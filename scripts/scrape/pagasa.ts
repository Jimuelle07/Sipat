#!/usr/bin/env tsx
// Scheduled server-side scraper for PAGASA Tropical Cyclone Bulletins.
//
// Usage: npx tsx scripts/scrape/pagasa.ts --out <file>
//
// Fetches PAGASA's public tropical cyclone bulletin page, parses the newest bulletin of every
// active bagyo and writes `bulletins.json` as a `ContentFile<BulletinRecord>` envelope
// (docs/api-layer.md section 10). GET only, our own job, never the phone.
//
// - No active bagyo: an empty list is written.
// - Any fetch or parse failure: the previous output file is left untouched, a "stale" message is
//   printed and the job exits non-zero, so the feed can mark the previous files stale.
// - The parser never guesses: signal-area names with no PSGC match fail the run.
//
// The bulletin URL is fixed below; `sources.json` lists the matching PAGASA source. Confirm
// PAGASA's terms and any exact URL changes before the Pilot.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { BulletinRecord, ContentFile } from '../../app/types/index.ts';
import { parseBulletins, type ScrapeMeta } from './parse.ts';

const BULLETIN_URLS = [
  'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin',
];

const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT = 'Sipat-Scraper/0.1 (+contact: fill in)';

function manilaNow(): string {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

function parseArgs(argv: string[]): { out: string | null; error: string | null } {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[i + 1] ?? null;
      i += 1;
    } else if (arg?.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    }
  }
  if (!out) return { out: null, error: 'missing required --out <file>' };
  return { out, error: null };
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function nextContentVersion(out: string): number {
  if (!existsSync(out)) return 1;
  try {
    const previous = JSON.parse(readFileSync(out, 'utf8')) as { content_version?: unknown };
    const version = previous.content_version;
    return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version + 1 : 1;
  } catch {
    return 1;
  }
}

function stale(message: string): never {
  process.stderr.write(`stale: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { out, error } = parseArgs(process.argv.slice(2));
  if (error || !out) stale(error ?? 'missing required --out <file>');

  const scrapedAt = manilaNow();
  const records: BulletinRecord[] = [];

  for (const url of BULLETIN_URLS) {
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      stale(`fetch failed for ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const meta: ScrapeMeta = { sourceUrl: url, scrapedAt };
    const parsed = parseBulletins(html, meta);
    if (!parsed.ok) {
      stale(`${url}: ${parsed.error.code}: ${parsed.error.message}`);
    }
    records.push(...parsed.value);
  }

  const seen = new Set<string>();
  const items: BulletinRecord[] = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    items.push(record);
  }
  items.sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));

  const file: ContentFile<BulletinRecord> = {
    schema_version: 1,
    content_version: nextContentVersion(out),
    generated_at: scrapedAt,
    items,
  };

  const payload = `${JSON.stringify(file)}\n`;
  const temp = `${out}.tmp`;
  writeFileSync(temp, payload, 'utf8');
  renameSync(temp, out);

  process.stdout.write(
    `wrote ${items.length} bulletin(s) to ${out} (scraped_at ${scrapedAt})\n`,
  );
}

main().catch((e: unknown) => {
  stale(e instanceof Error ? e.message : String(e));
});
