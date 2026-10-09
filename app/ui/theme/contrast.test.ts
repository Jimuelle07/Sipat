import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('returns 0 for black', () => {
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('accepts lowercase hex', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
  });
});

describe('contrastRatio', () => {
  it('is 21 for white on black', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('is 1 for a color against itself', () => {
    expect(contrastRatio('#767676', '#767676')).toBeCloseTo(1, 6);
  });

  it('is symmetric, regardless of argument order', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#767676'),
      10,
    );
  });

  it('is about 4.54 for #767676 on white', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('accepts lowercase hex', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
});
