// Where everything sits, per orientation. The 16:9 master and the 9:16 cut share the clock and the components;
// only these positions and scales differ, so the vertical film is recomposed rather than cropped.

/** A dp-sized subtree placed at (x, y) in film pixels and scaled by k. */
export type Place = { x: number; y: number; k: number };
export type MascotSpot = { x: number; y: number; size: number };
export type CaptionAt = { x: number; y: number; align: 'left' | 'center' };
export type CaptionId = 'family' | 'tap' | 'fit' | 'official' | 'guess';

export interface Layout {
  W: number;
  H: number;
  macro: { x: number; y: number; k: number }; // centre of the signal glyphs at the opening
  signalLostTop: number;
  household: {
    title: { x: number; y: number; size: number; lines: string[] };
    mood: { x: number; y: number; size: number };
    coin: { x: number; y: number };
    k: number;
    cards: { x: number; y: number }[];
    scroll: number;
  };
  mascot: { household: MascotSpot; picker: MascotSpot; aside: MascotSpot };
  pick: Place;
  banner: Place;
  left: Place;
  right: Place;
  ask: Place & { xStart: number; yStart: number }; // start: where the question lands; end: after send
  ask2: Place;
  source: Place;
  askScroll: number;
  close: Place; // phase selector close-up (AfterHome transform)
  after: Place; // hero framing (AfterHome transform)
  phone: Place; // final phone screen
  closing: { x: number; y: number };
  lockup: { x: number; y: number; align: 'left' | 'center'; width: number };
  captions: Record<CaptionId, CaptionAt>;
  captionSize: number;
}

const SEL = { x: 206, y: 678 }; // phase selector centre in the Home layout, dp

export const LANDSCAPE: Layout = {
  W: 1920,
  H: 1080,
  macro: { x: 960, y: 468, k: 12 },
  signalLostTop: 612,
  household: {
    title: { x: 150, y: 250, size: 96, lines: ['Bago ang bagyo'] },
    mood: { x: 154, y: 366, size: 34 },
    coin: { x: 1172, y: 244 },
    k: 1.7,
    cards: [0, 1, 2, 3, 4].map((i) => ({ x: 150 + i * (148 * 1.7 + 24), y: 440 })),
    scroll: 1180,
  },
  mascot: {
    household: { x: 1443, y: 242, size: 640 },
    picker: { x: 1443, y: 242, size: 640 },
    aside: { x: 1768, y: 62, size: 150 },
  },
  pick: { x: 380, y: 104, k: 2.0 },
  banner: { x: 820 - 196 * 2.3, y: 300, k: 2.3 },
  left: { x: 210, y: 325, k: 1.85 },
  right: { x: 1060, y: 96, k: 1.6 },
  ask: { x: 300, xStart: 960 - 196 * 1.9, y: 150, yStart: 150, k: 1.9 },
  ask2: { x: 960 - 196 * 2.2, y: 279, k: 2.2 },
  source: { x: 1130, y: 416, k: 1.6 },
  askScroll: 1000,
  close: { k: 2.4, x: 960 - SEL.x * 2.4, y: 590 - SEL.y * 2.4 },
  after: { x: 285, y: -182, k: 1.55 },
  phone: { x: 380, y: 119, k: 0.92 },
  closing: { x: 1040, y: 430 },
  lockup: { x: 1000, y: 304, align: 'left', width: 760 },
  captions: {
    family: { x: 150, y: 862, align: 'left' },
    tap: { x: 369, y: 772, align: 'left' },
    fit: { x: 210, y: 176, align: 'left' },
    official: { x: 1130, y: 236, align: 'left' },
    guess: { x: 960, y: 905, align: 'center' },
  },
  captionSize: 50,
};

const PORTRAIT_CARD = 148 * 1.7;
export const PORTRAIT: Layout = {
  W: 1080,
  H: 1920,
  macro: { x: 540, y: 860, k: 12 },
  signalLostTop: 1010,
  household: {
    title: { x: 110, y: 410, size: 132, lines: ['Bago ang', 'bagyo'] },
    mood: { x: 114, y: 700, size: 40 },
    coin: { x: 700, y: 556 },
    k: 1.7,
    cards: [0, 1, 2, 3, 4].map((i) => ({ x: 138 + (i % 3) * (PORTRAIT_CARD + 24), y: 830 + Math.floor(i / 3) * (212 * 1.7 + 28) })),
    scroll: 1900,
  },
  mascot: {
    household: { x: 646, y: 1160, size: 480 },
    picker: { x: 384, y: 1496, size: 440 },
    aside: { x: 936, y: 64, size: 140 },
  },
  pick: { x: 128, y: 150, k: 2.1 },
  banner: { x: 540 - 196 * 2.55, y: 600, k: 2.55 },
  left: { x: 148, y: 150, k: 2.0 },
  right: { x: 148, y: 720, k: 2.0 },
  ask: { x: 540 - 196 * 2.3, xStart: 540 - 196 * 2.3, y: 200, yStart: 760, k: 2.3 },
  ask2: { x: 540 - 196 * 2.5, y: 700, k: 2.5 },
  source: { x: 148, y: 1220, k: 2.0 },
  askScroll: 1500,
  close: { k: 2.6, x: 540 - SEL.x * 2.6, y: 960 - SEL.y * 2.6 },
  after: { x: 540 - 206 * 2.3, y: 220 - 195 * 2.3, k: 2.3 },
  phone: { x: 540 - 206 * 1.02, y: 140, k: 1.02 },
  closing: { x: 189, y: 1520 },
  lockup: { x: 540, y: 1180, align: 'center', width: 900 },
  captions: {
    family: { x: 540, y: 1660, align: 'center' },
    tap: { x: 540, y: 1150, align: 'center' },
    fit: { x: 540, y: 632, align: 'center' },
    official: { x: 540, y: 1600, align: 'center' },
    guess: { x: 540, y: 1470, align: 'center' },
  },
  captionSize: 56,
};
