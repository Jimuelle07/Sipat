import { createContext, useContext, useEffect, useState } from 'react';
import type { Context } from 'react';
import type { Engine, EngineChange } from '../../engine';
import type { EngineKind } from './engineKind';

export type EngineContextValue = Engine & {
  engine: Engine;
  engineKind: EngineKind;
  switchEngine: (kind: EngineKind) => void;
};

export const EngineContext: Context<EngineContextValue | null> = createContext<EngineContextValue | null>(null);

/** Returns the engine directly, with its provider metadata available as properties. */
export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext);
  if (value === null) throw new Error('useEngine must be used inside EngineProvider');
  return value;
}

export function useEngineChange(kinds: EngineChange[]): number {
  const engine = useEngine();
  const [revision, setRevision] = useState(0);
  const kindsKey = kinds.join(',');

  useEffect(() => {
    const wanted = kindsKey.length > 0 ? (kindsKey.split(',') as EngineChange[]) : [];
    return engine.onChange((change) => {
      if (wanted.includes(change)) setRevision((r) => r + 1);
    });
  }, [engine, kindsKey]);

  return revision;
}
