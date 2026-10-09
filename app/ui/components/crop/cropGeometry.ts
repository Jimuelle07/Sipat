export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 1e-9;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isSquare = (r: Rect, aspect: number): boolean =>
  Math.abs(r.width * aspect - r.height) < EPS;

const inBounds = (r: Rect): boolean =>
  r.x >= -EPS && r.y >= -EPS && r.x + r.width <= 1 + EPS && r.y + r.height <= 1 + EPS;

const snap = (value: number, target: number): number =>
  Math.abs(value - target) < EPS ? target : value;

const recentered = (start: number, oldSize: number, newSize: number): number =>
  clamp(start + (oldSize - newSize) / 2, 0, 1 - newSize);

const recenterRect = (crop: Rect, width: number, height: number): Rect => ({
  x: recentered(crop.x, crop.width, width),
  y: recentered(crop.y, crop.height, height),
  width,
  height,
});

export function clampCrop(crop: Rect, aspect: number): Rect {
  if (isSquare(crop, aspect) && inBounds(crop)) {
    return { ...crop };
  }

  const side = Math.min(crop.width * aspect, crop.height, aspect, 1);
  return recenterRect(crop, snap(side / aspect, crop.width), snap(side, crop.height));
}

export function moveCrop(crop: Rect, dx: number, dy: number, _aspect: number): Rect {
  return {
    x: clamp(crop.x + dx, 0, 1 - crop.width),
    y: clamp(crop.y + dy, 0, 1 - crop.height),
    width: crop.width,
    height: crop.height,
  };
}

export function scaleCrop(crop: Rect, factor: number, aspect: number, minSize = 0.2): Rect {
  const shortSide = Math.min(aspect, 1);
  const currentSide = Math.min(crop.width * aspect, crop.height);
  const side = clamp(currentSide * factor, minSize * shortSide, shortSide);

  return recenterRect(crop, side / aspect, side);
}

export function toPixels(
  r: Rect,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: r.x * width,
    top: r.y * height,
    width: r.width * width,
    height: r.height * height,
  };
}
