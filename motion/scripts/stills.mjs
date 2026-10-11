// Renders chosen frames as PNG stills with one bundle: node scripts/stills.mjs <outDir> <frame> [frame...]
// Frames may be given as seconds with an "s" suffix (e.g. 14s).
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [outDir, ...frames] = process.argv.slice(2);
const id = process.env.COMP ?? 'SipatShowreel30';
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id });
for (const raw of frames) {
  const frame = raw.endsWith('s') ? Math.round(parseFloat(raw) * composition.fps) : Number(raw);
  const output = path.resolve(outDir, `${id}-${String(frame).padStart(4, '0')}.png`);
  await renderStill({ serveUrl, composition, frame: Math.min(frame, composition.durationInFrames - 1), output, imageFormat: 'png' });
  console.log(output);
}
