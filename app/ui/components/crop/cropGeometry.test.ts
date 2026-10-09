import { describe, expect, it } from 'vitest';
import type { Rect } from './cropGeometry';
import { clampCrop, moveCrop, scaleCrop, toPixels } from './cropGeometry';

const EPS = 1e-9;
const PORTRAIT = 0.75;
const LANDSCAPE = 4 / 3;

const isSquare = (r: Rect, aspect: number): boolean => Math.abs(r.width * aspect - r.height) < EPS;

const inBounds = (r: Rect): boolean =>
  r.x >= -EPS && r.y >= -EPS && r.x + r.width <= 1 + EPS && r.y + r.height <= 1 + EPS;

const center = (r: Rect): { cx: number; cy: number } => ({
  cx: r.x + r.width / 2,
  cy: r.y + r.height / 2,
});

const expectRect = (r: Rect, e: Rect): void => {
  expect(r.x).toBeCloseTo(e.x, 9);
  expect(r.y).toBeCloseTo(e.y, 9);
  expect(r.width).toBeCloseTo(e.width, 9);
  expect(r.height).toBeCloseTo(e.height, 9);
};

describe('clampCrop', () => {
  it('returns an in-bounds square unchanged (aspect 1)', () => {
    const crop: Rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
    expect(clampCrop(crop, 1)).toEqual(crop);
  });

  it('keeps center and uses the smaller pixel side for a non-square input', () => {
    const crop: Rect = { x: 0.1, y: 0.1, width: 0.6, height: 0.4 };
    const out = clampCrop(crop, 1);
    expectRect(out, { x: 0.2, y: 0.1, width: 0.4, height: 0.4 });
    expect(isSquare(out, 1)).toBe(true);
    expect(center(out)).toEqual(center(crop));
  });

  it('shifts a rect hanging off the right/bottom edge back inside, size kept', () => {
    const out = clampCrop({ x: 0.8, y: 0.8, width: 0.4, height: 0.4 }, 1);
    expectRect(out, { x: 0.6, y: 0.6, width: 0.4, height: 0.4 });
    expect(inBounds(out)).toBe(true);
  });

  it('shrinks a rect larger than the image to the largest square that fits (short side)', () => {
    const squareAspect1 = clampCrop({ x: 0, y: 0, width: 2, height: 2 }, 1);
    expectRect(squareAspect1, { x: 0, y: 0, width: 1, height: 1 });

    const portrait = clampCrop({ x: 0, y: 0, width: 5, height: 5 }, PORTRAIT);
    expectRect(portrait, { x: 0, y: 0.25, width: 1, height: 0.75 });
    expect(isSquare(portrait, PORTRAIT)).toBe(true);
    expect(inBounds(portrait)).toBe(true);

    const landscape = clampCrop({ x: 0, y: 0, width: 5, height: 5 }, LANDSCAPE);
    expectRect(landscape, { x: 0.25, y: 0, width: 0.75, height: 1 });
    expect(isSquare(landscape, LANDSCAPE)).toBe(true);
    expect(inBounds(landscape)).toBe(true);
  });

  it('keeps a pixel-square rect unchanged in portrait and landscape', () => {
    const portrait: Rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.375 };
    expect(clampCrop(portrait, PORTRAIT)).toEqual(portrait);

    const landscape: Rect = { x: 0.5, y: 0.3, width: 0.45, height: 0.6 };
    expect(clampCrop(landscape, LANDSCAPE)).toEqual(landscape);
  });

  it('re-squares a non-square rect in portrait using the smaller pixel side', () => {
    const crop: Rect = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    const out = clampCrop(crop, PORTRAIT);
    // width_px = 0.4 * W = 0.3H; height_px = 0.4H; smaller side is the width.
    expectRect(out, { x: 0.2, y: 0.25, width: 0.4, height: 0.3 });
    expect(isSquare(out, PORTRAIT)).toBe(true);
    expect(center(out)).toEqual(center(crop));
  });
});

