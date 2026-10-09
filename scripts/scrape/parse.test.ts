import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPlaceNameIndex,
  hasNoActiveCyclone,
  lookupPlace,
  parseBulletin,
  parseBulletins,
  parseIssueTime,
  parseSignalAreas,
  type PlaceNameIndex,
  type ScrapeMeta,
} from './parse.ts';
import type { Place } from '../../app/types/index.ts';

const NO_ACTIVE = readFileSync(new URL('./fixtures/swb-no-active.html', import.meta.url), 'utf8');
const ACTIVE = readFileSync(new URL('./fixtures/swb-sample-active.html', import.meta.url), 'utf8');

const META: ScrapeMeta = {
  sourceUrl: 'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin',
  scrapedAt: '2026-08-07T05:30:00+08:00',
};

function withEdit(html: string, from: string, to: string): string {
  expect(html).toContain(from);
  return html.replace(from, to);
}

describe('PAGASA page with no active bagyo', () => {
  it('is detected', () => {
    expect(hasNoActiveCyclone(NO_ACTIVE)).toBe(true);
  });

  it('parses to an empty list', () => {
    const result = parseBulletins(NO_ACTIVE, META);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('PAGASA active bulletin page', () => {
  it('parses the sample bulletin into a BulletinRecord', () => {
    const result = parseBulletins(ACTIVE, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    const record = result.value[0];
    if (!record) throw new Error('missing record');

    expect(record.id).toBe('pagasa-sample-2026-b3');
    expect(record.storm_id).toBe('pagasa-sample-2026');
    expect(record.source).toEqual({
      agency: 'PAGASA',
      title: 'Tropical Cyclone Bulletin #3',
      url: META.sourceUrl,
    });
    expect(record.issued_at).toBe('2026-08-07T05:00:00+08:00');
    expect(record.scraped_at).toBe(META.scrapedAt);
    expect(record.storm.name).toBe('SAMPLE');
    expect(record.storm.category).toBe('TY');

    expect(record.position.lat).toBe(14);
    expect(record.position.lon).toBe(126);
    expect(record.position.at).toBe(record.issued_at); // no time in the panel heading
    expect(record.position.text).toContain('14.0');

    expect(record.movement?.text).toContain('West Northwestward');

    // Only the forecast line that states coordinates is kept, and never guessed.
    expect(record.forecast).toEqual([{ lat: 14.5, lon: 125.5, at: '2026-08-07T20:00:00+08:00' }]);

    expect(record.final).toBe(false);
    expect(record.text.length).toBeGreaterThan(0);
    expect(record.text).toContain('SAMPLE');
  });

  it('maps wind-signal areas to PSGC codes', () => {
    const result = parseBulletin(ACTIVE, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byLevel = new Map(result.value.signal_areas.map((area) => [area.level, area.psgc]));
    expect(byLevel.get(1)).toEqual(
      expect.arrayContaining([
        '020900000', // Batanes
        '021500000', // Cagayan (province, not the barangay)
        '023100000', // Isabela (province, not the municipality)
        '025000000', // Nueva Vizcaya
        '025700000', // Quirino (province)
        '037700000', // Aurora (province)
      ]),
    );
    expect(byLevel.get(2)).toEqual(expect.arrayContaining(['012800000', '148100000']));
    expect(byLevel.get(1)).toHaveLength(6);
    expect(byLevel.get(2)).toHaveLength(2);
  });

  it('returns an error, not a guess, when a required field is missing', () => {
    const withoutPosition = withEdit(
      ACTIVE,
      '<div class="panel-heading">Location of Eye/center</div>',
      '<div class="panel-heading">Eye/center</div>',
    );
    const result = parseBulletin(withoutPosition, META);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('missing_field');
  });

  it('returns bad_position when coordinates are absent', () => {
    const withoutCoords = withEdit(
      ACTIVE,
      '300 km East of SAMPLE (14.0 &deg;N, 126.0 &deg;E )',
      '300 km East of SAMPLE',
    );
    const result = parseBulletin(withoutCoords, META);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bad_position');
  });

  it('returns bad_time when the issued time cannot be parsed', () => {
    const badTime = withEdit(ACTIVE, 'Issued at 5:00 am, 07 August 2026', 'Issued at some time');
    const result = parseBulletin(badTime, META);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('bad_time');
  });

  it('keeps an unmatched area name verbatim and fails with unknown_area', () => {
    const unknown = withEdit(
      ACTIVE,
      'Batanes, Cagayan, Isabela, Nueva Vizcaya, Quirino, Aurora',
      'Batanes, Cagayan, Isabela, Nueva Vizcaya, Atlantis, Aurora',
    );
    const result = parseBulletin(unknown, META);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown_area');
      expect(result.error.message).toContain('"Atlantis"');
    }
  });
});

describe('signal-area matching', () => {
  const places: Place[] = [
    { psgc: '021500000', name: 'Cagayan', level: 'province', parent: '020000000' },
    { psgc: '071224011', name: 'Cagayan', level: 'barangay', parent: '071224000' },
    { psgc: '023100000', name: 'Isabela', level: 'province', parent: '020000000' },
    { psgc: '064514000', name: 'Isabela', level: 'municipality', parent: '060450000' },
    { psgc: '099999001', name: 'Ambiguous', level: 'province', parent: '090000000' },
    { psgc: '099999002', name: 'Ambiguous', level: 'province', parent: '090000000' },
  ];
  const index: PlaceNameIndex = buildPlaceNameIndex(places);

  it('prefers the higher administrative level', () => {
    expect(lookupPlace(index, 'cagayan')?.psgc).toBe('021500000');
    expect(lookupPlace(index, 'ISABELA')?.psgc).toBe('023100000');
  });

  it('leaves ambiguous and unknown names unmatched', () => {
    expect(lookupPlace(index, 'Ambiguous')).toBeNull();
    expect(lookupPlace(index, 'Atlantis')).toBeNull();
  });

  it('keeps unmatched names verbatim in the per-level result', () => {
    const table = `
      <thead><tr><th colspan="2" class="signalno1">Tropical Cyclone Wind Signal no. 1</th></tr></thead>
      <tbody><tr>
        <td><strong>Affected Areas</strong></td>
        <td><ul><li><strong>Luzon</strong><ul><li>Cagayan, Atlantis</li></ul></li></ul></td>
      </tr></tbody>`;
    const parsed = parseSignalAreas(table, index);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.psgc).toEqual(['021500000']);
    expect(parsed[0]?.unmatched).toEqual(['Atlantis']);
  });
});

describe('time helpers', () => {
  it('parses issue times with +08:00', () => {
    expect(parseIssueTime('Issued at 11:00 am, 05 November 2024')).toBe('2024-11-05T11:00:00+08:00');
    expect(parseIssueTime('12:30 am, 1 January 2026')).toBe('2026-01-01T00:30:00+08:00');
    expect(parseIssueTime('nonsense')).toBeNull();
  });
});
