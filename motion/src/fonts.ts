import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';
import { loadFont as loadBowlby } from '@remotion/google-fonts/BowlbyOne';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadBaskerville } from '@remotion/google-fonts/LibreBaskerville';

// The app's three faces (themes.ts buildType): Bowlby One display, Inter 500/700 UI, Libre Baskerville accent.
const bowlby = loadBowlby('normal', { weights: ['400'], subsets: ['latin'] });
const interFont = loadInter('normal', { weights: ['500', '700'], subsets: ['latin'] });
const baskerville = loadBaskerville('normal', { weights: ['400', '700'], subsets: ['latin'] });
export const display = bowlby.fontFamily;
export const inter = interFont.fontFamily;
export const serif = baskerville.fontFamily;
/** Resolves once the webfonts are registered and loaded (text measurement must wait for it). */
export const fontsReady = Promise.all([bowlby.waitUntilDone(), interFont.waitUntilDone(), baskerville.waitUntilDone()]);

// Ionicons is the icon font the app renders through @expo/vector-icons (copied by prepare_assets.py).
export const iconFamily = 'Ionicons';
const handle = delayRender('Ionicons font');
const face = new FontFace(iconFamily, `url(${staticFile('fonts/Ionicons.ttf')}) format('truetype')`);
face.load().then(() => {
  document.fonts.add(face);
  continueRender(handle);
}).catch((err: unknown) => cancelRender(err));
