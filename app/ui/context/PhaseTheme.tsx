import type { JSX, ReactNode } from 'react';
import { useDevOverrides } from './AppChrome';
import { ThemeProvider } from '../theme';
import { useEngine, useEngineChange } from './useEngine';

export function PhaseTheme({ children }: { children: ReactNode }): JSX.Element {
  const engine = useEngine();
  useEngineChange(['phase', 'context']);
  const phase = engine.context.get().phase;
  const overrides = useDevOverrides();

  return (
    <ThemeProvider
      phase={phase}
      scheme={overrides.scheme === 'system' ? undefined : overrides.scheme}
      largeText={overrides.largeText === 'system' ? undefined : overrides.largeText === 'on'}
    >
      {children}
    </ThemeProvider>
  );
}
