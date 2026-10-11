// Elements that live across scenes: the status bar and the mascot.
import { ease, palette } from '../theme';
import { mix, prog } from '../lib/anim';
import { F, homeTransform, mascotBox, statusBar } from '../timeline';
import { HOME, StatusGlyphs } from '../ui/device';
import { MascotArt } from '../ui/home';
import { Zoom } from '../ui/primitives';
import type { Phase } from '../theme';
import type { Layout } from '../layout';

export function StatusLayer({ f, L }: { f: number; L: Layout }) {
  if (f >= F.pullBack + 56) return null; // handed to the phone's own status bar
  const s = statusBar(f, L);
  const drop = [0, 1, 2, 3].map((i) => prog(f, F.barsDrop + (3 - i) * 16, 14, ease.exit));
  const plane = prog(f, F.plane, 26, ease.settle);
  const ghost = 1 - prog(f, F.plane - 12, 14, ease.exit);
  const color = mix(prog(f, 144, 18, ease.calm), palette.dark.text, palette.blue['900']);
  return (
    <Zoom k={s.k} x={s.x} y={s.y} w={s.w}>
      <StatusGlyphs color={color} drop={drop} plane={plane} ghost={ghost} width={s.w} />
    </Zoom>
  );
}

/** The mascot: sits beside the household, swaps to the raincoat at the switch, steps aside, then goes home to the poster. */
export function MascotLayer({ f, L }: { f: number; L: Layout }) {
  if (f < F.household + 30 || f >= F.handoff) return null;
  const box = mascotBox(f, L);
  const enter = prog(f, F.household + 40, 42, ease.enter);
  const breathe = 1 + 0.006 * Math.sin((f / 60) * Math.PI * 0.5) * (1 - prog(f, F.mascotHome, 40, ease.calm));
  const swap = prog(f, F.swap, 6, ease.calm);
  const swapAfter = prog(f, F.mascotHome - 4, 6, ease.calm); // swaps while still small in the corner
  const dip = 1 - 0.035 * Math.sin(Math.PI * prog(f, F.swap - 6, 18, ease.calm));
  const layer = (phase: Phase, opacity: number) => opacity > 0 ? (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <MascotArt phase={phase} size={box.size} />
    </div>
  ) : null;
  // In the poster the art is clipped by the poster's bottom edge; match it before the hand-off.
  const t = homeTransform(f, L);
  const posterBottom = t.y + (HOME.posterBottom + (1 - prog(f, F.poster, 42, ease.enter)) * 12) * t.k;
  const clipBottom = f > F.mascotHome ? `inset(0 -50% ${Math.max(0, box.y + box.size - posterBottom)}px -50%)` : undefined;
  return (
    <div
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.size * 0.75, height: box.size,
        opacity: enter, transform: `translateY(${(1 - enter) * 25}px) scale(${breathe * dip})`, transformOrigin: '50% 100%', clipPath: clipBottom,
      }}
    >
      {layer('before', 1 - swap)}
      {layer('during', swap * (1 - swapAfter))}
      {layer('after', swapAfter)}
    </div>
  );
}
