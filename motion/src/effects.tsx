// SaaS-launch effects layered on the film: camera punch-ins, touch indicators, sticker-label captions,
// and the frame windows where motion blur is worth its cost. Every effect hangs on an existing beat.
import { border, ease, fonts, palette, radius, shadow, space } from './theme';
import { keys, lerp, prog } from './lib/anim';
import { F, homeTransform } from './timeline';
import type { CaptionId, Layout } from './layout';
import { HOME } from './ui/device';
import { checkbox, signal3 } from './scenes/Storm';
import { refusalCentre, sourceLink } from './scenes/Ask';

type Pt = { x: number; y: number };
const centre = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// ---- camera ------------------------------------------------------------------------------------------------

/** A punch-in: ease in over `inDur`, hold (the focus may travel), ease out from `out` over `outDur`. */
type Punch = { from: number; inDur: number; out: number; outDur: number; k: number; focus: (f: number, L: Layout) => Pt };

const PUNCHES: Punch[] = [
  // The tap on Signal No. 3; eases back out as the tile stretches into the banner.
  { from: 440, inDur: 26, out: 494, outDur: 30, k: 1.55, focus: (_f, L) => centre(signal3(L)) },
  // The three ticks: the camera steps down row by row, then pulls out to reveal "Tapos na ang 7 sa 26".
  {
    from: 768, inDur: 22, out: 878, outDur: 28, k: 1.45,
    focus: (f, L) => {
      const rows = [checkbox(L, 0), checkbox(L, 1), checkbox(L, 2)];
      const x = L.right.x + 196 * L.right.k;
      const y = keys(f, [[768, rows[0]!.y], [804, rows[0]!.y], [820, rows[1]!.y, ease.calm], [840, rows[1]!.y], [856, rows[2]!.y, ease.calm]]);
      return { x, y };
    },
  },
  // "Saan galing ito?": in on the link, then the camera follows it open into the source tile.
  {
    from: 1144, inDur: 22, out: 1214, outDur: 26, k: 1.4,
    focus: (f, L) => {
      const link = sourceLink(f, L);
      const tile = { x: L.source.x + 196 * L.source.k, y: L.source.y + 95 * L.source.k };
      const p = prog(f, 1176, 30, ease.calm);
      return { x: lerp(p, link.x, tile.x), y: lerp(p, link.y, tile.y) };
    },
  },
  // "Wala ito sa gabay.": in as the refusal resolves, out as the scene leaves.
  { from: 1414, inDur: 30, out: 1474, outDur: 24, k: 1.4, focus: (_f, L) => refusalCentre(L) },
];

/** Camera transform for the content layer: the focus point eases toward frame centre while scaling. */
export function camera(f: number, L: Layout): { k: number; transform: string } {
  for (const p of PUNCHES) {
    if (f < p.from || f > p.out + p.outDur) continue;
    const z = prog(f, p.from, p.inDur, ease.calm) * (1 - prog(f, p.out, p.outDur, ease.calm));
    // 9:16 has no side room: zoom straight in on the column (centred), and less, so no line gets cut mid-word.
    const portrait = L.H > L.W;
    const k = 1 + (p.k - 1) * z * (portrait ? 0.4 : 1);
    const fp = portrait ? { x: L.W / 2, y: p.focus(f, L).y } : p.focus(f, L);
    const c = { x: lerp(z, fp.x, L.W / 2), y: lerp(z, fp.y, L.H / 2) };
    return { k, transform: `translate(${c.x - fp.x * k}px, ${c.y - fp.y * k}px) scale(${k})` };
  }
  return { k: 1, transform: 'none' };
}

// ---- touch indicator ---------------------------------------------------------------------------------------

/** One gesture: the dot arrives, presses each target on its frame, and leaves. Targets are in content space. */
type Track = { taps: number[]; at: (i: number, f: number, L: Layout) => Pt; lead?: number }; // lead: frames the dot arrives early
const SEG = (392 - 2 * border.control - 4 * space.xs) / 3;

const TRACKS: Track[] = [
  { taps: [F.tap], at: (_i, _f, L) => centre(signal3(L)) },
  { taps: F.ticks, at: (i, _f, L) => checkbox(L, i as 0 | 1 | 2) },
  { taps: [F.source - 8], at: (_i, f, L) => sourceLink(f, L) },
  {
    taps: [F.thumb - 4],
    lead: 12, // arrives with the selector, after the refusal has gone
    at: (_i, f, L) => {
      const t = homeTransform(f, L);
      return {
        x: t.x + (HOME.posterLeft + border.control + space.xs + 2 * (SEG + space.xs) + SEG / 2) * t.k,
        y: t.y + (HOME.selectorTop + border.control + 24) * t.k,
      };
    },
  },
];

const DOT = 64;

