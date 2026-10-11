import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { fontsReady } from '../fonts';

/**
 * Canvas text widths measured after the webfont has loaded (measuring during the first render would use the
 * fallback face). Holds the frame with delayRender until the numbers are in.
 */
export function useTextWidths(font: string, texts: string[]): number[] | null {
  const [widths, setWidths] = useState<number[] | null>(null);
  const [handle] = useState(() => delayRender(`measure ${font}`));
  useEffect(() => {
    fontsReady.then(() => document.fonts.load(font)).then(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) throw new Error('No 2D canvas');
      ctx.font = font;
      setWidths(texts.map((t) => ctx.measureText(t).width));
      continueRender(handle);
    });
    // Measured once per tab; the texts are constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return widths;
}
