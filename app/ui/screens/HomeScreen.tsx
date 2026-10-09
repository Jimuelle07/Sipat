import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ColorLevel, Phase, TcwsLevel, WarningEntry, WarningInput, WarningKind } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import type { RootTabParamList } from '../navigation/types';
import { homeStrings } from '../strings/home';
import { useT } from '../i18n';
import { Button, Card, Chip, EmptyState, ProgressBar, SafetyText, Screen, SectionHeader } from '../components';
import { colors, font, minTouch, radius, space } from '../theme';

const phases = ['before', 'during', 'after'] as const satisfies readonly Phase[];
const phaseKeys: Record<Phase, 'before' | 'during' | 'after'> = { before: 'before', during: 'during', after: 'after' };

export function warningInput(warning: WarningEntry): WarningInput {
  if (warning.kind === 'gale') return { kind: 'gale' };
  if (warning.kind === 'barangay_order') return { kind: 'barangay_order' };
  if (warning.kind === 'tcws') return { kind: 'tcws', level: warning.level as TcwsLevel };
  return { kind: warning.kind, level: warning.level as ColorLevel };
}

function warningColor(warning: Pick<WarningEntry, 'kind' | 'level'>): string {
  if (warning.kind === 'tcws') return typeof warning.level === 'number' ? colors.signal[warning.level] : colors.signal[1];
  if (warning.kind === 'rainfall' || warning.kind === 'surge') {
    if (warning.level === 'yellow' || warning.level === 'orange' || warning.level === 'red') return colors.rain[warning.level];
  }
  return colors.accent;
}

function warningPickerLabel(warning: WarningEntry): string {
  return warning.kind === 'tcws' && typeof warning.level === 'number' ? String(warning.level) : warning.label;
}

const colorLevelNames: Record<ColorLevel, string> = { yellow: 'Yellow', orange: 'Orange', red: 'Red' };

function colorLevelLabel(level: WarningEntry['level']): string {
  return level === 'yellow' || level === 'orange' || level === 'red' ? colorLevelNames[level] : String(level);
}

