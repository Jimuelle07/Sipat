import { describe, expect, it } from 'vitest';
import type { Bulletin, HomePoint, LatLon } from '../types/index.ts';
import { compassPointFromBearing, haversineKm, measureStorm } from './measureStorm.ts';

const AT = '2026-10-10T08:00:00+08:00';
const DEG_TO_KM_AT_EQUATOR = 6371 * (Math.PI / 180); // 111.1949..., hand-computed

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

function home(
  point: LatLon,
  areaCodes: string[] = [],
  from: HomePoint['from'] = 'area',
): HomePoint {
  return { point, from, areaCodes };
}

describe('measureStorm distance and bearing', () => {
  it('measures a known 1° equatorial distance against the hand-computed haversine value', () => {
    const m = measureStorm(bulletin(), home({ lat: 0, lon: 0 }));
    expect(m.bulletinId).toBe('sample-bulletin-1');
    expect(m.from).toBe('area');
    expect(m.now.at).toBe(AT);
    expect(m.now.distanceKm).toBeCloseTo(DEG_TO_KM_AT_EQUATOR, 0);
    expect(m.now.direction).toBe('E');
    expect(m.now.bearingDeg).toBeCloseTo(90, 5);
  });

  it('measures 10° due north as 1112 km toward N', () => {
    const m = measureStorm(
      bulletin({ position: { lat: 10, lon: 0, at: AT, text: 'SAMPLE' } }),
      home({ lat: 0, lon: 0 }),
    );
    expect(m.now.distanceKm).toBeCloseTo(1111.949, 0);
    expect(m.now.direction).toBe('N');
    expect(m.now.bearingDeg).toBeCloseTo(0, 5);
  });

  it('maps a 1° north-east hop to NE', () => {
    const m = measureStorm(
      bulletin({ position: { lat: 1, lon: 1, at: AT, text: 'SAMPLE' } }),
      home({ lat: 0, lon: 0 }),
    );
    expect(m.now.distanceKm).toBeCloseTo(157.24, 0);
    expect(m.now.direction).toBe('NE');
  });

  it('passes the home source through unchanged', () => {
    const m = measureStorm(bulletin(), home({ lat: 0, lon: 0 }, [], 'gps'));
    expect(m.from).toBe('gps');
  });
});

describe('measureStorm forecast and closestKm', () => {
  it('keeps forecast order and picks the smallest distance', () => {
    const m = measureStorm(
      bulletin({
        position: { lat: 0, lon: 2, at: AT, text: 'SAMPLE' },
        forecast: [
          { lat: 0, lon: 0.5, at: '2026-10-11T08:00:00+08:00' },
          { lat: 0, lon: 1, at: '2026-10-12T08:00:00+08:00' },
        ],
      }),
      home({ lat: 0, lon: 0 }),
    );
    expect(m.now.distanceKm).toBe(222);
    expect(m.forecast.map((f) => f.distanceKm)).toEqual([56, 111]);
    expect(m.forecast.map((f) => f.at)).toEqual(['2026-10-11T08:00:00+08:00', '2026-10-12T08:00:00+08:00']);
    expect(m.closestKm).toBe(56);
  });

  it('falls back to now when the forecast is empty', () => {
    const m = measureStorm(
      bulletin({ position: { lat: 0, lon: 3, at: AT, text: 'SAMPLE' } }),
      home({ lat: 0, lon: 0 }),
    );
    expect(m.forecast).toEqual([]);
    expect(m.closestKm).toBe(m.now.distanceKm);
    expect(m.closestKm).toBe(334);
  });
});

describe('measureStorm signalHere', () => {
  const areaCodes = ['SAMPLE-BRGY-1', 'SAMPLE-CITY-1', 'SAMPLE-PROVINCE-1'];

  it('returns the highest level whose PSGC list covers any home area code', () => {
    const m = measureStorm(
      bulletin({
        signalAreas: [
          { level: 1, psgc: ['SAMPLE-PROVINCE-9'] },
          { level: 3, psgc: ['SAMPLE-CITY-1'] },
          { level: 2, psgc: ['SAMPLE-BRGY-X'] },
        ],
      }),
      home({ lat: 0, lon: 0 }, areaCodes),
    );
    expect(m.signalHere).toBe(3);
  });

  it('counts a signal raised for the whole province', () => {
    const m = measureStorm(
      bulletin({ signalAreas: [{ level: 2, psgc: ['SAMPLE-PROVINCE-1'] }] }),
      home({ lat: 0, lon: 0 }, areaCodes),
    );
    expect(m.signalHere).toBe(2);
  });

  it('returns null when no area covers the home', () => {
    const m = measureStorm(
      bulletin({ signalAreas: [{ level: 4, psgc: ['SAMPLE-PROVINCE-9'] }] }),
      home({ lat: 0, lon: 0 }, areaCodes),
    );
    expect(m.signalHere).toBeNull();
  });
});

describe('geo helpers', () => {
  it('haversine is zero for the same point and symmetric', () => {
    const a = { lat: 14.6, lon: 120.98 };
    expect(haversineKm(a, a)).toBe(0);
    const b = { lat: 16.0, lon: 122.0 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });

  it('maps cardinal bearings to compass points', () => {
    expect(compassPointFromBearing(0)).toBe('N');
    expect(compassPointFromBearing(90)).toBe('E');
    expect(compassPointFromBearing(180)).toBe('S');
    expect(compassPointFromBearing(270)).toBe('W');
    expect(compassPointFromBearing(359)).toBe('N');
  });
});
