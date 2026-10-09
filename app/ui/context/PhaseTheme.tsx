import type { JSX, ReactNode } from 'react';
import { ThemeProvider } from '../theme';
import { useEngine, useEngineChange } from './useEngine';

export function PhaseTheme({ children }: { children: ReactNode }): JSX.Element {
  const engine = useEngine();
  // The current EngineChange contract emits context when the phase changes.
  useEngineChange(['context']);
  const phase = engine.context.get().phase;

  return <ThemeProvider phase={phase}>{children}</ThemeProvider>;
}
