import type { BulletinCardView, CopyKey, StormMeasure, UiLanguage } from '../../../engine';
import type { TrackPoint } from '../../components/StormTrack';
import type { stormStrings } from '../../strings/storm';
import { fill } from '../../strings/format';

type StormCopy = Record<keyof typeof stormStrings.tl, string>;
type CopyFn = (key: CopyKey, opts?: { lang?: UiLanguage; vars?: Record<string, string> }) => string;

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * "Okt 10, 2:00 PM" (or "2:00 PM" with `timeOnly`) from an ISO 8601 time. Reads the wall-clock
 * part as written, so a `+08:00` time shows Manila time on any phone. Anything unparseable is
 * shown as-is.
 */
export function clockText(iso: string, t: Pick<StormCopy, 'month_names'>, timeOnly = false): string {
  const match = ISO_LOCAL.exec(iso);
  if (!match) return iso;
  const [, , month, day, hour, minute] = match;
  const h = Number(hour);
  const time = `${h % 12 === 0 ? 12 : h % 12}:${minute} ${h < 12 ? 'AM' : 'PM'}`;
  if (timeOnly) return time;
  const months = t.month_names.split(' ');
  return `${months[Number(month) - 1] ?? month} ${Number(day)}, ${time}`;
}

/** Whole kilometres, as the engine measures them; under 1 km reads "< 1" rather than "0". */
export function kmText(km: number): string {
  return km < 1 ? '< 1' : String(Math.round(km));
}

/**
 * The bulletin as label/value rows, rendered verbatim from data. Signal areas are named from
 * `places` (PSGC → name, from `family.location.places()`); an unknown code shows as the code.
 */
export function bulletinLines(view: BulletinCardView, t: StormCopy, places: ReadonlyMap<string, string>): { label: string; value: string }[] {
  const { storm, position, movement, signalAreas } = view.bulletin;
  const lines = [
    { label: t.bulletinName, value: storm.internationalName ? `${storm.name} (${storm.internationalName})` : storm.name },
    { label: t.bulletinCategory, value: `${t[`category_${storm.category}`]} (${storm.category})` },
    { label: t.bulletinPosition, value: position.text },
  ];
  if (movement) lines.push({ label: t.bulletinMovement, value: movement.text });
  for (const area of signalAreas) {
    lines.push({
      label: fill(t.bulletinSignal, { level: area.level }),
      value: area.psgc.map((code) => places.get(code) ?? code).join(', '),
    });
  }
  return lines;
}

/** The engine's "Inilabas ng PAGASA: …" line with readable times in place of raw ISO strings. */
export function bulletinAge(view: BulletinCardView, copy: CopyFn, lang: UiLanguage, t: StormCopy): string {
  return copy('bulletin_age', {
    lang,
    vars: { issuedAt: clockText(view.bulletin.issuedAt, t), fetchedAt: clockText(view.bulletin.fetchedAt, t) },
  });
}

/**
 * Places the bagyo and its forecast fixes on a unit disc around home (0, 0): x grows east, y grows
 * south, so callers map straight to screen offsets. Pure presentation of the engine's bearings and
 * distances; the scale is the farthest fix, so every point fits.
 */
export function trackPoints(storm: StormMeasure): { now: TrackPoint; forecast: TrackPoint[]; scaleKm: number } {
  const scaleKm = Math.max(1, storm.now.distanceKm, ...storm.forecast.map((fix) => fix.distanceKm));
  const place = (fix: StormMeasure['now']): TrackPoint => {
    const r = fix.distanceKm / scaleKm;
    const rad = (fix.bearingDeg * Math.PI) / 180;
    return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
  };
  return { now: place(storm.now), forecast: storm.forecast.map(place), scaleKm };
}
