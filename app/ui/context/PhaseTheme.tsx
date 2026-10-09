import type { JSX, ReactNode } from 'react';
import { ThemeProvider } from '../theme';
import { useEngine, useEngineChange } from './useEngine';

export function PhaseTheme({ children }: { children: ReactNode }): JSX.Element {
  const engine = useEngine();
  // The v2 contract adds 'phase'; add it to this list when that change kind is available.
  useEngineChange(['context']);
  const phase = engine.context.get().phase;

  return <ThemeProvider phase={phase}>{children}</ThemeProvider>;
}
