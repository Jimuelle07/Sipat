// One clock for the whole film (60 fps, 100 BPM: a beat is 36 frames) and the shared geometry that
// crosses scene boundaries: the status bar, the mascot, and the final phone.
import { ease } from './theme';
import { keys, lerp, prog } from './lib/anim';
import { HOME, SCREEN } from './ui/device';
import type { Layout, MascotSpot } from './layout';

export const DURATION = 1788;

export const F = {
  barsDrop: 24, // four bars, 16 f apart; the last lands on beat 2 (72)
  plane: 88,
  mint: 146, // daylight grows from the airplane glyph
  household: 156,
  scrollToPicker: 404,
  tap: 468, // beat 13
  morph: 504, // banner lands on beat 15 (540)
  flood: 538,
  swap: 550,
  mascotAside: 600,
  toChecklist: 690,
  ticks: [792, 828, 864], // beats 22, 23, 24
  toAsk: 990,
  summary: 1044,
  aiTag: 1068,
  aiFinal: 1150,
  source: 1176,
  toRefusal: 1318,
  refusal: 1404, // beat 39
  toAfter: 1480,
  thumb: 1508,
  lavender: 1526,
  camera: 1534, // selector close-up → hero framing
  poster: 1552,
  mascotHome: 1548,
  handoff: 1608,
  closing: 1584,
  pullBack: 1640,
  wordmark: 1680,
  still: 1722,
};

export const pullBack = (f: number) => prog(f, F.pullBack, 56, ease.calm);

/** Screen-space transform of AfterHome: selector close-up → hero framing (S7) → phone (S8). */
export function homeTransform(f: number, L: Layout) {
  const c = prog(f, F.camera, 56, ease.calm);
  const p = pullBack(f);
  const x = lerp(c, L.close.x, L.after.x);
  const y = lerp(c, L.close.y, L.after.y);
  const k = lerp(c, L.close.k, L.after.k);
  return { x: lerp(p, x, L.phone.x), y: lerp(p, y, L.phone.y), k: lerp(p, k, L.phone.k) };
}

const DOCK_K = 1.6;
// The right-hand glyph cluster (signal/airplane + battery) is the macro subject; its centre in dp from the bar's right edge.
const CLUSTER_FROM_RIGHT = 45.5;

/**
 * The status bar: a macro on the signal glyphs over night navy, an exponential pull back to a frame-wide bar,
 * then into the phone's own status bar at the end. Returns top-left, scale and the bar's dp width.
 */
export function statusBar(f: number, L: Layout) {
  const dock = prog(f, 126, 50, ease.calm);
  const macroK = keys(f, [[0, L.macro.k], [126, L.macro.k * 1.07, ease.calm]]);
  const k0 = Math.exp(lerp(dock, Math.log(macroK), Math.log(DOCK_K)));
  const w0 = lerp(dock, SCREEN.w, L.W / DOCK_K);
  const ax = lerp(dock, L.macro.x, (L.W / DOCK_K - CLUSTER_FROM_RIGHT) * DOCK_K);
  const ay = lerp(dock, L.macro.y, 6 + 15 * DOCK_K);
  const x0 = ax - (w0 - CLUSTER_FROM_RIGHT) * k0;
  const y0 = ay - 15 * k0;
  const home = homeTransform(f, L);
  const p = pullBack(f);
  return { k: lerp(p, k0, home.k), w: lerp(p, w0, SCREEN.w), x: lerp(p, x0, home.x), y: lerp(p, y0, home.y) };
}

/** Where the airplane glyph sits on screen (daylight grows out of it). */
export function planePoint(f: number, L: Layout) {
  const s = statusBar(f, L);
  return { x: s.x + (s.w - 64) * s.k, y: s.y + 15 * s.k };
}

const mixSpot = (p: number, a: MascotSpot, b: MascotSpot): MascotSpot => ({ x: lerp(p, a.x, b.x), y: lerp(p, a.y, b.y), size: lerp(p, a.size, b.size) });

/** Mascot art box (MascotSlot art: 0.75·size × size) through the film. */
export function mascotBox(f: number, L: Layout): MascotSpot {
  const t = homeTransform(f, L);
  const homeSlot = {
    x: t.x + (HOME.mascotSlot.left + HOME.mascotSlot.size * 0.125) * t.k,
    y: t.y + HOME.mascotSlot.top * t.k,
    size: HOME.mascotSlot.size * t.k,
  };
  const s3 = mixSpot(prog(f, F.scrollToPicker, 48, ease.calm), L.mascot.household, L.mascot.picker);
  const a = mixSpot(prog(f, F.mascotAside, 30, ease.enter), s3, L.mascot.aside);
  return mixSpot(prog(f, F.mascotHome, 56, ease.calm), a, homeSlot);
}
