import type { JSX } from 'react';
import { useReducer, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DeviceTier, Settings } from '../../engine';
import { AppBanners } from '../context/AppChrome';
import { useEngine, useEngineChange } from '../context/useEngine';
import { Button, InlineError, LanguageToggle, ProgressBar, Screen, Tag, Tile, ToggleRow, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { errorMessage } from '../strings/errors';
import { settingsStrings } from '../strings/settings';
import type { RootNavigation } from '../navigation/types';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { AreaPicker } from './family/AreaPicker';
import { installReducer, progressFraction } from './settings/modelInstall';
import type { InstallState } from './settings/modelInstall';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ConfirmTarget = 'history' | 'photos' | null;

/**
 * Settings (stack). Language, the AI switch and model install, the low-battery policy, the
 * device status line, the household area, privacy actions and the links to the secondary
 * screens. Everything the engine returns is shown as-is; numbers come from `settings.get()`.
 */
export function SettingsScreen(): JSX.Element {
  const engine = useEngine();
  const nav = useNavigation<RootNavigation>();
  const theme = useTheme();
  const t = useT(settingsStrings);
  const base = useT(commonStrings);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['settings', 'status', 'profiles', 'packs', 'history']);

  const settings = engine.settings.get();
  const status = engine.status();
  const info = engine.info();
  const model = info.model;

  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<{ key: 'lowBatteryThreshold' | 'staleWarningHours'; message: string } | null>(null);
  const [install, dispatch] = useReducer(installReducer, { kind: 'idle' } as InstallState);
  const controllerRef = useRef<AbortController | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const [historyDone, setHistoryDone] = useState(false);
  const [photosDone, setPhotosDone] = useState(false);

  const updateSetting = (patch: Partial<Settings>): void => {
    const result = engine.settings.update(patch);
    setStepError(null);
    setError(result.ok ? null : errorMessage(lang, 'settings', result.error.code));
  };
  const step = (key: 'lowBatteryThreshold' | 'staleWarningHours', delta: number): void => {
    const result = engine.settings.update({ [key]: settings[key] + delta });
    setError(null);
    if (result.ok) {
      setStepError(null);
      return;
    }
    const message = errorMessage(lang, 'settings', result.error.code);
    setStepError(message === null ? null : { key, message });
  };
  const startInstall = async (): Promise<void> => {
    dispatch({ type: 'start' });
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await engine.model.installFromPicker(
        (bytes, total) => dispatch({ type: 'progress', bytes, total }),
        controller.signal,
      );
      if (!result.ok && result.error.code === 'cancelled') dispatch({ type: 'reset' });
      else dispatch({ type: 'result', result });
    } catch {
      dispatch({ type: 'thrown' });
    } finally {
      controllerRef.current = null;
    }
  };
  const stopInstall = (): void => { controllerRef.current?.abort(); };
  const removeModel = async (): Promise<void> => {
    setRemoving(true);
    try { await engine.model.remove(); } finally { setRemoving(false); }
  };
  const clearHistory = (): void => { engine.history.clear(); setHistoryDone(true); setConfirm(null); };
  const removeAllPhotos = (): void => { engine.family.photos.removeAll(); setPhotosDone(true); setConfirm(null); };

  const tierLabels: Record<DeviceTier, string> = { full: t.tier_full, lite: t.tier_lite, none: t.tier_none };
  const aiStatus = status.ai.allowed
    ? t.aiReady
    : (errorMessage(lang, 'ai', status.ai.reason) ?? t.aiReady);
  const batteryStatus = status.battery
    ? `${status.battery.level}${t.percentSuffix}${status.battery.charging ? ` · ${t.batteryCharging}` : ''}${status.battery.saver ? ` · ${t.batterySaver}` : ''}`
    : t.batteryUnknown;

  return (
    <Screen
      title={t.title}
      hideLanguage
      back={{ label: t.back, onPress: () => nav.goBack() }}
      banner={<AppBanners />}
    >
      <Txt role="lead" tone="muted">{t.intro}</Txt>
      {error ? <InlineError message={error} /> : null}

      <Tile title={t.languageSection}>
        <Txt role="bodySmall" tone="muted">{t.languageDescription}</Txt>
        <View style={styles.languageRow}>
          <LanguageToggle />
        </View>
      </Tile>

      <Tile title={t.aiSection}>
        <ToggleRow
          label={t.aiEnabled}
          description={settings.aiEnabled ? t.aiEnabledOn : t.aiEnabledOff}
          value={settings.aiEnabled}
          onValueChange={(value) => updateSetting({ aiEnabled: value })}
        />
        <Txt role="bodySmall" tone="muted">{t.aiDescription}</Txt>
      </Tile>

      <Tile title={t.modelSection}>
        {model.present ? (
          <View style={styles.block}>
            <View style={styles.modelHead}>
              <Ionicons name="sparkles-outline" size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
              <Txt role="body" style={styles.modelName} numberOfLines={2}>{model.fileName}</Txt>
              <Tag label={t.modelPresent} />
            </View>
            {install.kind === 'installed' ? <Txt role="bodySmall" tone="accent">{t.modelInstalled}</Txt> : null}
            <Txt role="bodySmall" tone="muted">{t.modelRemoveHint}</Txt>
            <Button
              label={t.modelRemove}
              variant="outline"
              icon="trash-outline"
              onPress={() => { void removeModel(); }}
              disabled={removing}
            />
          </View>
        ) : install.kind === 'copying' ? (
          <View style={styles.block}>
            <ProgressBar value={progressFraction(install)} label={t.modelInstalling} />
            <Button label={t.modelStop} variant="tonal" icon="stop-circle-outline" onPress={stopInstall} />
          </View>
        ) : (
          <View style={styles.block}>
            <Tag label={t.modelMissing} />
            <Txt role="bodySmall" tone="muted">{t.modelMissingHint}</Txt>
            {install.kind === 'installed' ? <Txt role="bodySmall" tone="accent">{t.modelInstalled}</Txt> : null}
            {install.kind === 'error' && install.code !== 'cancelled' ? (
              <InlineError message={errorMessage(lang, 'model_install', install.code) ?? ''} />
            ) : null}
            <Button label={t.modelInstall} icon="download-outline" onPress={() => { void startInstall(); }} />
          </View>
        )}
        <Txt role="caption" tone="muted">{model.attribution}</Txt>
      </Tile>

      <Tile title={t.statusSection}>
        <StatusRow label={t.tierLabel} value={tierLabels[status.tier]} />
        <StatusRow label={t.aiLabel} value={aiStatus} />
        <StatusRow label={t.batteryLabel} value={batteryStatus} />
      </Tile>

      <Tile title={t.lowBatterySection}>
        <ToggleRow
          label={t.lowBatteryMode}
          description={settings.lowBatteryMode ? t.lowBatteryModeOn : t.lowBatteryModeOff}
          value={settings.lowBatteryMode}
          onValueChange={(value) => updateSetting({ lowBatteryMode: value })}
        />
        <Txt role="bodySmall" tone="muted">{t.lowBatteryModeDescription}</Txt>
        <Stepper
          label={t.lowBatteryThreshold}
          value={settings.lowBatteryThreshold}
          suffix={t.percentSuffix}
          onStep={(delta) => step('lowBatteryThreshold', delta)}
          decreaseLabel={base.decrease}
          increaseLabel={base.increase}
          error={stepError?.key === 'lowBatteryThreshold' ? stepError.message : undefined}
        />
        <Stepper
          label={t.staleWarningHours}
          value={settings.staleWarningHours}
          suffix={` ${t.hoursSuffix}`}
          onStep={(delta) => step('staleWarningHours', delta)}
          decreaseLabel={base.decrease}
          increaseLabel={base.increase}
          error={stepError?.key === 'staleWarningHours' ? stepError.message : undefined}
        />
      </Tile>

      <Tile title={t.areaSection}>
        <AreaPicker onPicked={() => { setError(null); setStepError(null); }} />
      </Tile>

      <Tile title={t.privacySection}>
        <Txt role="bodySmall" tone="muted">{t.privacyNote}</Txt>
        {confirm === 'history' ? (
          <ConfirmBlock
            message={t.clearHistoryConfirm}
            confirmLabel={t.confirm}
            cancelLabel={t.cancel}
            onCancel={() => setConfirm(null)}
            onConfirm={clearHistory}
          />
        ) : (
          <Button label={t.clearHistory} variant="outline" icon="trash-outline" onPress={() => setConfirm('history')} />
        )}
        {historyDone ? <Txt role="bodySmall" tone="muted" accessibilityLiveRegion="polite">{t.clearHistoryDone}</Txt> : null}

        {confirm === 'photos' ? (
          <ConfirmBlock
            message={t.removeAllPhotosConfirm}
            confirmLabel={t.confirm}
            cancelLabel={t.cancel}
            onCancel={() => setConfirm(null)}
            onConfirm={removeAllPhotos}
          />
        ) : (
          <Button label={t.removeAllPhotos} variant="outline" icon="images-outline" onPress={() => setConfirm('photos')} />
        )}
        {photosDone ? <Txt role="bodySmall" tone="muted" accessibilityLiveRegion="polite">{t.removeAllPhotosDone}</Txt> : null}
      </Tile>

      <Tile title={t.moreSection}>
        <LinkRow icon="information-circle-outline" label={t.about} onPress={() => nav.navigate('About')} />
        <LinkRow icon="clipboard-outline" label={t.evaluation} onPress={() => nav.navigate('Evaluation')} />
        <LinkRow icon="person-circle-outline" label={t.account} onPress={() => nav.navigate('Account')} />
      </Tile>
    </Screen>
  );
}

