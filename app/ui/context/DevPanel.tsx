import { createContext, useContext, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Tile } from '../components/Tile';
import { Txt } from '../components/Txt';
import { useT } from '../i18n';
import { devStrings } from '../strings/dev';
import { useDevOverrides } from './AppChrome';
import { useEngine, useEngineChange } from './useEngine';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import type { FaceDetection, FeedError, LocationError, MockEngine, MockScenario, ModelInstallError, PhotoError } from '../../engine';

const DevPanelContext = createContext<{ expanded: boolean; setExpanded: (value: boolean) => void } | null>(null);

export function DevPanelProvider({ children }: { children: ReactNode }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return <DevPanelContext.Provider value={{ expanded, setExpanded }}>{children}</DevPanelContext.Provider>;
}

function useDevPanelState(): { expanded: boolean; setExpanded: (value: boolean) => void } {
  const value = useContext(DevPanelContext);
  if (!value) throw new Error('DevPanel must be used inside DevPanelProvider');
  return value;
}

export function DevPanelEntry(): JSX.Element | null {
  const engine = useEngine();
  const t = useT(devStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { setExpanded } = useDevPanelState();
  if (!('debug' in engine)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.open}
      onPress={() => setExpanded(true)}
      style={styles.entry}
    >
      <Ionicons name="construct-outline" size={theme.type.roles.title.fontSize} color={theme.colors.ink} />
    </Pressable>
  );
}

type LabelKey = keyof typeof devStrings.tl;

/** One collapsible group: a tappable header row, content only while open. */
function ControlSection({ title, children, open, onToggle }: { title: string; children: ReactNode; open: boolean; onToggle: () => void }): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={[styles.groupHead, open && styles.groupHeadOpen]}
      >
        <Txt role="label" style={styles.groupTitle}>{title}</Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={theme.type.roles.title.fontSize} color={theme.colors.ink} />
      </Pressable>
      {open ? <View style={styles.groupBody}>{children}</View> : null}
    </View>
  );
}