/** Rendered inside the camera layer; `k` is the camera scale, undone so the dot keeps one size on screen. */
export function Touches({ f, L, k }: { f: number; L: Layout; k: number }) {
  return (
    <>
      {TRACKS.map((track, ti) => {
        const first = track.taps[0]!;
        const last = track.taps[track.taps.length - 1]!;
        const ahead = track.lead ?? 30;
        if (f < first - ahead || f > last + 30) return null;
        const show = prog(f, first - ahead, Math.min(12, ahead), ease.enter) * (1 - prog(f, last + 14, 14, ease.exit));
        // Where the dot is: approaching the first target, then gliding between targets.
        let p = track.at(0, f, L);
        const lead = prog(f, first - ahead, ahead - 6, ease.calm);
        p = { x: p.x + (1 - lead) * 120, y: p.y + (1 - lead) * 150 };
        for (let i = 1; i < track.taps.length; i++) {
          const g = prog(f, track.taps[i - 1]! + 8, track.taps[i]! - track.taps[i - 1]! - 14, ease.calm);
          const a = track.at(i - 1, f, L);
          const b = track.at(i, f, L);
          if (f >= track.taps[i - 1]! + 8) p = { x: lerp(g, a.x, b.x), y: lerp(g, a.y, b.y) };
        }
        const press = track.taps.reduce((s, t) => s * (1 - 0.2 * Math.sin(Math.PI * prog(f, t - 6, 12, ease.calm))), 1);
        return (
          <div key={ti}>
            {track.taps.map((t) => {
              const r = prog(f, t, 22, ease.enter);
              if (r <= 0 || r >= 1) return null;
              const at = track.at(track.taps.indexOf(t), t, L);
              const size = (DOT + r * 70) / k;
              return <div key={t} style={{ position: 'absolute', left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: '50%', border: `${3 / k}px solid rgba(33,59,94,${0.45 * (1 - r)})`, boxShadow: `0 0 0 ${2 / k}px rgba(255,255,255,${0.8 * (1 - r)})` }} />;
            })}
            <div
              style={{
                position: 'absolute', left: p.x - DOT / 2 / k, top: p.y - DOT / 2 / k, width: DOT / k, height: DOT / k, borderRadius: '50%', opacity: show,
                backgroundColor: 'rgba(33,59,94,0.38)', border: `${3 / k}px solid rgba(255,255,255,0.95)`,
                boxShadow: `0 ${4 / k}px ${14 / k}px rgba(18,26,38,0.28)`, transform: `scale(${press})`,
              }}
            />
          </div>
        );
      })}
    </>
  );
}

// ---- captions ----------------------------------------------------------------------------------------------

const CAPTIONS: { id: CaptionId; text: string; from: number; to: number; tilt: number }[] = [
  { id: 'family', text: 'Para sa buong pamilya.', from: 236, to: 392, tilt: -2 },
  { id: 'tap', text: 'Isang tap lang.', from: 568, to: 684, tilt: 1.5 },
  { id: 'fit', text: 'Angkop sa pamilya.', from: 896, to: 984, tilt: -1.5 },
  { id: 'official', text: 'Mula sa opisyal\nna gabay.', from: 1240, to: 1312, tilt: 1.5 },
  { id: 'guess', text: 'Hindi nanghuhula.', from: 1446, to: 1474, tilt: -2 },
];

/** Sticker-label captions in the app's Capsule language: paper pill, ink stroke, Bowlby One, a slight tilt. */
export function Captions({ f, L }: { f: number; L: Layout }) {
  return (
    <>
      {CAPTIONS.map((cap) => {
        if (f < cap.from || f > cap.to + 16) return null;
        const pop = prog(f, cap.from, 18, ease.settle);
        const words = prog(f, cap.from + 4, 16, ease.enter);
        const out = prog(f, cap.to, 14, ease.exit);
        const at = L.captions[cap.id];
        const size = L.captionSize;
        return (
          <div
            key={cap.id}
            style={{
              position: 'absolute', top: at.y, left: at.x, opacity: Math.min(1, pop * 2) * (1 - out),
              transform: `translateX(${at.align === 'center' ? '-50%' : '0'}) translateY(${(1 - pop) * 24 - out * 16}px) perspective(900px) rotateX(${(1 - pop) * 35}deg) rotate(${cap.tilt * pop}deg) scale(${0.9 + 0.1 * pop})`,
              transformOrigin: '50% 100%',
            }}
          >
            <div style={{ padding: `${size * 0.32}px ${size * 0.6}px ${size * 0.28}px`, borderRadius: radius.capsule, backgroundColor: palette.sticker.paper, border: `${border.emphasis * 1.5}px solid ${palette.blue['800']}`, boxShadow: shadow.float, overflow: 'hidden' }}>
              <div style={{ fontFamily: fonts.display, fontSize: size, lineHeight: `${size * 1.05}px`, letterSpacing: -size * 0.01, color: palette.blue['900'], whiteSpace: 'pre', textAlign: 'center', transform: `translateY(${(1 - words) * 100}%)`, textTransform: 'uppercase' }}>
                {cap.text}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---- motion blur -------------------------------------------------------------------------------------------

/** Frames with fast camera or object motion; only these pay for multi-sample motion blur. */
const BLUR: [number, number][] = [
  [126, 180], [404, 454], [440, 468], [494, 542], [600, 632], [690, 722], [768, 792], [878, 908],
  [990, 1072], [1144, 1168], [1176, 1242], [1318, 1352], [1414, 1446], [1474, 1522], [1532, 1610], [1640, 1716],
];
export const blurAt = (f: number) => BLUR.some(([a, b]) => f >= a && f <= b);