export function HomeScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const t = useT(homeStrings);
  useEngineChange(['context', 'checklist', 'profiles', 'family', 'status']);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const context = engine.context.get();
  const checklist = engine.checklist.view();
  const warnings = engine.context.options();
  const activeProfile = engine.profiles.active();
  const status = engine.status();
  const emergency = showEmergency ? engine.emergency.card() : null;
  const pickerGroups: { kind: WarningKind; title: string }[] = [
    { kind: 'tcws', title: t.wind },
    { kind: 'rainfall', title: t.rainfall },
    { kind: 'surge', title: t.surge },
    { kind: 'gale', title: t.gale },
  ];
  const aiStatus = status.ai.allowed ? t.aiAllowed : (() => {
    switch (status.ai.reason) {
      case 'low_battery': return t.aiReason_low_battery;
      case 'battery_saver': return t.aiReason_battery_saver;
      case 'ai_off': return t.aiReason_ai_off;
      case 'tier': return t.aiReason_tier;
      case 'no_model': return t.aiReason_no_model;
    }
  })();
  const batteryStatus = status.battery
    ? `${Math.round(status.battery.level)}% · ${status.battery.charging ? t.charging : t.notCharging} · ${status.battery.saver ? t.saverOn : t.saverOff}`
    : t.unknownBattery;
  const modelStatus = {
    absent: t.model_absent,
    unloaded: t.model_unloaded,
    loading: t.model_loading,
    ready: t.model_ready,
    generating: t.model_generating,
    error: t.model_error,
  }[status.model];
  const tierStatus = { full: t.tier_full, lite: t.tier_lite, none: t.tier_none }[status.tier];

  return (
    <Screen title={t.title}>
      <Button
        label={t.emergency}
        onPress={() => setShowEmergency((visible) => !visible)}
        variant="danger"
        icon="alert-circle"
      />

      {emergency ? (
        <Card title={emergency.title} tone="danger">
          {emergency.steps.map((step, index) => <Text key={`${index}-${step}`} style={styles.body}>{index + 1}. {step}</Text>)}
          {emergency.hotlines.map((hotline) => <Text key={hotline.id} style={styles.body}>{hotline.name}: {hotline.number}</Text>)}
          <Text style={styles.muted}>{t.source}: {emergency.source.agency} · {emergency.source.title}</Text>
          <Button label={t.closeEmergency} onPress={() => setShowEmergency(false)} variant="secondary" />
        </Card>
      ) : null}

      <Card title={t.now}>
        <View accessibilityRole="radiogroup" style={styles.phaseGroup}>
          {phases.map((phase) => (
            <Pressable
              key={phase}
              accessibilityRole="radio"
              accessibilityState={{ selected: context.phase === phase }}
              onPress={() => engine.context.setPhase(phase)}
              style={[styles.phaseButton, context.phase === phase && styles.phaseSelected]}
            >
              <Text style={[styles.phaseText, context.phase === phase && styles.phaseSelectedText]}>{t[phaseKeys[phase]]}</Text>
            </Pressable>
          ))}
        </View>
        <SectionHeader title={t.activeWarnings} />
        {checklist.warningCards.length === 0 ? <Text style={styles.muted}>{t.noWarnings}</Text> : (
          <View style={styles.row}>
            {checklist.warningCards.map((warning) => {
              const color = warningColor(warnings.find((item) => item.id === warning.warningId) ?? { kind: warning.kind, level: warning.kind === 'gale' ? 'on' : warning.kind === 'tcws' ? 1 : 'yellow' });
              return (
                <View key={warning.warningId} style={styles.activeWarning}>
                  <Chip label={warning.label} color={color} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t.clearWarning}: ${warning.label}`} onPress={() => engine.context.clearWarning(warning.kind)} style={styles.clearButton}>
                    <Ionicons name="close" size={20} color={colors.text} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        {status.stale ? (
          <View style={styles.staleNotice}>
            <SafetyText copyKey="stale_warning" />
            <Button label={t.reconfirmWarning} onPress={() => engine.context.reconfirmWarning(status.stale!.kind)} variant="secondary" />
          </View>
        ) : null}
      </Card>

      <Card title={t.chooseWarning}>
        {warnings.length === 0 ? <Text style={styles.muted}>{t.noWarningOptions}</Text> : null}
        {pickerGroups.map(({ kind, title }) => {
          const entries = warnings.filter((warning) => warning.kind === kind);
          if (entries.length === 0) return null;
          if (kind === 'gale') {
            const gale = entries[0];
            if (!gale) return null;
            const galeOn = context.warnings.gale !== undefined;
            return (
              <Pressable
                key={kind}
                accessibilityRole="switch"
                accessibilityState={{ checked: galeOn }}
                accessibilityLabel={gale.label}
                onPress={() => (galeOn ? engine.context.clearWarning('gale') : engine.context.setWarning(warningInput(gale)))}
                style={[styles.galeButton, galeOn && styles.galeSelected]}
              >
                <Text style={[styles.galeLabel, galeOn && styles.galeSelectedText]}>{title}</Text>
              </Pressable>
            );
          }
          const colorLevels = kind === 'rainfall' || kind === 'surge';
          return (
            <View key={kind} style={styles.pickerGroup}>
              <Text style={styles.groupTitle}>{title}</Text>
              <View style={styles.row}>
                {entries.map((warning) => (
                  <Pressable
                    key={warning.id}
                    accessibilityRole="button"
                    accessibilityLabel={warning.label}
                    onPress={() => engine.context.setWarning(warningInput(warning))}
                    style={[colorLevels ? styles.levelButton : styles.warningButton, { borderColor: warningColor(warning) }]}
                  >
                    <Text style={[styles.warningLabel, { color: warningColor(warning) }]}>
                      {colorLevels ? colorLevelLabel(warning.level) : warningPickerLabel(warning)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </Card>

      {activeProfile ? (
        <Card>
          <SectionHeader title={t.checklist} action={{ label: t.resetChecklist, onPress: () => engine.checklist.reset() }} />
          <ProgressBar value={checklist.progress.total ? checklist.progress.done / checklist.progress.total : 0} label={`${t.progress}: ${checklist.progress.done}/${checklist.progress.total}`} />
          {checklist.groups.map((group) => (
            <View key={group.id} style={styles.checklistGroup}>
              {group.items.length > 0 ? <Text style={styles.groupTitle}>{t[`group_${group.id}`]}</Text> : null}
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.ticked }}
                  onPress={() => engine.checklist.tick(item.id, !item.ticked)}
                  style={styles.checklistItem}
                >
                  <Ionicons name={item.ticked ? 'checkbox' : 'square-outline'} size={24} color={item.ticked ? colors.accent : colors.muted} />
                  <View style={styles.itemText}>
                    <Text style={styles.body}>{item.text}</Text>
                    {item.forMembers?.map((member) => <Text key={member.id} style={styles.muted}>{member.name}{member.note ? ` · ${member.note}` : ''}</Text>)}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="people-outline"
            title={t.noHouseholdTitle}
            body={t.noHousehold}
            action={{ label: t.setupHousehold, onPress: () => navigation.navigate('Family') }}
          />
        </Card>
      )}

      <Text style={styles.deviceStatus}>{t.tier}: {tierStatus} · {t.ai}: {aiStatus} · {t.battery}: {batteryStatus} · {t.model}: {modelStatus}</Text>

      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showDeveloper }}
          onPress={() => setShowDeveloper((visible) => !visible)}
          style={styles.developerToggle}
        >
          <Text style={styles.muted}>{t.developer}</Text>
          <Ionicons name={showDeveloper ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {showDeveloper ? (
          <Card>
            <View style={styles.row}>
              <Text style={styles.body}>{engine.engineKind === 'mock' ? t.engineMock : t.engineReal}</Text>
              <Button label={engine.engineKind === 'mock' ? t.switchReal : t.switchMock} onPress={() => engine.switchEngine(engine.engineKind === 'mock' ? 'real' : 'mock')} variant="ghost" />
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: font.md },
  muted: { color: colors.muted, fontSize: font.sm },
  deviceStatus: { color: colors.muted, fontSize: font.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  phaseGroup: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  phaseButton: { minHeight: minTouch, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xs, borderRadius: radius.sm },
  phaseSelected: { backgroundColor: colors.accent },
  phaseText: { color: colors.text, fontSize: font.sm, textAlign: 'center' },
  phaseSelectedText: { color: colors.accentText, fontWeight: '700' },
  activeWarning: { flexDirection: 'row', alignItems: 'center' },
  clearButton: { minWidth: minTouch, minHeight: minTouch, alignItems: 'center', justifyContent: 'center', marginLeft: -space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  staleNotice: { gap: space.sm, borderLeftWidth: 3, borderLeftColor: colors.warning, paddingLeft: space.md },
  pickerGroup: { gap: space.xs },
  groupTitle: { color: colors.muted, fontSize: font.sm, fontWeight: '700' },
  warningButton: { minWidth: 52, minHeight: minTouch, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  levelButton: { flex: 1, minHeight: minTouch, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  galeButton: { alignSelf: 'flex-start', minHeight: minTouch, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  galeSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  galeLabel: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  galeSelectedText: { color: colors.accentText },
  warningLabel: { fontSize: font.sm, fontWeight: '700', textAlign: 'center' },
  checklistGroup: { gap: space.xs },
  checklistItem: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { flex: 1, gap: space.xs },
  developerToggle: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
