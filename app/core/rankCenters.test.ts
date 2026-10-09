import { describe, expect, it } from 'vitest';
import type {
  Bulletin,
  EvacuationCenter,
  HomePoint,
  LatLon,
  PhaseRules,
  StormMeasure,
  TcwsLevel,
} from '../types/index.ts';
import { rankCenters } from './rankCenters.ts';

const AT = '2026-10-10T08:00:00+08:00';

function center(overrides: Partial<EvacuationCenter> = {}): EvacuationCenter {
  return {
    id: 'sample-center-1',
    name: 'SAMPLE Evacuation Center 1',
    psgc: 'SAMPLE-PSGC-1',
    coords: { lat: 0, lon: 1 },
    origin: 'scraped',
    source_id: 'src-ndrrmc-sample',
    reviewed_by: 'SAMPLE Reviewer',
    reviewed_at: '2026-10-09',
    updated_at: '2026-10-09T00:00:00+08:00',
    ...overrides,
  };
}

function home(point: LatLon = { lat: 0, lon: 0 }): HomePoint {
  return { point, from: 'area', areaCodes: [] };
}

function bulletin(overrides: Partial<Bulletin> = {}): Bulletin {
  return {
    id: 'sample-bulletin-1',
    stormId: 'sample-storm-1',
    source: {
      agency: 'PAGASA',
      title: 'SAMPLE – hindi totoong bulletin',
      url: 'https://example.invalid/sample-bulletin',
    },
    issuedAt: AT,
    scrapedAt: AT,
    fetchedAt: AT,
    storm: { name: 'Bagyong SAMPLE', category: 'TS' },
    position: { lat: 0, lon: 1, at: AT, text: 'SAMPLE – hindi totoong posisyon' },
    forecast: [],
    signalAreas: [],
    final: false,
    text: 'SAMPLE – hindi totoong bulletin',
    ...overrides,
  };
}

function storm(signalHere: TcwsLevel | null): StormMeasure {
  return {
    bulletinId: 'sample-bulletin-1',
    from: 'area',
    now: { at: AT, distanceKm: 1, bearingDeg: 90, direction: 'E' },
    forecast: [],
    closestKm: 1,
    signalHere,
  };
}

type Threshold = PhaseRules['evacuation_threshold'];

function rules(threshold: Partial<Threshold> = {}): PhaseRules {
  return {
    warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
    bands: {
      near: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
      approach: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
    },
    evacuation_threshold: {
      category_min: null,
      tcws_min: null,
      placeholder: true,
      source_id: null,
      reviewed_by: null,
      reviewed_at: null,
      ...threshold,
    },
  };
}

function opts(
  overrides: Partial<Parameters<typeof rankCenters>[2]> = {},
): Parameters<typeof rankCenters>[2] {
  return { bulletin: null, storm: null, rules: rules(), limit: 5, ...overrides };
}

describe('rankCenters ordering', () => {
  it('sorts nearest first by haversine distance', () => {
    const result = rankCenters(
      [
        center({ id: 'far', coords: { lat: 0, lon: 2 } }),
        center({ id: 'near', coords: { lat: 0, lon: 1 } }),
        center({ id: 'mid', coords: { lat: 0, lon: 1.5 } }),
      ],
      home(),
      opts(),
    );
    expect(result.items.map((i) => i.center.id)).toEqual(['near', 'mid', 'far']);
    expect(result.items.map((i) => i.distanceKm)).toEqual([111, 167, 222]);
  });

  it('reports the compass direction from home to the center', () => {
    const result = rankCenters([center({ coords: { lat: 0, lon: 1 } })], home(), opts());
    expect(result.items[0]?.direction).toBe('E');
  });

  it('breaks equal distances by name, then by id', () => {
    const result = rankCenters(
      [
        center({ id: 'c-b', name: 'Bravo', coords: { lat: 0, lon: 1 } }),
        center({ id: 'c-a2', name: 'Alpha', coords: { lat: 0, lon: 1 } }),
        center({ id: 'c-a', name: 'Alpha', coords: { lat: 0, lon: 1 } }),
      ],
      home(),
      opts(),
    );
    expect(result.items.map((i) => i.center.id)).toEqual(['c-a', 'c-a2', 'c-b']);
  });

  it('caps the list at the limit without dropping the nearest', () => {
    const result = rankCenters(
      [
        center({ id: 'far', coords: { lat: 0, lon: 3 } }),
        center({ id: 'mid', coords: { lat: 0, lon: 2 } }),
        center({ id: 'near', coords: { lat: 0, lon: 1 } }),
      ],
      home(),
      opts({ limit: 2 }),
    );
    expect(result.items.map((i) => i.center.id)).toEqual(['near', 'mid']);
  });
});

describe('rankCenters exclusion', () => {
  it('skips centers without a reviewer and review date', () => {
    const result = rankCenters(
      [
        center({ id: 'kept' }),
        center({ id: 'no-reviewer', reviewed_by: '' }),
        center({ id: 'no-review-date', reviewed_at: '' }),
      ],
      home(),
      opts(),
    );
    expect(result.items.map((i) => i.center.id)).toEqual(['kept']);
  });

  it('skips centers without usable coordinates', () => {
    const missing = { ...center({ id: 'no-coords' }), coords: undefined } as unknown as EvacuationCenter;
    const result = rankCenters([missing, center({ id: 'kept' })], home(), opts());
    expect(result.items.map((i) => i.center.id)).toEqual(['kept']);
  });
});

describe('rankCenters centersFirst', () => {
  it('never promotes the list while the threshold is a placeholder', () => {
    const result = rankCenters(
      [center()],
      home(),
      opts({
        bulletin: bulletin({ storm: { name: 'Bagyong SAMPLE', category: 'STY' } }),
        storm: storm(5),
        rules: rules(),
      }),
    );
    expect(result.centersFirst).toBe(false);
  });

  it('promotes the list when the bulletin category is at or above a sourced category_min', () => {
    const sourced = rules({
      placeholder: false,
      category_min: 'TY',
      source_id: 'src-pagasa-sample',
      reviewed_by: 'SAMPLE Reviewer',
      reviewed_at: '2026-10-09',
    });
    const atOrAbove = rankCenters(
      [center()],
      home(),
      opts({ bulletin: bulletin({ storm: { name: 'Bagyong SAMPLE', category: 'TY' } }), rules: sourced }),
    );
    const below = rankCenters(
      [center()],
      home(),
      opts({ bulletin: bulletin({ storm: { name: 'Bagyong SAMPLE', category: 'TS' } }), rules: sourced }),
    );
    expect(atOrAbove.centersFirst).toBe(true);
    expect(below.centersFirst).toBe(false);
  });

  it('promotes the list when the household signal is at or above a sourced tcws_min', () => {
    const sourced = rules({
      placeholder: false,
      tcws_min: 2,
      source_id: 'src-pagasa-sample',
      reviewed_by: 'SAMPLE Reviewer',
      reviewed_at: '2026-10-09',
    });
    const atOrAbove = rankCenters([center()], home(), opts({ storm: storm(2), rules: sourced }));
    const below = rankCenters([center()], home(), opts({ storm: storm(1), rules: sourced }));
    const noSignal = rankCenters([center()], home(), opts({ storm: storm(null), rules: sourced }));
    expect(atOrAbove.centersFirst).toBe(true);
    expect(below.centersFirst).toBe(false);
    expect(noSignal.centersFirst).toBe(false);
  });
});
