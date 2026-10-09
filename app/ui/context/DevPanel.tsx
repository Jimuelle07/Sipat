import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Tile, Txt } from '../components';
import { useT } from '../i18n';
import { devStrings } from '../strings/dev';
import { useDevOverrides } from './AppChrome';
import { useEngine } from './useEngine';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import type { FaceDetection, FeedError, LocationError, MockEngine, MockScenario, ModelInstallError, PhotoError } from '../../engine';
import type { ReactNode } from 'react';

type LabelKey = keyof typeof devStrings.tl;

function ControlSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return <Tile title={title}>{children}</Tile>;
}

export function DevPanel(): JSX.Element | null {
  const engine = useEngine();
  const t = useT(devStrings);
  const styles = useThemedStyles(makeStyles);
  const overrides = useDevOverrides();
  const [expanded, setExpanded] = useState(false);
  const [scenario, setScenario] = useState<MockScenario | 'keyword'>('keyword');
  const [statusPreset, setStatusPreset] = useState<'battery' | 'saver' | 'lite' | 'none' | 'clear'>('clear');
  const [photoPreset, setPhotoPreset] = useState<FaceDetection | PhotoError>('one_face');
  const [installPreset, setInstallPreset] = useState<'installed' | ModelInstallError>('installed');
  const [feedPreset, setFeedPreset] = useState<'off' | 'empty' | 'fresh' | 'stale' | 'near' | 'signal_here' | 'track_approach' | 'left' | FeedError>('fresh');
  const [locationPreset, setLocationPreset] = useState<'ok' | LocationError>('ok');

  if (!('debug' in engine)) return null;
  const debug = (engine as typeof engine & { debug: MockEngine['debug'] }).debug;

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

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      {expanded ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Txt role="title">{t.title}</Txt>
            <Button label={t.close} onPress={() => setExpanded(false)} variant="text" />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.sections}>
            <ControlSection title={t.scenario}>
              {chips(scenarioItems, scenario, (value) => { setScenario(value); debug.setScenario(value === 'keyword' ? null : value); })}
            </ControlSection>
            <ControlSection title={t.status}>
              <View style={styles.chips}>{stateItems.map((item) => <Chip key={item.value} label={t[item.label]} selected={statusPreset === item.value} onPress={item.onPress} />)}</View>
            </ControlSection>
            <ControlSection title={t.photo}>
              {chips(photoItems, photoPreset, (value) => { setPhotoPreset(value); debug.setPhotoResult(value); })}
            </ControlSection>
            <ControlSection title={t.modelInstall}>
              {chips(installItems, installPreset, (value) => { setInstallPreset(value); debug.setModelInstallResult(value); })}
            </ControlSection>
            <ControlSection title={t.feed}>
              {chips(feedItems, feedPreset, (value) => { setFeedPreset(value); debug.setFeed(value); })}
            </ControlSection>
            <ControlSection title={t.gps}>
              {chips(locationItems, locationPreset, (value) => { setLocationPreset(value); debug.setLocationResult(value); })}
            </ControlSection>
            <ControlSection title={t.appearance}>
              <Txt role="label">{t.scheme}</Txt>
              {chips([
                { value: 'system' as const, label: 'system' }, { value: 'light' as const, label: 'light' }, { value: 'dark' as const, label: 'dark' },
              ], overrides.scheme, overrides.setScheme)}
              <Txt role="label">{t.largeText}</Txt>
              {chips([
                { value: 'system' as const, label: 'system' }, { value: 'on' as const, label: 'on' }, { value: 'off' as const, label: 'off' },
              ], overrides.largeText, overrides.setLargeText)}
            </ControlSection>
            <ControlSection title={t.engine}>
              <View style={styles.chips}>
                <Chip label={t.mock} selected={engine.engineKind === 'mock'} onPress={() => engine.switchEngine('mock')} />
                <Chip label={t.real} selected={engine.engineKind === 'real'} onPress={() => engine.switchEngine('real')} />
              </View>
              <Button label={t.reset} onPress={() => { debug.reset(); setScenario('keyword'); setStatusPreset('clear'); setPhotoPreset('one_face'); setInstallPreset('installed'); setFeedPreset('fresh'); setLocationPreset('ok'); overrides.setScheme('system'); overrides.setLargeText('system'); }} variant="tonal" />
            </ControlSection>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.launcher}>
          <Button label={t.open} onPress={() => setExpanded(true)} variant="tonal" icon="construct-outline" />
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  launcher: { alignSelf: 'flex-end', margin: t.space.gutter },
  panel: {
    maxHeight: '78%',
    padding: t.space.gutter,
    gap: t.space.md,
    backgroundColor: t.colors.canvas,
    borderTopLeftRadius: t.radius.panel,
    borderTopRightRadius: t.radius.panel,
    borderColor: t.colors.hairline,
    borderWidth: t.border.hairline,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.md },
  scroll: { flexGrow: 0 },
  sections: { gap: t.space.gutter, paddingBottom: t.space.gutter },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
});
