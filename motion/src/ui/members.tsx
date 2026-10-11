// Household members from the DEMO seed (app/engine/demoSeed.ts), relation and age labels from strings/common.ts.
// Photos are illustrated placeholders: flat cut-out portraits with no facial features, never a real face.
import type { CSSProperties } from 'react';
import { border, palette, radius, shadow, space } from '../theme';
import type { Roles } from '../theme';
import { Txt } from './primitives';

type Look = 'maria' | 'jose' | 'lola' | 'mika' | 'baby';
const { blue: b, phase: ph, sticker: st } = palette;

export const HOUSEHOLD: { name: string; detail: string; look: Look }[] = [
  { name: 'Maria', detail: 'Sarili · Nasa hustong gulang', look: 'maria' },
  { name: 'Jose', detail: 'Asawa · Nasa hustong gulang', look: 'jose' },
  { name: 'Lola Ising', detail: 'Magulang · Nakatatanda', look: 'lola' },
  { name: 'Mika', detail: 'Anak · Bata', look: 'mika' },
  { name: 'Baby Joy', detail: 'Anak · Sanggol', look: 'baby' },
];

const LOOKS: Record<Look, { bg: string; skin: string; hair: string; shirt: string }> = {
  maria: { bg: b['100'], skin: '#D7A47C', hair: '#2E2622', shirt: b['600'] },
  jose: { bg: ph.before.tint, skin: '#C58D66', hair: '#241E1B', shirt: ph.before.deep },
  lola: { bg: ph.after.tint, skin: '#DDB28F', hair: '#D9DDE3', shirt: ph.after.main },
  mika: { bg: ph.during.tint, skin: '#D39C72', hair: '#2E2622', shirt: st.sunburst },
  baby: { bg: b['100'], skin: '#E3B792', hair: '#3A302B', shirt: ph.during.main },
};

export function Portrait({ look, size }: { look: Look; size: number }) {
  const l = LOOKS[look];
  const ink = b['900'];
  const line = { stroke: ink, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  const small = look === 'mika' || look === 'baby';
  const head = look === 'baby' ? { cx: 50, cy: 54, rx: 15, ry: 15 } : small ? { cx: 50, cy: 51, rx: 14.5, ry: 16 } : { cx: 50, cy: 46, rx: 16, ry: 18 };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <defs><clipPath id={`clip-${look}`}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <g clipPath={`url(#clip-${look})`}>
        <rect width="100" height="100" fill={l.bg} />
        {look === 'maria' ? <path d="M32 50 C29 28 40 23 50 23 C61 23 72 29 68 50 L71 72 C64 77 57 72 57 68 L43 68 C43 72 36 77 29 72 Z" fill={l.hair} {...line} /> : null}
        {look === 'mika' ? <><circle cx="33" cy="47" r="6.5" fill={l.hair} {...line} /><circle cx="67" cy="47" r="6.5" fill={l.hair} {...line} /></> : null}
        {look === 'lola' ? <circle cx="50" cy="24" r="7.5" fill={l.hair} {...line} /> : null}
        <path d={small ? 'M22 106 C24 84 36 76 50 76 C64 76 76 84 78 106 Z' : 'M14 106 C16 82 32 71 50 71 C68 71 84 82 86 106 Z'} fill={l.shirt} {...line} />
        <ellipse {...head} fill={l.skin} {...line} />
        {look === 'maria' ? <path d="M34 45 C35 31 45 27 53 28 C62 29 67 36 66 45 C58 38 45 37 34 45 Z" fill={l.hair} {...line} /> : null}
        {look === 'jose' ? <path d="M34 44 C33 30 42 26 51 26 C61 26 68 32 66 44 C62 37 54 35 47 36 C41 37 37 40 34 44 Z" fill={l.hair} {...line} /> : null}
        {look === 'lola' ? <path d="M33 47 C31 31 41 28 50 28 C60 28 70 31 67 47 C62 38 56 36 50 36 C44 36 38 38 33 47 Z" fill={l.hair} {...line} /> : null}
        {look === 'mika' ? <path d="M36 48 C36 37 43 34 50 34 C58 34 65 37 64 48 C58 43 50 41 36 48 Z" fill={l.hair} {...line} /> : null}
        {look === 'baby' ? <path d="M49 40 C46 36 48 32 52 33 C55 34 54 38 51 38" fill="none" stroke={l.hair} strokeWidth={2} strokeLinecap="round" /> : null}
      </g>
      <circle cx="50" cy="50" r="49.5" fill="none" stroke={b['300']} strokeWidth={1} />
    </svg>
  );
}

/** One member, composed from the Pamilya list row (avatar, Bowlby name, "Relation · Age"). */
export function MemberCard({ c, name, detail, look, tilt = 0, style }: { c: Roles; name: string; detail: string; look: Look; tilt?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: 148, height: 212, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.md, padding: `${space.xl}px ${space.lg}px ${space.tile}px`,
        backgroundColor: c.surface, border: `${border.control}px solid ${c.controlBorder}`, borderRadius: radius.panel, boxShadow: shadow.sticker,
        transform: `rotate(${tilt}deg)`, ...style,
      }}
    >
      <Portrait look={look} size={92} />
      <Txt role="title" color={c.text} style={{ textAlign: 'center', marginTop: space.xs }}>{name}</Txt>
      <Txt role="caption" color={c.textMuted} style={{ textAlign: 'center' }}>{detail}</Txt>
    </div>
  );
}
