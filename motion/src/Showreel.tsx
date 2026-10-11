import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { ease, fonts, palette } from './theme';
import { prog } from './lib/anim';
import { F } from './timeline';
import { Grain, Light } from './stage';
import { Daylight, Household, SignalLost } from './scenes/Opening';
import { BannerActor, Checklist, OrangeFlood, Picker } from './scenes/Storm';
import { ASK_TEXTS, Ask, Refusal } from './scenes/Ask';
import type { AskWidths } from './scenes/Ask';
import { useTextWidths } from './lib/measure';
import { LANDSCAPE, PORTRAIT } from './layout';
import type { Layout } from './layout';
import { Finale } from './scenes/Finale';
import { MascotLayer, StatusLayer } from './scenes/persistent';
import { Captions, Touches, blurAt, camera } from './effects';

/** Base canvas: the phase colour once each flood has finished (floods draw themselves while running). */
function canvasAt(f: number): string {
  const ph = palette.phase;
  if (f >= F.pullBack) return ph.after.tint; // outside the phone at the end
  if (f >= F.lavender + 30) return ph.after.soft;
  if (f >= F.flood + 30) return ph.during.soft;
  if (f >= F.mint + 64) return ph.before.soft;
  return palette.dark.bg;
}

/** Everything you see. Reads the frame itself so motion blur can sample it between frames. */
function Visual({ L, widths }: { L: Layout; widths: AskWidths }) {
  const f = useCurrentFrame();
  const night = 1 - prog(f, F.mint, 40, ease.calm);
  const cam = camera(f, L);
  return (
    <AbsoluteFill style={{ backgroundColor: canvasAt(f), overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: cam.transform, transformOrigin: '0 0' }}>
        <SignalLost f={f} L={L} />
        <Daylight f={f} L={L} />
        <Household f={f} L={L} />
        <Picker f={f} L={L} />
        <OrangeFlood f={f} L={L} />
        <BannerActor f={f} L={L} />
        <Checklist f={f} L={L} />
        <Ask f={f} L={L} widths={widths} />
        <Refusal f={f} L={L} widths={widths} />
        <Finale f={f} L={L} />
        <MascotLayer f={f} L={L} />
        <Touches f={f} L={L} k={cam.k} />
      </AbsoluteFill>
      <Captions f={f} L={L} />
      <Light dark={night} />
      <StatusLayer f={f} L={L} />
      <Grain />
    </AbsoluteFill>
  );
}

export function SipatShowreel30({ orientation }: { orientation: 'landscape' | 'portrait' }) {
  const f = useCurrentFrame();
  const L = orientation === 'portrait' ? PORTRAIT : LANDSCAPE;
  const body = useTextWidths(`500 17px "${fonts.inter}"`, ASK_TEXTS.body);
  const title = useTextWidths(`400 16px "${fonts.display}"`, ASK_TEXTS.title);
  const widths = body && title ? { q1: body[0]!, q2: body[1]!, goBag: title[0]! } : null;
  const visual = widths ? <Visual L={L} widths={widths} /> : null;
  return (
    <AbsoluteFill style={{ backgroundColor: canvasAt(f) }}>
      {blurAt(f) ? <CameraMotionBlur shutterAngle={180} samples={6}>{visual}</CameraMotionBlur> : visual}
      {/* Original score, synthesised by scripts/score.py and timed to CUE-SHEET.md. */}
      <Audio src={staticFile('audio/sipat-score.wav')} />
    </AbsoluteFill>
  );
}
