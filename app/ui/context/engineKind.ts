export type EngineKind = 'real' | 'mock';

export function resolveEngineKind(configured: string | undefined): EngineKind {
  return configured === 'mock' ? 'mock' : 'real';
}
