import type {
  Bulletin,
  EvacuationCenter,
  HomePoint,
  PhaseRules,
  RankedCenter,
  RankedCenters,
  StormCategory,
  StormMeasure,
} from '../types/index.ts';
import { compassPointFromBearing, haversineKm, initialBearingDeg } from './measureStorm.ts';

// PAGASA categories, weakest first; index order is the comparison order.
const CATEGORY_ORDER: readonly StormCategory[] = ['TD', 'TS', 'STS', 'TY', 'STY'];

function reviewed(center: EvacuationCenter): boolean {
  return center.reviewed_by !== '' && center.reviewed_at !== '';
}

function hasCoords(center: EvacuationCenter): boolean {
  const coords = center.coords as { lat: number; lon: number } | null | undefined;
  return coords != null && Number.isFinite(coords.lat) && Number.isFinite(coords.lon);
}

function byNameThenId(a: RankedCenter, b: RankedCenter): number {
  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  if (a.center.name !== b.center.name) return a.center.name < b.center.name ? -1 : 1;
  if (a.center.id !== b.center.id) return a.center.id < b.center.id ? -1 : 1;
  return 0;
}

function crossThreshold(
  rules: PhaseRules,
  bulletin: Bulletin | null,
  storm: StormMeasure | null,
): boolean {
  const threshold = rules.evacuation_threshold;
  // A placeholder threshold is never crossed: no number is invented in code.
  if (threshold.placeholder) return false;

  const categoryCrossed =
    threshold.category_min !== null &&
    bulletin !== null &&
    CATEGORY_ORDER.indexOf(bulletin.storm.category) >= CATEGORY_ORDER.indexOf(threshold.category_min);

  const signalHere = storm?.signalHere ?? null;
  const signalCrossed =
    threshold.tcws_min !== null && signalHere !== null && signalHere >= threshold.tcws_min;

  return categoryCrossed || signalCrossed;
}

export function rankCenters(
  centers: EvacuationCenter[],
  home: HomePoint,
  opts: { bulletin: Bulletin | null; storm: StormMeasure | null; rules: PhaseRules; limit: number },
): RankedCenters {
  const items: RankedCenter[] = [];
  for (const center of centers) {
    if (!reviewed(center) || !hasCoords(center)) continue;
    const bearingDeg = initialBearingDeg(home.point, center.coords);
    items.push({
      center,
      distanceKm: Math.round(haversineKm(home.point, center.coords)),
      direction: compassPointFromBearing(bearingDeg),
    });
  }

  items.sort(byNameThenId);

  return {
    items: items.slice(0, Math.max(0, opts.limit)),
    centersFirst: crossThreshold(opts.rules, opts.bulletin, opts.storm),
  };
}
