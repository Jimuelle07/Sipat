// Pure parser for PAGASA Tropical Cyclone Bulletin pages.
//
// The live Severe Weather Bulletin page renders one tab per active bagyo. Each tab is a
// self-contained fragment (storm label, issued time, panels for location/movement/strength,
// forecast positions and a wind-signal table). This module turns that HTML into
// `BulletinRecord`s (docs/api-layer.md section 10, "Scraper output").
//
// Rules enforced here:
// - Only the fields `BulletinRecord` holds are produced. Nothing is guessed: a missing or
//   ambiguous required field is an error.
// - Signal-area names map to PSGC codes only through an exact normalized name match against
//   content/places.json. A name with no match is reported verbatim and the bulletin fails with
//   `unknown_area`, so the CLI keeps the previous feed (never a guess).
// - Bulletin text, coordinates and times are kept verbatim where the page states them.

import { readFileSync } from 'node:fs';
import type {
  BulletinRecord,
  Place,
  PlaceLevel,
  PlacesFile,
  Result,
  StormCategory,
  TcwsLevel,
} from '../../app/types/index.ts';

export interface ScrapeMeta {
  sourceUrl: string;
  scrapedAt: string;
}

// Subset of docs/api-layer.md `ScrapeFailure` that a single-bulletin parse can produce.
export type ParseError =
  | 'layout_changed' // an expected section was not found
  | 'missing_field' // a required field is absent
  | 'bad_time' // issued_at / forecast time missing, unparseable or in the future
  | 'bad_position' // coordinates missing or out of range
  | 'unknown_area'; // a signal-area name with no PSGC match

export interface PlaceRef {
  psgc: string;
  level: PlaceLevel;
}

export interface PlaceNameIndex {
  readonly byName: Map<string, PlaceRef[]>;
}

// PAGASA wind-signal areas are provinces (and sometimes regions/cities). When one name exists at
// several administrative levels, the highest level wins; several matches at the same level are
// ambiguous and left unmatched (never guessed).
const LEVEL_PREFERENCE: PlaceLevel[] = ['province', 'region', 'city', 'municipality', 'barangay'];

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTHS_SHORT: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '\u00b0',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018',
  ldquo: '\u201c', rdquo: '\u201d',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const raw = body.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// Visible text of an HTML fragment: tags removed, entities decoded, whitespace collapsed.
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Exact normalized area/place name: NFKD, diacritics dropped, lowercased, punctuation folded to
// spaces, whitespace collapsed. "Ilocos Norte" -> "ilocos norte".
export function normalizeAreaName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildPlaceNameIndex(places: Place[]): PlaceNameIndex {
  const byName = new Map<string, PlaceRef[]>();
  for (const place of places) {
    const key = normalizeAreaName(place.name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push({ psgc: place.psgc, level: place.level });
    byName.set(key, list);
  }
  return { byName };
}

let cachedIndex: PlaceNameIndex | null = null;

export function loadPlaceIndex(): PlaceNameIndex {
  if (cachedIndex) return cachedIndex;
  const raw = readFileSync(new URL('../../content/places.json', import.meta.url), 'utf8');
  const file = JSON.parse(raw) as PlacesFile;
  cachedIndex = buildPlaceNameIndex(file.items);
  return cachedIndex;
}

// Resolve one area name to a PSGC code, or null when unmatched/ambiguous.
export function lookupPlace(index: PlaceNameIndex, name: string): PlaceRef | null {
  const matches = index.byName.get(normalizeAreaName(name));
  if (!matches || matches.length === 0) return null;
  for (const level of LEVEL_PREFERENCE) {
    const atLevel = matches.filter((m) => m.level === level);
    if (atLevel.length === 1) return atLevel[0] ?? null;
    if (atLevel.length > 1) return null; // ambiguous at the chosen level
  }
  return null;
}

function fail<T>(code: ParseError, message: string): Result<T, ParseError> {
  return { ok: false, error: { code, message } };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "11:00 am, 05 November 2024" -> "2024-11-05T11:00:00+08:00". Null when unparseable.
export function parseIssueTime(text: string): string | null {
  const m = text.match(
    /(\d{1,2}):(\d{2})\s*(am|pm)\s*,?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i,
  );
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = (m[3] ?? '').toLowerCase();
  const day = Number(m[4]);
  const month = MONTHS[(m[5] ?? '').toLowerCase()];
  const year = Number(m[6]);
  if (!month || hour < 1 || hour > 12 || minute > 59 || day < 1 || day > 31 || year < 1900) return null;
  let h24 = hour % 12;
  if (ampm === 'pm') h24 += 12;
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(h24)}:${pad2(minute)}:00+08:00`;
}

// "Aug 07, 2026 08:00 PM" -> "2026-08-07T20:00:00+08:00". Null when unparseable.
export function parseForecastTime(text: string): string | null {
  const m = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  const word = (m[1] ?? '').toLowerCase();
  const month = MONTHS_SHORT[word.slice(0, 3)] ?? MONTHS[word];
  const day = Number(m[2]);
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const ampm = (m[6] ?? '').toLowerCase();
  if (!month || hour < 1 || hour > 12 || minute > 59 || day < 1 || day > 31) return null;
  let h24 = hour % 12;
  if (ampm === 'pm') h24 += 12;
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(h24)}:${pad2(minute)}:00+08:00`;
}

// A time written inside a panel heading, e.g. "Location of Center (4:00 AM)". Returns the 24h hour
// and minute, or null.
function timeInHeading(text: string): { hour: number; minute: number } | null {
  const m = text.match(/\(?\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*\)?/i);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = (m[3] ?? '').toLowerCase();
  if (hour < 1 || hour > 12 || minute > 59) return null;
  let h24 = hour % 12;
  if (ampm === 'pm') h24 += 12;
  return { hour: h24, minute };
}

// "16.4 °N, 127.1 °E" -> { lat, lon }. Requires N/S and E/W markers, so a bare pair of numbers is
// never taken as coordinates.
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const m = text.match(
    /(\d{1,3}(?:\.\d+)?)\s*(?:\u00b0)?\s*([NS])\s*[,;\s]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\u00b0)?\s*([EW])/i,
  );
  if (!m) return null;
  const latAbs = Number(m[1]);
  const lat = (m[2] ?? '').toUpperCase() === 'S' ? -latAbs : latAbs;
  const lonAbs = Number(m[3]);
  const lon = (m[4] ?? '').toUpperCase() === 'W' ? -lonAbs : lonAbs;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

