import type {
  Bulletin,
  CompassPoint,
  HomePoint,
  LatLon,
  StormFix,
  StormMeasure,
  TcwsLevel,
} from '../types/index.ts';

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;
const COMPASS: readonly CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Great-circle (haversine) distance on a sphere of mean Earth radius 6,371 km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b, in degrees clockwise from north [0, 360). */
export function initialBearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Nearest of the 8 compass points, each covering a 45° sector centred on N. */
export function compassPointFromBearing(bearingDeg: number): CompassPoint {
  const index = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index] ?? 'N';
}

function fix(home: LatLon, target: LatLon & { at: string }): StormFix {
  const bearingDeg = initialBearingDeg(home, target);
  return {
    at: target.at,
    distanceKm: Math.round(haversineKm(home, target)),
    bearingDeg,
    direction: compassPointFromBearing(bearingDeg),
  };
}

function highestSignal(areas: Bulletin['signalAreas'], areaCodes: string[]): TcwsLevel | null {
  let best: TcwsLevel | null = null;
  for (const area of areas) {
    if (!area.psgc.some((code) => areaCodes.includes(code))) continue;
    if (best === null || area.level > best) best = area.level;
  }
  return best;
}

export function measureStorm(bulletin: Bulletin, home: HomePoint): StormMeasure {
  const now = fix(home.point, bulletin.position);
  const forecast = bulletin.forecast.map((p) => fix(home.point, p));
  const closestKm = forecast.reduce((min, f) => Math.min(min, f.distanceKm), now.distanceKm);
  return {
    bulletinId: bulletin.id,
    from: home.from,
    now,
    forecast,
    closestKm,
    signalHere: highestSignal(bulletin.signalAreas, home.areaCodes),
  };
}
