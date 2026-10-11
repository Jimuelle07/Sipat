// 1 Signal lost (night navy, the status bar at macro) and 2 Bago ang bagyo (daylight, the household).
import { ease, fonts, palette, roles } from '../theme';
import { prog, tilt } from '../lib/anim';
import { F, planePoint } from '../timeline';
import type { Layout } from '../layout';
import { Fill } from '../stage';
import { HOUSEHOLD, MemberCard } from '../ui/members';
import { Sticker } from '../ui/home';
import { Zoom } from '../ui/primitives';

export function SignalLost({ f, L }: { f: number; L: Layout }) {
  if (f > F.mint + 60) return null;
  const line = prog(f, 96, 28, ease.enter) * (1 - prog(f, 126, 14, ease.exit));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: L.signalLostTop, textAlign: 'center', opacity: line, transform: `translateY(${(1 - line) * 12}px)` }}>
      <span style={{ fontFamily: fonts.inter, fontWeight: 500, fontSize: 32, letterSpacing: -0.3, color: palette.gray['400'] }}>Walang signal.</span>
    </div>
  );
}

/** Daylight: the before canvas grows out of the airplane glyph as a pill (a circle at this scale). */
export function Daylight({ f, L }: { f: number; L: Layout }) {
  if (f < F.mint) return null;
  const p = prog(f, F.mint, 64, ease.enter);
  if (p >= 1) return null;
  const { x, y } = planePoint(f, L);
  return <Fill color={palette.phase.before.soft} clip={`circle(${p * Math.hypot(L.W, L.H) * 1.05}px at ${x}px ${y}px)`} />;
}

const TILTS = [-1.2, 0.8, -0.6, 1, -0.9];

export function Household({ f, L }: { f: number; L: Layout }) {
  if (f < F.household - 10 || f > F.scrollToPicker + 60) return null;
  const c = roles('before');
  const { title, mood: moodAt, coin: coinAt, k, cards } = L.household;
  // Before-phase motion from themes.ts: 600 ms reveal, 40 ms stagger, 16 dp rise.
  const reveal = (delay: number) => prog(f, F.household + delay, 36, ease.enter);
  const scroll = prog(f, F.scrollToPicker, 48, ease.calm) * -L.household.scroll;
  const drift = 1 + 0.012 * prog(f, F.household, 260, ease.calm);
  const head = reveal(0);
  // The coin pops with the app's poster Pop delay (380 ms).
  const coin = prog(f, F.household + 23, 18, ease.settle);
  const mood = reveal(6);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateY(${scroll}px) scale(${drift})`, transformOrigin: '40% 50%' }}>
      <div style={{ position: 'absolute', left: title.x, top: title.y, opacity: head, transform: `translateY(${(1 - head) * 16 * k}px)` }}>
        {title.lines.map((line) => (
          <div key={line} style={{ fontFamily: fonts.display, fontSize: title.size, lineHeight: `${title.size}px`, letterSpacing: -title.size * 0.02, color: c.ink, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{line}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: moodAt.x, top: moodAt.y, opacity: mood, transform: `translateY(${(1 - mood) * 16 * k}px)` }}>
        <div style={{ fontFamily: fonts.inter, fontWeight: 700, fontSize: moodAt.size, letterSpacing: -moodAt.size * 0.03, color: c.ink }}>Maghanda habang kalmado pa.</div>
      </div>
      {/* The Home poster's sticker language: the sunburst coin by the title. */}
      <div style={{ position: 'absolute', left: coinAt.x, top: coinAt.y, opacity: Math.min(1, coin * 1.5), transform: `rotate(-12deg) scale(${0.6 + 0.4 * coin})` }}>
        <Sticker c={c} kind="coin" color={palette.sticker.sunburst} size={88} />
      </div>
      {HOUSEHOLD.map((m, i) => {
        const p = reveal(14 + i * 2.4);
        const at = cards[i]!;
        return (
          <Zoom key={m.name} k={k} x={at.x} y={at.y} w={148} style={{ opacity: p, transform: `translateY(${(1 - p) * 16 * k}px) scale(${k})` }}>
            <div style={tilt(p, 'X', 28)}><MemberCard c={c} {...m} tilt={TILTS[i]} /></div>
          </Zoom>
        );
      })}
    </div>
  );
}
