// Placeholder fixture data for the mock engine and tests. Not official content.
import type {
  Bulletin,
  BulletinCardView,
  CompassPoint,
  EvacuationCenter,
  FeedState,
  PhaseRules,
  StormFix,
  StormMeasure,
} from '../../types/index.ts';

const AT = '2026-10-10T06:00:00+08:00';
const FETCHED_AT = '2026-10-10T06:30:00+08:00';
const CHECKED_AT = '2026-10-10T06:31:00+08:00';

// Fixture distances only. They are not real-world bands or thresholds; the demo rules below are
// derived from these numbers so the phase rules can be exercised "as if bands were sourced".
const SAMPLE_NOW_KM = 320;
const SAMPLE_FORECAST_KM = 300;
const NEAR_KM = 120;
const APPROACH_KM = 200;

function sampleBulletin(): Bulletin {
  return {
    id: 'sample-bulletin-1',
    stormId: 'sample-storm-1',
    source: {
      agency: 'PAGASA',
      title: 'SAMPLE – hindi totoong bulletin',
      url: 'https://example.invalid/sample-bulletin',
    },
    issuedAt: AT,
    scrapedAt: '2026-10-10T06:10:00+08:00',
    fetchedAt: FETCHED_AT,
    storm: { name: 'Bagyong SAMPLE', category: 'TS' },
    position: { lat: 14.0, lon: 124.0, at: AT, text: 'SAMPLE – hindi totoong posisyon' },
    movement: { text: 'SAMPLE – gumagalaw pahilaga-kanluran (placeholder)' },
    forecast: [{ lat: 14.5, lon: 123.5, at: '2026-10-11T06:00:00+08:00' }],
    signalAreas: [{ level: 1, psgc: ['SAMPLE-PROVINCE-1'] }],
    final: false,
    text: 'SAMPLE – hindi totoong bulletin',
  };
}

export const FIXTURE_BULLETIN: Bulletin = sampleBulletin();

export const FIXTURE_CENTERS: EvacuationCenter[] = [
  {
    id: 'center-sample-1',
    name: 'SAMPLE Evacuation Center One (placeholder)',
    psgc: 'SAMPLE-BRGY-1',
    coords: { lat: 14.011, lon: 122.011 },
    landmark: 'SAMPLE – malapit sa barangay hall (placeholder)',
    origin: 'scraped',
    source_id: 'src-ndrrmc-sample',
    reviewed_by: 'SAMPLE Reviewer A',
    reviewed_at: '2026-10-09',
    updated_at: '2026-10-09T00:00:00+08:00',
  },
  {
    id: 'center-sample-2',
    name: 'SAMPLE Evacuation Center Two (placeholder)',
    psgc: 'SAMPLE-BRGY-2',
    coords: { lat: 14.021, lon: 122.021 },
    landmark: 'SAMPLE – malapit sa paaralan (placeholder)',
    origin: 'scraped',
    source_id: 'src-ndrrmc-sample',
    reviewed_by: 'SAMPLE Reviewer A',
    reviewed_at: '2026-10-09',
    updated_at: '2026-10-09T00:00:00+08:00',
  },
  {
    id: 'center-sample-3',
    name: 'SAMPLE Evacuation Center Three (placeholder)',
    psgc: 'SAMPLE-BRGY-2',
    coords: { lat: 14.031, lon: 122.031 },
    landmark: 'SAMPLE – malapit sa simbahan (placeholder)',
    origin: 'lgu',
    source_id: 'src-ndrrmc-sample',
    reviewed_by: 'SAMPLE Reviewer B',
    reviewed_at: '2026-10-09',
    updated_at: '2026-10-09T00:00:00+08:00',
  },
];

export type FeedVariant = 'near' | 'signal_here' | 'track_approach' | 'left';

function fix(distanceKm: number, direction: CompassPoint = 'N'): StormFix {
  return { at: AT, distanceKm, bearingDeg: 0, direction };
}

function baseMeasure(): StormMeasure {
  return {
    bulletinId: FIXTURE_BULLETIN.id,
    from: 'area',
    now: fix(SAMPLE_NOW_KM),
    forecast: [fix(SAMPLE_FORECAST_KM)],
    closestKm: SAMPLE_FORECAST_KM,
    signalHere: null,
  };
}

/**
 * The sample bulletin and its measure, one variant per automatic-switch case. No arg gives the
 * sample bulletin and its base measure. Each variant changes only what its case needs.
 */
export function fixtureStorm(variant?: FeedVariant): { bulletin: Bulletin; measure: StormMeasure } {
  const bulletin = sampleBulletin();
  const measure = baseMeasure();
  switch (variant) {
    case 'near':
      measure.now = fix(NEAR_KM);
      measure.closestKm = NEAR_KM;
      break;
    case 'signal_here':
      measure.signalHere = 2;
      break;
    case 'track_approach':
      measure.forecast = [fix(APPROACH_KM)];
      measure.closestKm = APPROACH_KM;
      break;
    case 'left':
      bulletin.final = true;
      measure.now = fix(SAMPLE_NOW_KM + 80);
      measure.closestKm = SAMPLE_NOW_KM + 80;
      break;
    default:
      break;
  }
  return { bulletin, measure };
}

/**
 * Mock-only phase rules whose bands are derived from the fixture measures above, so no real-world
 * number appears. `placeholder: false` lets debug.setFeed(variant) run the phase rules as if the
 * bands were sourced and show the automatic switch.
 */
export const DEMO_SOURCED_RULES: PhaseRules = {
  warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
  bands: {
    near: {
      max_km: NEAR_KM,
      placeholder: false,
      source_id: 'src-pagasa-sample',
      reviewed_by: 'SAMPLE Reviewer B',
      reviewed_at: '2026-10-09',
    },
    approach: {
      max_km: APPROACH_KM,
      placeholder: false,
      source_id: 'src-pagasa-sample',
      reviewed_by: 'SAMPLE Reviewer B',
      reviewed_at: '2026-10-09',
    },
  },
  evacuation_threshold: {
    category_min: null,
    tcws_min: null,
    placeholder: true,
    source_id: null,
    reviewed_by: null,
    reviewed_at: null,
  },
};

function card(bulletin: Bulletin, stale: boolean): BulletinCardView {
  return {
    bulletin,
    issuedHoursAgo: stale ? 6 : 1,
    fetchedHoursAgo: stale ? 6 : 1,
    stale,
    ageText: `SAMPLE – inilabas ${bulletin.issuedAt}, na-download ${bulletin.fetchedAt} (placeholder)`,
  };
}

export function fixtureFeedState(kind: 'off' | 'empty' | 'fresh' | 'stale'): FeedState {
  switch (kind) {
    case 'off':
      return { status: 'off', refreshing: false, latest: null, serverStale: false };
    case 'empty':
      return { status: 'empty', refreshing: false, latest: null, serverStale: false };
    case 'fresh':
      return {
        status: 'fresh',
        refreshing: false,
        latest: card(sampleBulletin(), false),
        fetchedAt: FETCHED_AT,
        checkedAt: CHECKED_AT,
        serverStale: false,
      };
    case 'stale':
      return {
        status: 'stale',
        refreshing: false,
        latest: card(sampleBulletin(), true),
        fetchedAt: FETCHED_AT,
        checkedAt: CHECKED_AT,
        serverStale: true,
      };
  }
}
