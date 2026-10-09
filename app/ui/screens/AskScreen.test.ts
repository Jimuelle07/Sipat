import { describe, expect, it } from 'vitest';
import { askStrings } from '../strings/ask';
import { canSend, counterText, usedIds } from './ask/chat';

describe('ask input guardrails', () => {
  it('accepts 1..maxLength trimmed characters', () => {
    expect(canSend('', 200)).toBe(false);
    expect(canSend('   ', 200)).toBe(false);
    expect(canSend('  ano ang go bag?  ', 200)).toBe(true);
    expect(canSend('a'.repeat(200), 200)).toBe(true);
    expect(canSend('a'.repeat(201), 200)).toBe(false);
  });
});

describe('counter copy', () => {
  it('fills the count and max placeholders with data', () => {
    expect(counterText(askStrings.tl.counter, 7, 200)).toBe('7/200');
    expect(counterText(askStrings.en.counter, 0, 200)).toBe('0/200');
  });

  it('keeps the template free of typed digits', () => {
    expect(askStrings.tl.counter).not.toMatch(/[0-9]/);
    expect(askStrings.en.counter).not.toMatch(/[0-9]/);
  });
});

describe('final source ids', () => {
  it('de-duplicates while keeping order', () => {
    expect(usedIds(['p1', 'p2', 'p1'])).toEqual(['p1', 'p2']);
    expect(usedIds([])).toEqual([]);
  });
});

describe('ask strings', () => {
  const keys = Object.keys(askStrings.tl) as (keyof typeof askStrings.tl)[];

  it('has a non-empty value for every key in both languages', () => {
    for (const key of keys) {
      expect(askStrings.tl[key].length).toBeGreaterThan(0);
      expect(askStrings.en[key].length).toBeGreaterThan(0);
    }
  });

  it('offers three example questions to start from', () => {
    expect(askStrings.tl.example_go_bag.length).toBeGreaterThan(0);
    expect(askStrings.tl.example_flood.length).toBeGreaterThan(0);
    expect(askStrings.tl.example_evacuation.length).toBeGreaterThan(0);
  });
});