function StatusRow({ label, value }: { label: string; value: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statusRow}>
      <Txt role="bodySmall" tone="muted" style={styles.statusLabel}>{label}</Txt>
      <Txt role="body" style={styles.statusValue}>{value}</Txt>
    </View>
  );
}

function Stepper({ label, value, suffix, onStep, decreaseLabel, increaseLabel, error }: {
  label: string;
  value: number;
  suffix: string;
  onStep: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  error?: string;
}): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <Txt role="label" style={styles.stepperLabel}>{label}</Txt>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${decreaseLabel} ${label}`}
          onPress={() => onStep(-1)}
          style={styles.stepperButton}
        >
          <Ionicons name="remove" size={theme.type.roles.title.fontSize} color={theme.colors.capsule.ink} />
        </Pressable>
        <Txt role="title" align="center" accessibilityLiveRegion="polite" style={styles.stepperValue}>{value}{suffix}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${increaseLabel} ${label}`}
          onPress={() => onStep(1)}
          style={styles.stepperButton}
        >
          <Ionicons name="add" size={theme.type.roles.title.fontSize} color={theme.colors.capsule.ink} />
        </Pressable>
      </View>
      {error !== undefined ? <InlineError message={error} /> : null}
    </View>
  );
}

function ConfirmBlock({ message, confirmLabel, cancelLabel, onCancel, onConfirm }: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.confirmBlock}>
      <Txt role="body">{message}</Txt>
      <View style={styles.confirmActions}>
        <Button label={cancelLabel} variant="tonal" onPress={onCancel} />
        <Button label={confirmLabel} variant="danger" icon="trash-outline" onPress={onConfirm} />
      </View>
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }): JSX.Element {
  return (
    <Button
      label={label}
      variant="outline"
      icon={icon}
      fullWidth
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  block: {
    gap: t.space.md,
  },
  modelHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.md,
  },
  modelName: {
    flex: 1,
  },
  statusRow: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.gutter,
  },
  statusLabel: {
    flexShrink: 1,
  },
  statusValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  stepper: {
    gap: t.space.sm,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
  },
  stepperLabel: {
    flexShrink: 1,
  },
  stepperButton: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.capsule.fill,
  },
  stepperValue: {
    flex: 1,
  },
  confirmBlock: {
    gap: t.space.md,
    paddingTop: t.space.md,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  confirmActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: t.space.sm,
  },
});
