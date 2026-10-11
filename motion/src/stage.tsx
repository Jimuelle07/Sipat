// The stage: the phone's screen canvas seen from inside, with restrained light, vignette and paper grain.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, staticFile } from 'remotion';

export function Fill({ color, clip, children, style }: { color?: string; clip?: string; children?: ReactNode; style?: CSSProperties }) {
  return <AbsoluteFill style={{ backgroundColor: color, clipPath: clip, ...style }}>{children}</AbsoluteFill>;
}

/** Soft daylight key from the top left plus a restrained vignette. `dark` deepens the falloff for night. */
export function Light({ dark = 0 }: { dark?: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 12% -10%, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%)', opacity: 1 - dark }} />
      <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, rgba(18,26,38,0) 58%, rgba(18,26,38,${0.09 + dark * 0.35}) 100%)` }} />
    </AbsoluteFill>
  );
}

export function Grain({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url(${staticFile('grain.png')})`, backgroundSize: '512px 512px', mixBlendMode: 'overlay', opacity }} />
  );
}

/** clip-path for a rounded rect growing from `from` to cover the frame (p 0→1). */
export function growRect(p: number, from: { x: number; y: number; w: number; h: number; r: number }, W: number, H: number, pad = 80): string {
  const t = from.y + (-pad - from.y) * p;
  const l = from.x + (-pad - from.x) * p;
  const r = W - (from.x + from.w) + (-pad - (W - (from.x + from.w))) * p;
  const b = H - (from.y + from.h) + (-pad - (H - (from.y + from.h))) * p;
  return `inset(${t}px ${r}px ${b}px ${l}px round ${from.r + (Math.max(W, H) * 0.25) * Math.sin(Math.PI * Math.min(1, p))}px)`;
}
