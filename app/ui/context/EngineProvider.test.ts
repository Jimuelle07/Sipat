import { describe, expect, it } from 'vitest';
import { resolveEngineKind } from './engineKind';

describe('resolveEngineKind', () => {
  it('selects the mock engine only for the explicit mock setting', () => {
    expect(resolveEngineKind('mock')).toBe('mock');
  });

  it.each([undefined, '', 'real', 'unexpected'])('defaults %s to the real engine', (configured) => {
    expect(resolveEngineKind(configured)).toBe('real');
  });
});