describe('moveCrop', () => {
  it('translates then clamps, keeping the size', () => {
    const crop: Rect = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
    const out = moveCrop(crop, 0.1, 0.05, 1);
    expectRect(out, { x: 0.4, y: 0.35, width: 0.4, height: 0.4 });
    expect(out.width).toBe(crop.width);
    expect(out.height).toBe(crop.height);
  });

  it('pins to the bottom-right edge when moved far past it', () => {
    const crop: Rect = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
    const out = moveCrop(crop, 5, 5, 1);
    expectRect(out, { x: 0.6, y: 0.6, width: 0.4, height: 0.4 });
  });

  it('pins to the top-left edge when moved far past it', () => {
    const crop: Rect = { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
    const out = moveCrop(crop, -5, -5, 1);
    expectRect(out, { x: 0, y: 0, width: 0.4, height: 0.4 });
  });

  it('keeps size and clamps different x/y limits in portrait', () => {
    const crop: Rect = { x: 0.3, y: 0.3, width: 0.4, height: 0.3 };
    const out = moveCrop(crop, 5, 5, PORTRAIT);
    expectRect(out, { x: 0.6, y: 0.7, width: 0.4, height: 0.3 });
    expect(out.width).toBe(crop.width);
    expect(out.height).toBe(crop.height);
  });
});

describe('scaleCrop', () => {
  it('doubles the pixel side around the center when room allows', () => {
    const out = scaleCrop({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, 2, 1);
    expectRect(out, { x: 0.3, y: 0.3, width: 0.4, height: 0.4 });
  });

  it('never exceeds the short side', () => {
    const out = scaleCrop({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, 100, 1);
    expectRect(out, { x: 0, y: 0, width: 1, height: 1 });
    expect(isSquare(out, 1)).toBe(true);
    expect(inBounds(out)).toBe(true);
  });

  it('never goes smaller than minSize (default 0.2 of the short side)', () => {
    const out = scaleCrop({ x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, 0.001, 1);
    expectRect(out, { x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
  });

  it('honours a custom minSize', () => {
    const out = scaleCrop({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, 0.001, 1, 0.5);
    expectRect(out, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('scales a pixel-square around its center in portrait', () => {
    const out = scaleCrop({ x: 0.3, y: 0.3, width: 0.4, height: 0.3 }, 2, PORTRAIT);
    expectRect(out, { x: 0.1, y: 0.15, width: 0.8, height: 0.6 });
    expect(isSquare(out, PORTRAIT)).toBe(true);
    expect(inBounds(out)).toBe(true);
  });

  it('clamps to the short side in portrait', () => {
    const out = scaleCrop({ x: 0.3, y: 0.3, width: 0.4, height: 0.3 }, 100, PORTRAIT);
    expectRect(out, { x: 0, y: 0.075, width: 1, height: 0.75 });
    expect(isSquare(out, PORTRAIT)).toBe(true);
    expect(inBounds(out)).toBe(true);
  });

  it('applies the default minSize as a fraction of the short side in portrait', () => {
    const out = scaleCrop({ x: 0.3, y: 0.3, width: 0.5, height: 0.375 }, 0.001, PORTRAIT);
    expectRect(out, { x: 0.45, y: 0.4125, width: 0.2, height: 0.15 });
    expect(isSquare(out, PORTRAIT)).toBe(true);
    expect(inBounds(out)).toBe(true);
  });
});

describe('toPixels', () => {
  it('maps relative units to preview pixels', () => {
    const out = toPixels({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 }, 400, 300);
    expect(out.left).toBeCloseTo(40, 9);
    expect(out.top).toBeCloseTo(60, 9);
    expect(out.width).toBeCloseTo(200, 9);
    expect(out.height).toBeCloseTo(75, 9);
  });
});

describe('property loop (seeded LCG)', () => {
  const makeLcg = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  };

  it('clampCrop/moveCrop/scaleCrop always return in-bounds pixel squares', () => {
    const rnd = makeLcg(20240607);
    const aspects = [1, PORTRAIT, LANDSCAPE];

    for (let i = 0; i < 50; i++) {
      const aspect = aspects[i % aspects.length] as number;
      const input: Rect = {
        x: rnd() * 2 - 0.5,
        y: rnd() * 2 - 0.5,
        width: rnd() * 2,
        height: rnd() * 2,
      };

      const clamped = clampCrop(input, aspect);
      expect(inBounds(clamped)).toBe(true);
      expect(isSquare(clamped, aspect)).toBe(true);

      const moved = moveCrop(clamped, rnd() * 6 - 3, rnd() * 6 - 3, aspect);
      expect(inBounds(moved)).toBe(true);
      expect(isSquare(moved, aspect)).toBe(true);
      expect(moved.width).toBeCloseTo(clamped.width, 9);
      expect(moved.height).toBeCloseTo(clamped.height, 9);

      const scaled = scaleCrop(clamped, 0.05 + rnd() * 4, aspect);
      expect(inBounds(scaled)).toBe(true);
      expect(isSquare(scaled, aspect)).toBe(true);
    }
  });
});
