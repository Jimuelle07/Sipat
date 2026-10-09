// Placeholder fixture data for the mock engine and tests. Not official content.
import type {
  Bulletin,
  BulletinCardView,
  EvacuationCenter,
  FeedState,
  HomePoint,
  PhaseRules,
  StormMeasure,
} from '../../types/index.ts';
import { measureStorm } from '../../core/measureStorm.ts';
import { FIXTURE_PLACES } from './content.ts';

const AT = '2026-10-10T06:00:00+08:00';
const FETCHED_AT = '2026-10-10T06:30:00+08:00';
const CHECKED_AT = '2026-10-10T06:31:00+08:00';
const FORECAST_AT = '2026-10-11T06:00:00+08:00';

// The fixture household lives in SAMPLE-BRGY-1. This mirrors the engine's homePoint() for that
// location: the barangay centroid with its ancestor PSGC codes. Every sample bulletin is measured
// against it with the real measureStorm(), so the mock's precomputed measures and the real engine
// agree.
function fixtureHome(): HomePoint {
  const items = FIXTURE_PLACES.items;
  const start = items.find((place) => place.psgc === 'SAMPLE-BRGY-1');
  const areaCodes: string[] = [];
  let place = start;
  const seen = new Set<string>();
  while (place && !seen.has(place.psgc)) {
    areaCodes.push(place.psgc);
    seen.add(place.psgc);
    place = items.find((item) => item.psgc === place?.parent);
  }
  return { point: start?.centroid ?? { lat: 14.01, lon: 122.01 }, from: 'area', areaCodes };
}

const FIXTURE_HOME = fixtureHome();

// SAMPLE-PROVINCE-2 is not an ancestor of SAMPLE-BRGY-1, so a signal raised there never reaches
// the fixture household. Only 'signal_here' raises a signal for the household's own province.
const OTHER_PROVINCE = 'SAMPLE-PROVINCE-2';
const HOME_PROVINCE = 'SAMPLE-PROVINCE-1';

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
    forecast: [{ lat: 14.5, lon: 123.5, at: FORECAST_AT }],
    signalAreas: [{ level: 1, psgc: [OTHER_PROVINCE] }],
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

/**
 * The sample bulletin for one automatic-switch case. Only what the case needs changes: position
 * for 'near', forecast for 'track_approach', the final flag for 'left' and the signal area for
 * 'signal_here'. Every other variant keeps the far sample track and the other province's signal.
 */
function variantBulletin(variant?: FeedVariant): Bulletin {
  const bulletin = sampleBulletin();
  switch (variant) {
    case 'near':
      bulletin.position = { ...bulletin.position, lat: 14.05, lon: 122.2 };
      break;
    case 'signal_here':
      bulletin.signalAreas = [{ level: 2, psgc: [HOME_PROVINCE] }];
      break;
    case 'track_approach':
      bulletin.forecast = [{ lat: 14.11, lon: 122.2, at: FORECAST_AT }];
      break;
    case 'left':
      bulletin.final = true;
      break;
    default:
      break;
  }
  return bulletin;
}

/**
 * The sample bulletin and its measure, one variant per automatic-switch case. No arg gives the
 * sample bulletin and its base measure. The measure is always what measureStorm() computes for the
 * fixture home, so the mock and the real engine read the same numbers.
 */
export function fixtureStorm(variant?: FeedVariant): { bulletin: Bulletin; measure: StormMeasure } {
  const bulletin = variantBulletin(variant);
  return { bulletin, measure: measureStorm(bulletin, FIXTURE_HOME) };
}

// Bands derived from the fixture measures above, so no real-world number appears.
const NEAR_MAX_KM = fixtureStorm('near').measure.now.distanceKm;
const APPROACH_MAX_KM = fixtureStorm('track_approach').measure.closestKm;

/**
 * Mock-only phase rules whose bands are derived from the fixture measures above, so no real-world
 * number appears. `placeholder: false` lets debug.setFeed(variant) run the phase rules as if the
 * bands were sourced and show the automatic switch.
 */
export const DEMO_SOURCED_RULES: PhaseRules = {
  warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
  bands: {
    near: {
      max_km: NEAR_MAX_KM,
      placeholder: false,
      source_id: 'src-pagasa-sample',
      reviewed_by: 'SAMPLE Reviewer B',
      reviewed_at: '2026-10-09',
    },
    approach: {
      max_km: APPROACH_MAX_KM,
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
