import type { JSX } from 'react';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ColorLevel, Phase, TcwsLevel, WarningEntry, WarningInput, WarningKind } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import type { RootTabParamList } from '../navigation/types';
import { commonStrings } from '../strings/common';
import { homeStrings } from '../strings/home';
import { useLang, useT } from '../i18n';
import {
  Button,
  ChecklistRow,
  EmptyState,
  MascotSlot,
  OptionGrid,
  PhaseSelector,
  ProgressBar,
  Screen,
  SectionHeader,
  StaleBanner,
  Tile,
  Txt,
  WarningChip,
  WarningOption,
} from '../components';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';

const phaseKeys: Record<Phase, 'phaseShort_before' | 'phaseShort_during' | 'phaseShort_after'> = {
  before: 'phaseShort_before',
  during: 'phaseShort_during',
  after: 'phaseShort_after',
};
const phaseNameKeys: Record<Phase, 'phase_before' | 'phase_during' | 'phase_after'> = {
  before: 'phase_before',
  during: 'phase_during',
  after: 'phase_after',
};
const moodKeys: Record<Phase, 'mood_before' | 'mood_during' | 'mood_after'> = {
  before: 'mood_before',
  during: 'mood_during',
  after: 'mood_after',
};

export function warningInput(warning: WarningEntry): WarningInput {
  if (warning.kind === 'gale') return { kind: 'gale' };
  if (warning.kind === 'barangay_order') return { kind: 'barangay_order' };
  if (warning.kind === 'tcws') return { kind: 'tcws', level: warning.level as TcwsLevel };
  return { kind: warning.kind, level: warning.level as ColorLevel };
}

function warningTone(warning: WarningEntry, theme: Theme): Tone {
  if (warning.kind === 'tcws') {
    return theme.warning.tcws[warning.level as TcwsLevel];
  }
  if (warning.kind === 'rainfall' || warning.kind === 'surge') {
    return theme.warning.color[warning.level as ColorLevel];
  }
  return theme.warning.onOff;
}

export function warningPickerLabel(warning: WarningEntry): string {
  return warning.label;
}

