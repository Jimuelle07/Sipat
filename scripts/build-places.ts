import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Place, PlaceLevel, PlacesFile } from '../app/types/index.ts';

const API = 'https://psgc.gitlab.io/api';
const NAMES_SOURCE_ID = 'psa-psgc-2022-06-30';

// The psgc.gitlab.io mirror's row shape (only the fields used here).
interface PsgcRow {
  code: string;
  name: string;
  regionCode?: string | false;
  provinceCode?: string | false;
  cityCode?: string | false;
  municipalityCode?: string | false;
  isCity?: boolean;
  isMunicipality?: boolean;
}

const str = (v: string | false | undefined): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;

async function get(path: string): Promise<PsgcRow[]> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as PsgcRow[];
}

function place(psgc: string, name: string, level: PlaceLevel, parent: string | null): Place {
  if (level !== 'region' && parent === null) {
    throw new Error(`place ${psgc} (${name}) is a ${level} with no parent`);
  }
  return { psgc, name, level, parent };
}

function manilaNow(): string {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

async function main(): Promise<void> {
  const [regions, provinces, cities, barangays] = await Promise.all([
    get('/regions/'),
    get('/provinces/'),
    get('/cities-municipalities/'),
    get('/barangays/'),
  ]);

  const items: Place[] = [];
  for (const r of regions) items.push(place(r.code, r.name, 'region', null));
  for (const p of provinces) items.push(place(p.code, p.name, 'province', str(p.regionCode)));
  for (const c of cities) {
    const level: PlaceLevel = c.isCity ? 'city' : 'municipality';
    items.push(place(c.code, c.name, level, str(c.provinceCode) ?? str(c.regionCode)));
  }
  for (const b of barangays) {
    items.push(place(b.code, b.name, 'barangay', str(b.cityCode) ?? str(b.municipalityCode)));
  }

  const file: PlacesFile = {
    schema_version: 1,
    content_version: 1,
    generated_at: manilaNow(),
    items,
    names_source_id: NAMES_SOURCE_ID,
    centroids_source_id: null,
  };

  const out = fileURLToPath(new URL('../content/places.json', import.meta.url));
  writeFileSync(out, `${JSON.stringify(file)}\n`, 'utf8');

  const levels = items.reduce<Record<string, number>>((acc, p) => {
    acc[p.level] = (acc[p.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`places.json: ${items.length} places (${JSON.stringify(levels)})`);
  console.log(`bytes: ${statSync(out).size}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