export function DevPanel({ global = false }: { global?: boolean }): JSX.Element | null {
  const engine = useEngine();
  const t = useT(devStrings);
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const overrides = useDevOverrides();
  useEngineChange(['context', 'status']);
  const { expanded, setExpanded } = useDevPanelState();
  const [section, setSection] = useState<string | null>(null);
  const [scenario, setScenario] = useState<MockScenario | 'keyword'>('keyword');
  const [statusPreset, setStatusPreset] = useState<'battery' | 'saver' | 'lite' | 'none' | 'clear'>('clear');
  const [photoPreset, setPhotoPreset] = useState<FaceDetection | PhotoError>('one_face');
  const [installPreset, setInstallPreset] = useState<'installed' | ModelInstallError>('installed');
  const [feedPreset, setFeedPreset] = useState<'off' | 'empty' | 'fresh' | 'stale' | 'near' | 'signal_here' | 'track_approach' | 'left' | FeedError>('fresh');
  const [locationPreset, setLocationPreset] = useState<'ok' | LocationError>('ok');

  if (!global || !('debug' in engine)) return null;
  const debug = (engine as typeof engine & { debug: MockEngine['debug'] }).debug;
  const firstWarning = engine.context.cards()[0];

  const scenarioItems: { value: MockScenario | 'keyword'; label: LabelKey }[] = [
    { value: 'keyword', label: 'keyword' },
    { value: 'guide_full', label: 'guideFull' },
    { value: 'guide_critical', label: 'guideCritical' },
    { value: 'emergency_then_guide', label: 'emergencyGuide' },
    { value: 'refusal', label: 'refusal' },
    { value: 'live_data', label: 'liveData' },
    { value: 'live_data_bulletin', label: 'liveBulletin' },
    { value: 'medical_dose', label: 'medicalDose' },
    { value: 'plan_center', label: 'planCenter' },
    { value: 'plan_empty', label: 'planEmpty' },
    { value: 'ai_rejected', label: 'aiRejected' },
    { value: 'low_battery', label: 'lowBatteryScenario' },
    { value: 'no_model', label: 'noModel' },
    { value: 'phase_cue_during', label: 'phaseDuring' },
    { value: 'phase_cue_after', label: 'phaseAfter' },
  ];
  const photoItems: { value: FaceDetection | PhotoError; label: LabelKey }[] = [
    { value: 'one_face', label: 'oneFace' }, { value: 'no_face', label: 'noFace' },
    { value: 'many_faces', label: 'manyFaces' }, { value: 'unavailable', label: 'unavailableFace' },
    { value: 'permission_denied', label: 'permissionDenied' }, { value: 'no_camera', label: 'noCamera' },
    { value: 'unreadable', label: 'unreadable' }, { value: 'draft_expired', label: 'draftExpired' },
    { value: 'not_found', label: 'notFound' }, { value: 'io', label: 'ioError' },
  ];
  const installItems: { value: 'installed' | ModelInstallError; label: LabelKey }[] = [
    { value: 'installed', label: 'installed' }, { value: 'tier', label: 'tierError' },
    { value: 'no_space', label: 'noSpace' }, { value: 'wrong_file', label: 'wrongFile' },
    { value: 'hash_mismatch', label: 'hashMismatch' }, { value: 'cancelled', label: 'cancelled' },
    { value: 'io', label: 'installIo' },
  ];
  const feedItems: { value: 'off' | 'empty' | 'fresh' | 'stale' | 'near' | 'signal_here' | 'track_approach' | 'left' | FeedError; label: LabelKey }[] = [
    { value: 'off', label: 'feedOff' }, { value: 'empty', label: 'feedEmpty' },
    { value: 'fresh', label: 'feedFresh' }, { value: 'stale', label: 'feedStale' },
    { value: 'near', label: 'feedNear' }, { value: 'signal_here', label: 'signalHere' },
    { value: 'track_approach', label: 'trackApproach' }, { value: 'left', label: 'stormLeft' },
    { value: 'disabled', label: 'feedDisabled' }, { value: 'offline', label: 'offline' },
    { value: 'http', label: 'http' }, { value: 'unknown_key', label: 'unknownKey' },
    { value: 'key_expired', label: 'keyExpired' }, { value: 'bad_signature', label: 'badSignature' },
    { value: 'app_too_old', label: 'appTooOld' }, { value: 'rollback', label: 'rollback' },
    { value: 'hash_mismatch', label: 'feedHashMismatch' }, { value: 'schema', label: 'schema' },
  ];
  const locationItems: { value: 'ok' | LocationError; label: LabelKey }[] = [
    { value: 'ok', label: 'gpsOk' }, { value: 'permission_denied', label: 'locationPermission' },
    { value: 'services_off', label: 'servicesOff' }, { value: 'unavailable', label: 'unavailableLocation' },
    { value: 'unknown_place', label: 'unknownPlace' },
  ];

  const chips = <T extends string>(items: { value: T; label: LabelKey }[], selected: T, onSelect: (value: T) => void) => (
    <View style={styles.chips}>
      {items.map((item) => (
        <Chip key={item.value} label={t[item.label]} selected={selected === item.value} onPress={() => onSelect(item.value)} />
      ))}
    </View>
  );

  const setStatus = (preset: 'battery' | 'saver' | 'lite' | 'none' | 'clear'): void => {
    const patch = preset === 'battery'
      ? { tier: 'full' as const, model: 'ready' as const, battery: { level: 10, charging: false, saver: false } }
      : preset === 'saver'
        ? { tier: 'full' as const, model: 'ready' as const, battery: { level: 80, charging: false, saver: true } }
        : preset === 'lite'
          ? { tier: 'lite' as const, model: 'ready' as const, battery: { level: 80, charging: false, saver: false } }
          : preset === 'none'
            ? { tier: 'none' as const, model: 'ready' as const, battery: { level: 80, charging: false, saver: false } }
            : { tier: 'full' as const, model: 'ready' as const, battery: { level: 80, charging: false, saver: false }, ai: { allowed: true as const } };
    debug.setStatus(patch);
    setStatusPreset(preset);
  };

  const stateItems: { value: string; label: LabelKey; onPress: () => void }[] = [
    { value: 'battery', label: 'batteryLow', onPress: () => setStatus('battery') },
    { value: 'saver', label: 'saverOn', onPress: () => setStatus('saver') },
    { value: 'lite', label: 'tierLite', onPress: () => setStatus('lite') },
    { value: 'none', label: 'tierNone', onPress: () => setStatus('none') },
    { value: 'clear', label: 'statusClear', onPress: () => setStatus('clear') },
  ];

  if (!expanded) return null;

  return (
    <View style={styles.anchor}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Txt role="title" style={styles.groupTitle}>{t.title}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={() => setExpanded(false)} style={styles.entry}>
              <Ionicons name="close" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.sections} showsVerticalScrollIndicator={false}>
            <ControlSection title={t.scenario} open={section === 'scenario'} onToggle={() => setSection(section === 'scenario' ? null : 'scenario')}>
              {chips(scenarioItems, scenario, (value) => { setScenario(value); debug.setScenario(value === 'keyword' ? null : value); })}
            </ControlSection>
            <ControlSection title={t.status} open={section === 'status'} onToggle={() => setSection(section === 'status' ? null : 'status')}>
              <View style={styles.chips}>{stateItems.map((item) => <Chip key={item.value} label={t[item.label]} selected={statusPreset === item.value} onPress={item.onPress} />)}</View>
              <View style={styles.chips}>
                <Button
                  label={t.markStale}
                  onPress={() => {
                    if (firstWarning) debug.setStatus({ stale: { kind: firstWarning.kind, hoursSinceSet: firstWarning.hoursSinceSet } });
                  }}
                  disabled={!firstWarning}
                  accessibilityHint={!firstWarning ? t.staleNeedsWarning : undefined}
                  variant="tonal"
                />
                <Button label={t.clearStale} onPress={() => debug.setStatus({ stale: undefined })} variant="outline" />
              </View>
              {!firstWarning ? <Txt role="bodySmall" tone="muted">{t.staleNeedsWarning}</Txt> : null}
            </ControlSection>
            <ControlSection title={t.photo} open={section === 'photo'} onToggle={() => setSection(section === 'photo' ? null : 'photo')}>
              {chips(photoItems, photoPreset, (value) => { setPhotoPreset(value); debug.setPhotoResult(value); })}
            </ControlSection>
            <ControlSection title={t.modelInstall} open={section === 'modelInstall'} onToggle={() => setSection(section === 'modelInstall' ? null : 'modelInstall')}>
              {chips(installItems, installPreset, (value) => { setInstallPreset(value); debug.setModelInstallResult(value); })}
            </ControlSection>
            <ControlSection title={t.feed} open={section === 'feed'} onToggle={() => setSection(section === 'feed' ? null : 'feed')}>
              {chips(feedItems, feedPreset, (value) => { setFeedPreset(value); debug.setFeed(value); })}
            </ControlSection>
            <ControlSection title={t.gps} open={section === 'gps'} onToggle={() => setSection(section === 'gps' ? null : 'gps')}>
              {chips(locationItems, locationPreset, (value) => { setLocationPreset(value); debug.setLocationResult(value); })}
            </ControlSection>
            <ControlSection title={t.appearance} open={section === 'appearance'} onToggle={() => setSection(section === 'appearance' ? null : 'appearance')}>
              <Txt role="label">{t.largeText}</Txt>
              {chips([
                { value: 'system' as const, label: 'system' }, { value: 'on' as const, label: 'on' }, { value: 'off' as const, label: 'off' },
              ], overrides.largeText, overrides.setLargeText)}
            </ControlSection>
            <ControlSection title={t.engine} open={section === 'engine'} onToggle={() => setSection(section === 'engine' ? null : 'engine')}>
              <View style={styles.chips}>
                <Chip label={t.mock} selected={engine.engineKind === 'mock'} onPress={() => engine.switchEngine('mock')} />
                <Chip label={t.real} selected={engine.engineKind === 'real'} onPress={() => engine.switchEngine('real')} />
              </View>
              <Button label={t.reset} onPress={() => { debug.reset(); setScenario('keyword'); setStatusPreset('clear'); setPhotoPreset('one_face'); setInstallPreset('installed'); setFeedPreset('fresh'); setLocationPreset('ok'); overrides.setScheme('system'); overrides.setLargeText('system'); }} variant="tonal" />
            </ControlSection>
          </ScrollView>
        </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, justifyContent: 'flex-end' },
  entry: {
    width: t.minTouch,
    height: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.surface,
  },
  panel: {
    height: '78%',
    padding: t.space.gutter,
    gap: t.space.md,
    backgroundColor: t.colors.canvas,
    borderTopLeftRadius: t.radius.panel,
    borderTopRightRadius: t.radius.panel,
    borderColor: t.colors.hairline,
    borderWidth: t.border.hairline,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.md },
  scroll: { flex: 1 },
  sections: { gap: t.space.gutter, paddingBottom: t.space.gutter },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  group: { gap: t.space.sm },
  groupHead: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    paddingHorizontal: t.space.xl,
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.surface,
    boxShadow: t.shadow.sticker,
  },
  groupHeadOpen: { backgroundColor: t.colors.selected.fill },
  groupTitle: { flex: 1 },
  groupBody: {
    gap: t.space.lg,
    padding: t.space.tile,
    borderRadius: t.radius.panel,
    borderWidth: t.border.control,
    borderColor: t.colors.controlBorder,
    backgroundColor: t.colors.surface,
  },
});
