// HomeScreen hero pieces: Sticker, MascotSlot, the phase poster, PhaseSelector and Marquee.
import type { CSSProperties, ReactNode } from 'react';
import { Img, staticFile } from 'remotion';
import meta from '../lib/mascots.json';
import { border, minTouch, palette, radius, shadow, space, type } from '../theme';
import type { Phase, Roles } from '../theme';
import { Icon, Txt } from './primitives';

/** MascotSlot.tsx art: 0.75·size × size holding the full 3072×4096 canvas, so every phase keeps the artist's registration. */
export function MascotArt({ phase, size, style }: { phase: Phase; size: number; style?: CSSProperties }) {
  const m = meta[phase];
  const s = size / m.canvas[1]!;
  const [x0, y0, x1, y1] = m.box as [number, number, number, number];
  return (
    <div style={{ position: 'relative', width: size * 0.75, height: size, ...style }}>
      <Img src={staticFile(`mascot/${phase}.png`)} style={{ position: 'absolute', left: x0 * s, top: y0 * s, width: (x1 - x0) * s, height: (y1 - y0) * s }} />
    </div>
  );
}

/** Sticker.tsx: flat fill, carbon (ink) outline, sticker shadow; ring is a thick open circle. */
export function Sticker({ c, kind, color, size, style }: { c: Roles; kind: 'coin' | 'check' | 'burst' | 'ring'; color: string; size: number; style?: CSSProperties }) {
  if (kind === 'ring') {
    return <div style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, border: `${size * 0.26}px solid ${color}`, ...style }} />;
  }
  const r = kind === 'burst' ? size * 0.3 : size / 2;
  return (
    <div style={{ width: size, height: size, borderRadius: r, backgroundColor: color, border: `${border.control}px solid ${c.ink}`, boxShadow: shadow.sticker, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {kind === 'check' ? <Icon name="checkmark" size={size * 0.6} color={c.ink} /> : null}
      {kind === 'coin' ? <div style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, border: `2px solid ${c.ink}` }} /> : null}
    </div>
  );
}

/** HomeScreen posterFont(): the size that keeps the longest word inside the poster. */
export function posterFont(name: string) {
  const longest = Math.max(...name.split(' ').map((w) => w.length));
  const fontSize = Math.min(64, Math.floor(290 / (longest * 0.92)));
  return { fontSize, lineHeight: `${Math.round(fontSize * 0.98)}px` };
}

/** The Home hero: the tilted blue back card and the phase poster. `pop` (0..1 each) staggers the stickers in. */
export function HeroPoster({ c, title, mood, mascot, pop = [1, 1, 1], width = 392 }: {
  c: Roles; title: string; mood: string; mascot: ReactNode; pop?: [number, number, number]; width?: number;
}) {
  const st = palette.sticker;
  const popStyle = (p: number, rotate: number): CSSProperties => ({ opacity: Math.min(1, p * 1.5), transform: `rotate(${rotate}deg) scale(${0.6 + 0.4 * p})` });
  return (
    <div style={{ position: 'relative', width, paddingBottom: space.xxxl }}>
      <div style={{ position: 'absolute', left: space.xs, right: space.xs, top: space.xxl, bottom: space.xxxl - space.lg, borderRadius: radius.capsule, border: `${border.emphasis}px solid ${c.stroke}`, transform: 'rotate(3.2deg)', backgroundColor: c.highlight.fill }} />
      <div style={{ position: 'relative', minHeight: 400, boxShadow: shadow.float, overflow: 'hidden', padding: space.tile, borderRadius: radius.capsule, border: `${border.emphasis}px solid ${c.stroke}`, backgroundColor: c.wash }}>
        <Sticker c={c} kind="ring" color={st.paper} size={260} style={{ right: -70, top: 70 }} />
        <div style={{ position: 'absolute', right: 22, top: 20, ...popStyle(pop[0], -12) }}><Sticker c={c} kind="coin" color={st.sunburst} size={54} /></div>
        <div style={{ position: 'absolute', left: 22, bottom: 24, ...popStyle(pop[1], 10) }}><Sticker c={c} kind="check" color={st.mint} size={50} /></div>
        <div style={{ position: 'absolute', right: 40, top: 150, ...popStyle(pop[2], 18) }}><Sticker c={c} kind="burst" color={st.ember} size={40} /></div>
        <div style={{ ...type('display', c.ink), ...posterFont(title), position: 'relative', textTransform: 'uppercase', maxWidth: '85%' }}>{title}</div>
        <Txt role="lead" color={c.ink} style={{ position: 'relative', marginTop: space.lg, maxWidth: '52%' }}>{mood}</Txt>
        <div style={{ position: 'absolute', right: -space.md, bottom: -space.xxl }}>{mascot}</div>
      </div>
    </div>
  );
}

/** Slot for the poster mascot: size × size with the art centred, as MascotSlot lays it out. */
export function MascotSlot({ phase, size }: { phase: Phase; size: number }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <MascotArt phase={phase} size={size} />
    </div>
  );
}

/** PhaseSelector.tsx. `at` is the selected segment (0 Bago, 1 Habang, 2 Pagkatapos); fractions slide the thumb. */
export function PhaseSelector({ c, at, labels = ['Bago', 'Habang', 'Pagkatapos'], width = 392 }: { c: Roles; at: number; labels?: string[]; width?: number }) {
  const seg = (width - 2 * border.control - 2 * space.xs - 2 * space.xs) / 3;
  return (
    <div style={{ position: 'relative', width, display: 'flex', gap: space.xs, padding: space.xs, borderRadius: radius.pill, backgroundColor: c.surface, border: `${border.control}px solid ${c.stroke}` }}>
      <div style={{ position: 'absolute', top: space.xs, left: space.xs + at * (seg + space.xs), width: seg, height: minTouch - space.xs * 2, borderRadius: radius.pill, backgroundColor: c.selected.fill, border: `${border.control}px solid ${c.stroke}` }} />
      {labels.map((label, i) => {
        const near = Math.max(0, 1 - Math.abs(at - i) * 2);
        return (
          <div key={label} style={{ position: 'relative', flex: 1, minHeight: minTouch, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
            <Icon name="checkmark" size={15} color={c.selected.ink} style={{ width: 15 * near, opacity: near, overflow: 'hidden' }} />
            <Txt role="caption" color={c.text} style={{ whiteSpace: 'nowrap' }}>{label}</Txt>
          </div>
        );
      })}
    </div>
  );
}

/** Marquee.tsx: ink strip with the phase name and mood on a slow linear loop (28 ms per px, as in the app). */
export function Marquee({ c, text, frame, width }: { c: Roles; text: string; frame: number; width: number }) {
  const line = `${text}  ✦  `;
  // shortcut: no lap wrap; the film shows the strip for ~2 s (about 70 dp of travel).
  const shift = ((frame / 60) * 1000) / 28;
  return (
    <div style={{ width, overflow: 'hidden', backgroundColor: c.ink, padding: `${space.sm}px 0` }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', transform: `translateX(${-shift}px)` }}>
        {[0, 1, 2].map((i) => (
          <Txt key={i} role="caption" color={palette.sticker.paper} style={{ textTransform: 'uppercase', letterSpacing: 1.4, flexShrink: 0, whiteSpace: 'pre' }}>{line}</Txt>
        ))}
      </div>
    </div>
  );
}
