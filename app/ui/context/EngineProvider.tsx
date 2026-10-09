import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createEngine, createMockEngine } from '../../engine';
import type { Engine } from '../../engine';
import { resolveEngineKind } from './engineKind';
import type { EngineKind } from './engineKind';
import { colors, font, space } from '../theme';
import { strings } from '../strings';
import { Card, InlineError } from '../components';
import { EngineContext } from './useEngine';

type ProviderState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: string };

function makeEngine(kind: EngineKind): Engine {
  return kind === 'mock' ? createMockEngine() : createEngine();
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
    const language = engine.settings.get().language ?? 'tl';
    const copy = strings[language];
    return <View style={styles.center}><Card title={copy.loading}>{state.kind === 'error' ? <InlineError message={`${copy.failed} (${state.code})`} /> : <Text style={styles.text}>{copy.loading}</Text>}</Card></View>;
  }

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, backgroundColor: colors.bg },
  text: { color: colors.text, fontSize: font.md },
});
