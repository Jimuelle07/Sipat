import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { createEngine, createMockEngine } from '../../engine';
import type { Engine } from '../../engine';
import { Tile, Txt } from '../components';
import { commonStrings } from '../strings/common';
import { ThemeProvider, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { resolveEngineKind } from './engineKind';
import type { EngineKind } from './engineKind';
import { EngineContext } from './useEngine';

type ProviderState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: string };

function makeEngine(kind: EngineKind): Engine {
  return kind === 'mock' ? createMockEngine() : createEngine();
}

function StartupScreen({ fatal }: { fatal: boolean }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.center}>
      <Tile>
        <Txt role="title" accessibilityRole="header">
          {fatal ? commonStrings.tl.fatal : commonStrings.tl.loading}
        </Txt>
      </Tile>
    </View>
  );
}

export function EngineProvider({ kind: requestedKind, children }: { kind?: EngineKind; children: ReactNode }): JSX.Element {
  const [engineKind, setEngineKind] = useState<EngineKind>(() => requestedKind ?? resolveEngineKind(process.env.EXPO_PUBLIC_ENGINE));
  const [engine, setEngine] = useState<Engine>(() => makeEngine(requestedKind ?? resolveEngineKind(process.env.EXPO_PUBLIC_ENGINE)));
  const [state, setState] = useState<ProviderState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    engine.init()
      .then((result) => {
        if (!active) return;
        setState(result.ok ? { kind: 'ready' } : { kind: 'error', code: result.error.code });
      })
      .catch(() => {
        if (active) setState({ kind: 'error', code: 'storage_failed' });
      });
    return () => { active = false; };
  }, [engine]);

  const switchEngine = useCallback((kind: EngineKind): void => {
    try {
      const next = makeEngine(kind);
      setState({ kind: 'loading' });
      setEngineKind(kind);
      setEngine(next);
    } catch {
      setState({ kind: 'error', code: 'storage_failed' });
    }
  }, []);

  const value = useMemo(() => ({ ...engine, engine, engineKind, switchEngine }), [engine, engineKind, switchEngine]);

  if (state.kind !== 'ready') {
    return (
      <ThemeProvider phase="before">
        <StartupScreen fatal={state.kind === 'error'} />
      </ThemeProvider>
    );
  }

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: t.space.gutter,
    backgroundColor: t.colors.canvas,
  },
});
