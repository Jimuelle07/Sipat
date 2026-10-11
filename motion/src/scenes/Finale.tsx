// 7 Pagkatapos ng bagyo (lavender floods out of the phase selector, the after poster, the closing line)
// and 8 Sipat (the frame pulls back into the phone; wordmark and line).
import { Img, staticFile } from 'remotion';
import { border, ease, fonts, palette, roles, shadow, space } from '../theme';
import { lerp, prog } from '../lib/anim';
import { F, homeTransform } from '../timeline';
import type { Layout } from '../layout';
import { Fill, growRect } from '../stage';
import { AfterHome, HOME, SCREEN } from '../ui/device';
import { ClosingLine, Zoom } from '../ui/primitives';

const c = roles('after');
// The app icon (assets/agi-sipat-logo.png, the app's launcher icon since commit eb19aa1) above the wordmark.
const LOCKUP_ICON = true;
const SEG = (392 - 2 * border.control - 4 * space.xs) / 3;

/** Visible screen: the whole frame until the pull back, then the phone's screen. */
function screenMask(f: number, L: Layout) {
  const t = homeTransform(f, L);
  const q = prog(f, F.pullBack + 2, 52, ease.calm);
  const r = 46 * t.k;
  return {
    x: lerp(q, 0, t.x), y: lerp(q, 0, t.y),
    w: lerp(q, L.W, SCREEN.w * t.k), h: lerp(q, L.H, SCREEN.h * t.k),
    r: lerp(q, 0, r), q, k: t.k,
  };
}
const insetOf = (m: { x: number; y: number; w: number; h: number; r: number }, L: Layout) =>
  `inset(${m.y}px ${L.W - m.x - m.w}px ${L.H - m.y - m.h}px ${m.x}px round ${m.r}px)`;

export function Finale({ f, L }: { f: number; L: Layout }) {
  if (f < F.toAfter) return null;
  const t = homeTransform(f, L);
  const at = 1 + prog(f, F.thumb, 20, ease.calm);
  const selectorIn = prog(f, F.toAfter + 12, 24, ease.enter);
  const lav = prog(f, F.lavender, 30, ease.enter);
  const posterRise = prog(f, F.poster, 42, ease.enter); // after-phase motion: 700 ms, 12 dp rise
  const pop = [23, 31, 39].map((d) => prog(f, F.poster + d, 18, ease.settle)) as [number, number, number];
  const m = screenMask(f, L);
  const inS8 = f >= F.pullBack;
  const thumb = {
    x: t.x + (HOME.posterLeft + border.control + space.xs + at * (SEG + space.xs)) * t.k,
    y: t.y + (HOME.selectorTop + border.control + space.xs) * t.k,
    w: SEG * t.k, h: (48 - 2 * space.xs) * t.k, r: 999,
  };
  const lavClip = lav < 1 ? growRect(lav, thumb, L.W, L.H) : inS8 ? insetOf(m, L) : undefined;
  const body = prog(f, F.pullBack + 2, 26, ease.calm);
  const bezel = 11 * m.k;
  const closing = prog(f, F.closing, 42, ease.enter) * (1 - prog(f, F.pullBack, 18, ease.exit));
  const word = prog(f, F.wordmark, 34, ease.enter);
  const line = prog(f, F.wordmark + 14, 30, ease.enter);

  return (
    <>
      {inS8 ? (
        <div
          style={{
            position: 'absolute', left: m.x - bezel, top: m.y - bezel, width: m.w + 2 * bezel, height: m.h + 2 * bezel, opacity: body,
            borderRadius: m.r + bezel, backgroundColor: '#1B2636',
            boxShadow: `inset 0 0 0 ${1.5 * m.k}px #2C3A4F, 0 ${4 * m.k}px ${6 * m.k}px rgba(0,0,0,0.2), 0 ${30 * m.k}px ${60 * m.k}px -${10 * m.k}px rgba(18,26,38,0.38)`,
          }}
        />
      ) : null}
      {lav > 0 ? <Fill color={palette.phase.after.soft} clip={lavClip} /> : null}
      <Fill clip={inS8 ? insetOf(m, L) : undefined}>
        <Zoom k={t.k} x={t.x} y={t.y} w={SCREEN.w}>
          <AfterHome
            frame={Math.min(Math.max(0, f - F.pullBack), F.still - F.pullBack)} // the marquee rests with the end card
            chrome={prog(f, F.pullBack + 8, 40, ease.calm)}
            status={f >= F.pullBack + 56 ? 1 : 0}
            at={at}
            pop={pop}
            posterRise={posterRise}
            posterIn={posterRise}
            mascot={f >= F.handoff}
            selectorIn={selectorIn}
            selectorDrop={(1 - selectorIn) * 120}
          />
        </Zoom>
        {inS8 ? (
          <div style={{ position: 'absolute', left: m.x + m.w / 2 - 6 * m.k, top: m.y + 9 * m.k, width: 12 * m.k, height: 12 * m.k, borderRadius: 99, backgroundColor: '#0B1018', opacity: body }} />
        ) : null}
      </Fill>
      {closing > 0 ? (
        <div style={{ position: 'absolute', left: L.closing.x, top: L.closing.y, width: 702, opacity: closing, transform: `translateY(${(1 - closing) * 18}px)` }}>
          <Zoom k={2.6} x={0} y={0} w={270}>
            <ClosingLine c={c} text="Sundin ang utos ng barangay at ng mga awtoridad." />
          </Zoom>
        </div>
      ) : null}
      {word > 0 ? (
        <div
          style={{
            position: 'absolute', top: L.lockup.y, width: L.lockup.width,
            left: L.lockup.align === 'center' ? L.lockup.x - L.lockup.width / 2 : L.lockup.x,
            display: 'flex', flexDirection: 'column', alignItems: L.lockup.align === 'center' ? 'center' : 'flex-start',
          }}
        >
          {LOCKUP_ICON ? (
            <Img src={staticFile('app-icon.png')} style={{ display: 'block', width: 136, height: 136, marginLeft: L.lockup.align === 'center' ? 0 : 8, marginBottom: 26, borderRadius: 31, boxShadow: shadow.sticker, opacity: word, transform: `scale(${0.94 + 0.06 * word})`, transformOrigin: '50% 100%' }} />
          ) : null}
          <div style={{ overflow: 'hidden', height: 236, paddingTop: 8 }}>
            <div style={{ fontFamily: fonts.display, fontSize: 212, lineHeight: '228px', letterSpacing: -4, color: c.ink, transform: `translateY(${(1 - word) * 100}%)` }}>Sipat</div>
          </div>
          <div style={{ marginTop: 18, fontFamily: fonts.inter, fontWeight: 500, fontSize: 46, letterSpacing: -0.8, color: c.accentText, opacity: line, transform: `translateY(${(1 - line) * 14}px)` }}>
            Gabay kahit walang signal.
          </div>
        </div>
      ) : null}
    </>
  );
}