// Categories from the storm label, most specific first.
const CATEGORY_PATTERNS: { word: string; category: StormCategory }[] = [
  { word: 'super typhoon', category: 'STY' },
  { word: 'severe tropical storm', category: 'STS' },
  { word: 'tropical storm', category: 'TS' },
  { word: 'tropical depression', category: 'TD' },
  { word: 'typhoon', category: 'TY' },
];

export function parseStormCategory(label: string): StormCategory | null {
  const lower = label.toLowerCase();
  for (const pattern of CATEGORY_PATTERNS) {
    if (lower.includes(pattern.word)) return pattern.category;
  }
  return null;
}

// Local storm name from the quoted part of a label, e.g. Typhoon "Marce" -> Marce.
export function parseStormName(label: string): string | null {
  const m = label.match(/["\u201c\u201d]([^"\u201c\u201d]+)["\u201c\u201d]/);
  const name = m?.[1]?.trim();
  return name && name.length > 0 ? name : null;
}

interface Panel {
  heading: string;
  body: string;
}

function findPanel(fragment: string, headingWord: string): Panel | null {
  const re = new RegExp(
    `<div[^>]*class="[^"]*panel-heading[^"]*"[^>]*>\\s*${headingWord}[\\s\\S]*?<\\/div>\\s*<div[^>]*class="[^"]*panel-body[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  );
  const m = fragment.match(re);
  if (!m) return null;
  const headMatch = fragment.slice(m.index ?? 0).match(/panel-heading[^>]*>\s*([\s\S]*?)<\/div>/i);
  return { heading: textOf(headMatch?.[1] ?? headingWord), body: m[1] ?? '' };
}

// Split a comma-separated list on top-level commas only (parenthetical commas stay together).
function splitTopLevelCommas(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function leafListItems(html: string): string[] {
  const out: string[] = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1] ?? '';
    if (/<ul/i.test(inner)) continue; // island-group wrapper, not a leaf
    const text = textOf(inner);
    if (text) out.push(text);
  }
  return out;
}

// The area strings named in one signal-level "Affected Areas" cell. Island-group wrappers
// (<strong>Luzon</strong><ul>...</ul>) are unwrapped; otherwise every leaf <li> is taken.
export function extractAreaStrings(cellHtml: string): string[] {
  const lists: string[] = [];
  const groupRe = /<strong>([^<]+)<\/strong>\s*<ul>([\s\S]*?)<\/ul>/gi;
  let m: RegExpExecArray | null;
  let sawGroup = false;
  while ((m = groupRe.exec(cellHtml)) !== null) {
    sawGroup = true;
    for (const item of leafListItems(m[2] ?? '')) lists.push(item);
  }
  if (!sawGroup) for (const item of leafListItems(cellHtml)) lists.push(item);
  return lists;
}

export interface SignalAreaMatch {
  level: TcwsLevel;
  psgc: string[];
  unmatched: string[]; // verbatim names with no PSGC match, never guessed
}

const SIGNAL_LEVELS: TcwsLevel[] = [1, 2, 3, 4, 5];

// Parse every "Tropical Cyclone Wind Signal no. N" block of a Wind Signal table.
export function parseSignalAreas(tableHtml: string, index: PlaceNameIndex): SignalAreaMatch[] {
  const marks: { level: TcwsLevel; at: number }[] = [];
  const re = /class="signalno([1-5])"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableHtml)) !== null) {
    const level = Number(m[1]) as TcwsLevel;
    if (SIGNAL_LEVELS.includes(level)) marks.push({ level, at: m.index });
  }
  const result: SignalAreaMatch[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark) continue;
    const end = marks[i + 1]?.at ?? tableHtml.length;
    const segment = tableHtml.slice(mark.at, end);
    const cell = segment.match(/Affected Areas[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    if (cell === undefined) continue;
    const psgc: string[] = [];
    const unmatched: string[] = [];
    for (const listText of extractAreaStrings(cell)) {
      for (const raw of splitTopLevelCommas(listText)) {
        const name = raw.replace(/\.$/, '').trim();
        if (!name) continue;
        const ref = lookupPlace(index, name);
        if (ref) {
          if (!psgc.includes(ref.psgc)) psgc.push(ref.psgc);
        } else if (!unmatched.includes(name)) {
          unmatched.push(name);
        }
      }
    }
    result.push({ level: mark.level, psgc, unmatched });
  }
  return result;
}

function slug(text: string): string {
  return normalizeAreaName(text).replace(/\s+/g, '-') || 'unknown';
}

// Split a page into one fragment per active bagyo tab.
export function extractStormFragments(html: string): string[] {
  const parts = html.split(/id="tcwb-\d+"/);
  parts.shift();
  return parts
    .map((part) => part.split('Tropical Cyclone Bulletin Archive')[0] ?? part)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function hasNoActiveCyclone(html: string): boolean {
  return /No Active Tropical Cyclone/i.test(html);
}

function parseStormFragment(
  fragment: string,
  meta: ScrapeMeta,
  index: PlaceNameIndex,
  pageTitle: string,
  bulletinNo: string | null,
): Result<BulletinRecord, ParseError> {
  const label = textOf(fragment.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
  const category = parseStormCategory(label);
  const name = parseStormName(label);
  if (!category) return fail('missing_field', 'storm category not found in the bulletin label');
  if (!name) return fail('missing_field', 'storm name not found in the bulletin label');

  const issuedText = fragment.match(/Issued at\s+([^<]+)/i)?.[1] ?? '';
  const issuedAt = parseIssueTime(issuedText);
  if (!issuedAt) {
    return fail(issuedText ? 'bad_time' : 'missing_field', `issued time not parsed from "${issuedText.trim()}"`);
  }
  if (Date.parse(issuedAt) > Date.parse(meta.scrapedAt)) {
    return fail('bad_time', `issued_at ${issuedAt} is in the future of scrapedAt ${meta.scrapedAt}`);
  }

  const positionPanel = findPanel(fragment, 'Location');
  if (!positionPanel) return fail('missing_field', 'Location panel not found');
  const positionText = textOf(positionPanel.body);
  const coords = parseCoordinates(positionText);
  if (!coords) return fail('bad_position', `no coordinates found in "${positionText}"`);
  const headingTime = timeInHeading(positionPanel.heading);
  const positionAt = headingTime
    ? `${issuedAt.slice(0, 10)}T${pad2(headingTime.hour)}:${pad2(headingTime.minute)}:00+08:00`
    : issuedAt;

  const movementPanel = findPanel(fragment, 'Movement');
  const movementText = movementPanel ? textOf(movementPanel.body) : '';

  const forecastPanel = findPanel(fragment, 'Forecast Position');
  const forecast: BulletinRecord['forecast'] = [];
  if (forecastPanel) {
    const itemRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRe.exec(forecastPanel.body)) !== null) {
      const itemText = textOf(itemMatch[1] ?? '');
      const at = parseForecastTime(itemText);
      const point = parseCoordinates(itemText);
      // Coordinates are only used when the page states them; a forecast line without them is
      // skipped rather than guessed.
      if (at && point) forecast.push({ lat: point.lat, lon: point.lon, at });
    }
  }

  const signalTable = fragment.match(/Wind Signal[\s\S]*?(<table[\s\S]*?<\/table>)/i)?.[1] ?? '';
  const signalMatches = signalTable ? parseSignalAreas(signalTable, index) : [];
  const unmatched = signalMatches.flatMap((s) => s.unmatched);
  if (unmatched.length > 0) {
    const list = unmatched.map((n) => `"${n}"`).join(', ');
    return fail('unknown_area', `signal area name(s) with no PSGC match: ${list}`);
  }
  const signalAreas = signalMatches.map((s) => ({ level: s.level, psgc: s.psgc }));

  const final = /final bulletin|last bulletin/i.test(textOf(fragment));

  const text = textOf(fragment);
  if (!text) return fail('missing_field', 'bulletin text is empty');

  const year = issuedAt.slice(0, 4);
  const stormId = `pagasa-${slug(name)}-${year}`;
  const id = bulletinNo ? `${stormId}-b${bulletinNo}` : `${stormId}-${issuedAt.replace(/[^0-9]/g, '').slice(0, 12)}`;

  const record: BulletinRecord = {
    id,
    storm_id: stormId,
    source: { agency: 'PAGASA', title: pageTitle, url: meta.sourceUrl },
    issued_at: issuedAt,
    scraped_at: meta.scrapedAt,
    storm: { name, category },
    position: { lat: coords.lat, lon: coords.lon, at: positionAt, text: positionText },
    forecast,
    signal_areas: signalAreas,
    final,
    text,
  };
  if (movementText) record.movement = { text: movementText };
  return { ok: true, value: record };
}

function pageMeta(html: string): { title: string; bulletinNo: string | null } {
  const header = textOf(html.match(/class="[^"]*article-header[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
  const title = header || 'PAGASA Tropical Cyclone Bulletin';
  const number = header.match(/#\s*(\d+)/)?.[1] ?? null;
  return { title, bulletinNo: number };
}

// Parse the newest bulletin of every active bagyo on the page, newest first. A page with no
// active bagyo returns an empty list.
export function parseBulletins(
  html: string,
  meta: ScrapeMeta,
  index: PlaceNameIndex = loadPlaceIndex(),
): Result<BulletinRecord[], ParseError> {
  const fragments = extractStormFragments(html);
  if (fragments.length === 0) {
    if (hasNoActiveCyclone(html)) return { ok: true, value: [] };
    return fail('layout_changed', 'no bulletin tab and no "No Active Tropical Cyclone" marker');
  }
  const { title, bulletinNo } = pageMeta(html);
  const records: BulletinRecord[] = [];
  for (const fragment of fragments) {
    const parsed = parseStormFragment(fragment, meta, index, title, bulletinNo);
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  records.sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));
  return { ok: true, value: records };
}

// Parse a single active bulletin (the first tab). Kept as the documented single-record entry point.
export function parseBulletin(
  html: string,
  meta: ScrapeMeta,
  index: PlaceNameIndex = loadPlaceIndex(),
): Result<BulletinRecord, ParseError> {
  const all = parseBulletins(html, meta, index);
  if (!all.ok) return all;
  const first = all.value[0];
  if (!first) return fail('layout_changed', 'no active bagyo on the page');
  return { ok: true, value: first };
}
