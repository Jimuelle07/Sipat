import { createContext, useContext, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, StatusBadge, StaleBanner, SwitchBanner } from '../components';
import { useLang, useT } from '../i18n';
import { errorMessage } from '../strings/errors';
import { commonStrings } from '../strings/common';
import { fill } from '../strings/format';
import { shouldShowSwitch } from '../screens/home/homeModel';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { useEngine, useEngineChange } from './useEngine';

export type DevScheme = 'system' | 'light' | 'dark';
export type DevLargeText = 'system' | 'on' | 'off';

interface DevOverridesValue {
  scheme: DevScheme;
  largeText: DevLargeText;
  setScheme: (scheme: DevScheme) => void;
  setLargeText: (largeText: DevLargeText) => void;
}

const DevOverridesContext = createContext<DevOverridesValue | null>(null);

export function DevOverridesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [scheme, setScheme] = useState<DevScheme>('system');
  const [largeText, setLargeText] = useState<DevLargeText>('system');
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const value = useMemo(() => ({ scheme, largeText, setScheme, setLargeText }), [scheme, largeText]);
  const seenValue = useMemo(() => ({ seenAt, setSeenAt }), [seenAt]);
  return (
    <DevOverridesContext.Provider value={value}>
      <SeenSwitchContext.Provider value={seenValue}>{children}</SeenSwitchContext.Provider>
    </DevOverridesContext.Provider>
  );
}

export function useDevOverrides(): DevOverridesValue {
  const value = useContext(DevOverridesContext);
  if (!value) throw new Error('useDevOverrides must be used inside DevOverridesProvider');
  return value;
}

const SeenSwitchContext = createContext<{ seenAt: string | null; setSeenAt: (at: string | null) => void } | null>(null);

export function AppBanners(): JSX.Element | null {
  const engine = useEngine();
  const lang = useLang().lang;
  const t = useT(commonStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const seen = useContext(SeenSwitchContext);
  useEngineChange(['phase', 'context', 'status', 'settings']);
  const context = engine.context.get();
  const lastSwitch = context.lastSwitch;
  const stale = engine.status().stale;

  if (!seen) throw new Error('AppBanners must be used inside DevOverridesProvider');

  const showSwitch = shouldShowSwitch(lastSwitch, seen.seenAt)
    && lastSwitch?.to === context.phase
    && context.phaseSource !== 'manual';
  if (!showSwitch && stale === undefined) return null;

  const dismissSwitch = (): void => {
    if (lastSwitch) seen.setSeenAt(lastSwitch.at);
  };
  const undoSwitch = (): void => {
    engine.context.undoPhase();
    if (lastSwitch) seen.setSeenAt(lastSwitch.at);
  };
  const phaseCopyKey = lastSwitch?.to === 'during' ? 'phase_during' : 'phase_before';

  return (
    <View style={styles.banners}>
      {showSwitch && lastSwitch ? (
        <SwitchBanner
          text={engine.copy('phase_switched', { lang, vars: { phase: engine.copy(phaseCopyKey, { lang }) } })}
          reason={context.reason.text}
          emphasis={engine.copy(phaseCopyKey, { lang })}
          undoLabel={t.undo}
          onUndo={undoSwitch}
          dismissLabel={t.dismiss}
          onDismiss={dismissSwitch}
          revealKey={lastSwitch.at}
        />
      ) : null}
      {stale ? (
        <View style={[styles.staleWrap, { backgroundColor: theme.colors.dangerSurface.fill }]}>
          <StaleBanner text={engine.copy('stale_warning', { lang })} />
          <View style={styles.staleAction}>
            <Button label={t.staleReconfirm} onPress={() => engine.context.reconfirmWarning(stale.kind)} variant="tonal" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function StatusBadges(): JSX.Element {
  const engine = useEngine();
  const lang = useLang().lang;
  const t = useT(commonStrings);
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['status', 'settings']);
  const status = engine.status();
  const manualLowBattery = engine.settings.get().lowBatteryMode;
  const saverOn = status.battery?.saver === true;
  const lowBattery = manualLowBattery || saverOn || (!status.ai.allowed && status.ai.reason === 'low_battery');
  const busy = status.model === 'loading' || status.model === 'generating';
  const available = status.ai.allowed && (status.model === 'ready' || status.model === 'generating');
  const reason = !status.ai.allowed ? errorMessage(lang, 'ai', status.ai.reason) : null;
  const aiLabel = busy ? t.aiPreparing : available ? t.aiReady : t.aiUnavailable;
  const aiHint = reason ? fill(t.aiReasonHint, { reason }) : undefined;

  return (
    <View style={styles.badges}>
      <View accessible accessibilityRole="text" accessibilityLabel={aiLabel} accessibilityHint={aiHint}>
        <StatusBadge label={aiLabel} state={busy ? 'busy' : available ? 'on' : 'off'} icon={busy ? undefined : 'sparkles'} />
      </View>
      {lowBattery ? <StatusBadge label={saverOn && !manualLowBattery ? t.batterySaver : t.lowBattery} state="off" icon="battery-dead" /> : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  banners: { gap: t.space.sm },
  staleWrap: { borderRadius: t.radius.menu },
  staleAction: { alignItems: 'flex-end', paddingHorizontal: t.space.lg, paddingBottom: t.space.lg },
  badges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: t.space.xs },
});