export function HomeScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const t = useT(homeStrings);
  const common = useT(commonStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
    ? `${Math.round(status.battery.level)}${t.percentSign} · ${status.battery.charging ? t.charging : t.notCharging} · ${status.battery.saver ? t.saverOn : t.saverOff}`
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
  const phaseLabels = {
    before: common[phaseKeys.before],
    during: common[phaseKeys.during],
    after: common[phaseKeys.after],
  };
  const phaseMascot = <MascotSlot />;

  const hero = (
    <View style={styles.hero}>
      <View style={styles.heroMain}>
        <View style={styles.heroCopy}>
          <Txt role="display" accessibilityRole="header">{common[phaseNameKeys[context.phase]]}</Txt>
          <Txt role="body" tone="muted">{common[moodKeys[context.phase]]}</Txt>
        </View>
        {theme.mascot.placement === 'heroEnd' ? <MascotSlot /> : null}
      </View>
      <PhaseSelector
        value={context.phase}
        labels={phaseLabels}
        recommendedLabel={common.recommended}
        onSelect={(phase) => engine.context.setPhase(phase)}
      />
      {theme.mascot.placement === 'heroBelow' ? <MascotSlot /> : null}
    </View>
  );

  const emergencySection = (
    <View style={styles.section}>
      <Button
        label={t.emergency}
        onPress={() => setShowEmergency((visible) => !visible)}
        accessibilityState={{ expanded: showEmergency }}
        variant="danger"
        icon="alert-circle"
      />
      {emergency ? (
        <Tile title={emergency.title} tone="danger">
          {emergency.steps.map((step, index) => (
            <Txt key={`${index}-${step}`} role="body">{`${index + 1}. ${step}`}</Txt>
          ))}
          {emergency.hotlines.map((hotline) => (
            <Txt key={hotline.id} role="body">{`${hotline.name}: ${hotline.number}`}</Txt>
          ))}
          <Txt role="bodySmall" tone="muted">{`${t.source}: ${emergency.source.agency} · ${emergency.source.title}`}</Txt>
          <Button label={t.closeEmergency} onPress={() => setShowEmergency(false)} variant="tonal" />
        </Tile>
      ) : null}
    </View>
  );

  const warningsSection = (
    <View style={styles.section}>
      <Tile>
        <SectionHeader title={t.activeWarnings} />
        {checklist.warningCards.length === 0 ? (
          <Txt role="bodySmall" tone="muted">{t.noWarnings}</Txt>
        ) : (
          <View style={styles.warningRows}>
            {checklist.warningCards.map((warning) => {
              const entry = warnings.find((item) => item.id === warning.warningId);
              if (entry === undefined) return null;
              return (
                <WarningChip
                  key={warning.warningId}
                  label={warning.label}
                  tone={warningTone(entry, theme)}
                  clearLabel={`${t.clearWarning}: ${warning.label}`}
                  onClear={() => engine.context.clearWarning(warning.kind)}
                />
              );
            })}
          </View>
        )}
      </Tile>
      {status.stale ? (
        <StaleBanner
          text={engine.copy('stale_warning')}
          translation={lang === 'en' ? engine.copy('stale_warning', { lang: 'en' }) : undefined}
          actionLabel={t.reconfirmWarning}
          onAction={() => engine.context.reconfirmWarning(status.stale!.kind)}
        />
      ) : null}

      <Tile>
        <SectionHeader title={t.chooseWarning} />
        {warnings.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noWarningOptions}</Txt> : null}
        {pickerGroups.map(({ kind, title }) => {
          const entries = warnings.filter((warning) => warning.kind === kind);
          if (entries.length === 0) return null;
          const isSelected = (warning: WarningEntry): boolean => {
            const active = context.warnings[kind];
            return active !== undefined && (!('level' in active) || active.level === warning.level);
          };
          return (
            <View key={kind} style={styles.pickerGroup}>
              <Txt role="label" tone="muted">{title}</Txt>
              <OptionGrid columns={3}>
                {entries.map((warning) => (
                  <WarningOption
                    key={warning.id}
                    label={warningPickerLabel(warning)}
                    tone={warningTone(warning, theme)}
                    selected={isSelected(warning)}
                    onPress={() => {
                      if (kind === 'gale' && context.warnings.gale !== undefined) {
                        engine.context.clearWarning('gale');
                      } else {
                        engine.context.setWarning(warningInput(warning));
                      }
                    }}
                  />
                ))}
              </OptionGrid>
            </View>
          );
        })}
      </Tile>
    </View>
  );

  const checklistSection = activeProfile ? (
    <Tile>
      <SectionHeader title={t.checklist} action={{ label: t.resetChecklist, onPress: () => engine.checklist.reset() }} />
      <ProgressBar
        value={checklist.progress.total ? checklist.progress.done / checklist.progress.total : 0}
        label={`${t.progress}: ${checklist.progress.done}/${checklist.progress.total}`}
      />
      {checklist.groups.map((group) => (
        <View key={group.id} style={styles.checklistGroup}>
          {group.items.length > 0 ? <Txt role="label" tone="muted">{t[`group_${group.id}`]}</Txt> : null}
          {group.items.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <ChecklistRow
                text={item.text}
                ticked={item.ticked}
                onToggle={() => engine.checklist.tick(item.id, !item.ticked)}
              />
              {item.forMembers?.map((member) => (
                <Txt key={member.id} role="bodySmall" tone="muted">
                  {member.name}{member.note ? ` · ${member.note}` : ''}
                </Txt>
              ))}
            </View>
          ))}
        </View>
      ))}
    </Tile>
  ) : (
    <Tile>
      <EmptyState
        icon="people-outline"
        title={t.noHouseholdTitle}
        body={t.noHousehold}
        action={{ label: t.setupHousehold, onPress: () => navigation.navigate('Family') }}
      />
    </Tile>
  );

  const batterySection = (
    <View style={styles.section}>
      <Txt role="caption" tone="muted">
        {`${t.tier}: ${tierStatus} · ${t.ai}: ${aiStatus} · ${t.battery}: ${batteryStatus} · ${t.model}: ${modelStatus}`}
      </Txt>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showDeveloper }}
          accessibilityLabel={t.developer}
          onPress={() => setShowDeveloper((visible) => !visible)}
          style={styles.developerToggle}
        >
          <Txt role="bodySmall" tone="muted">{t.developer}</Txt>
          <Ionicons name={showDeveloper ? 'chevron-up' : 'chevron-down'} size={theme.type.roles.bodySmall.fontSize} color={theme.colors.textMuted} />
        </Pressable>
        {showDeveloper ? (
          <Tile>
            <View style={styles.developerRow}>
              <Txt role="body">{engine.engineKind === 'mock' ? t.engineMock : t.engineReal}</Txt>
              <Button
                label={engine.engineKind === 'mock' ? t.switchReal : t.switchMock}
                onPress={() => engine.switchEngine(engine.engineKind === 'mock' ? 'real' : 'mock')}
                variant="text"
              />
            </View>
          </Tile>
        ) : null}
      </View>
    </View>
  );

  const sections: Partial<Record<'hero' | 'emergency' | 'warnings' | 'checklist' | 'battery', JSX.Element>> = {
    hero,
    emergency: emergencySection,
    warnings: warningsSection,
    checklist: checklistSection,
    battery: batterySection,
  };

  return (
    <Screen title={t.title} mascot={phaseMascot}>
      {theme.home.order.map((section) => (
        <Fragment key={section}>{sections[section as keyof typeof sections] ?? null}</Fragment>
      ))}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  section: {
    gap: t.space.gutter,
  },
  hero: {
    gap: t.space.lg,
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.gutter,
  },
  heroCopy: {
    flex: 1,
    gap: t.space.xs,
  },
  warningRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.sm,
  },
  pickerGroup: {
    gap: t.space.xs,
  },
  checklistGroup: {
    gap: t.space.xs,
  },
  checklistItem: {
    gap: t.space.xs,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.hairline,
    paddingBottom: t.space.sm,
  },
  developerToggle: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  developerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
  },
});
