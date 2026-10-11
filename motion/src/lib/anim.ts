import { interpolate, interpolateColors } from 'remotion';
import { ease } from '../theme';

type Curve = (t: number) => number;

/** Clamped 0→1 progress of `frame` through [start, start + dur] on a curve. */
export function prog(frame: number, start: number, dur: number, curve: Curve = ease.enter): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: curve,
  });
}

export const lerp = (p: number, a: number, b: number): number => a + (b - a) * p;
export const mix = (p: number, a: string, b: string): string => interpolateColors(p, [0, 1], [a, b]);

/** A slight 3D tilt that settles flat as p goes 0→1 (panels arriving). Spread into a wrapper's style. */
export function tilt(p: number, axis: 'X' | 'Y', deg: number, origin = '50% 100%') {
  return { transform: `perspective(1100px) rotate${axis}(${(1 - p) * deg}deg)`, transformOrigin: origin };
}

/** Value through keyframes [[frame, value], ...], each segment on its own curve (default enter). */
export function keys(frame: number, points: [number, number, Curve?][]): number {
  const [first] = points;
  if (!first || frame <= first[0]) return first ? first[1] : 0;
  for (let i = 1; i < points.length; i++) {
    const [f1, v1, curve] = points[i]!;
    const [f0, v0] = points[i - 1]!;
    if (frame <= f1) return lerp(prog(frame, f0, f1 - f0, curve ?? ease.enter), v0, v1);
  }
  return points[points.length - 1]![1];
}
