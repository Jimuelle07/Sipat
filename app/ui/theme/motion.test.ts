import { describe, expect, it } from 'vitest';
import { revealSchedule } from './motion';
import { buildTheme } from './themes';

const before = buildTheme({ phase: 'before', scheme: 'light', largeText: false });
const during = buildTheme({ phase: 'during', scheme: 'light', largeText: false });

describe('revealSchedule', () => {
  it('staggers four words and sums the tail durations (before)', () => {
    const { delays, total } = revealSchedule(4, before.motion);
    expect(delays).toEqual([0, 40, 80, 120]);
    expect(total).toBe(120 + 600 + 450);
  });

  it('returns an empty schedule for zero words', () => {
    expect(revealSchedule(0, before.motion)).toEqual({ delays: [], total: 0 });
  });

  it('collapses to a single fast fade under minimal motion (during)', () => {
    const { delays, total } = revealSchedule(5, during.motion);
    expect(delays).toEqual([0, 0, 0, 0, 0]);
    expect(total).toBe(during.motion.fast);
  });
});
