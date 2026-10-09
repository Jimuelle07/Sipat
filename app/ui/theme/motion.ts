import type { Motion } from './types';

export function revealSchedule(wordCount: number, motion: Motion): { delays: number[]; total: number } {
  if (wordCount <= 0) return { delays: [], total: 0 };
  if (motion.style === 'minimal') {
    return { delays: Array.from({ length: wordCount }, () => 0), total: motion.fast };
  }

  const delays = Array.from({ length: wordCount }, (_, index) => index * motion.stagger);

  return { delays, total: (wordCount - 1) * motion.stagger + motion.reveal + motion.highlight };
}
