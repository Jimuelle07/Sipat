import type { JSX } from 'react';
import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigation } from '../navigation/types';
import type { ColorLevel, Phase, TcwsLevel, WarningEntry, WarningInput } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { Button, CenterTile, MascotSlot, OptionGrid, PendingReminder, PhaseSelector, Screen, Tile, ToggleRow, Txt, WarningChip, WarningOption } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { errorMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { homeStrings } from '../strings/home';
import { useTheme, useThemedStyles } from '../theme';
import type { HomeSection, Theme } from '../theme';
import { cardLevel, homeSections, isOptionActive, pickerGroups, warningTone } from './home/homeModel';

const phaseShortKeys: Record<Phase, 'phaseShort_before' | 'phaseShort_during' | 'phaseShort_after'> = {
  before: 'phaseShort_before',
  during: 'phaseShort_during',
  after: 'phaseShort_after',
};

const moodKeys: Record<Phase, 'mood_before' | 'mood_during' | 'mood_after'> = {
  before: 'mood_before',
  during: 'mood_during',
  after: 'mood_after',
};

const phaseNameKeys: Record<Phase, 'phase_before' | 'phase_during' | 'phase_after'> = {
  before: 'phase_before',
  during: 'phase_during',
  after: 'phase_after',
};

const availableSections: ReadonlySet<HomeSection> = new Set([
  'hero', 'emergency', 'warnings', 'center', 'pendingPhotos', 'checklist', 'ask', 'guide', 'hotlines', 'battery',
]);

export function warningInput(warning: WarningEntry): WarningInput {
  switch (warning.kind) {
    case 'tcws': return { kind: 'tcws', level: warning.level as TcwsLevel };
    case 'rainfall': return { kind: 'rainfall', level: warning.level as ColorLevel };
    case 'surge': return { kind: 'surge', level: warning.level as ColorLevel };
    case 'gale': return { kind: 'gale' };
    case 'barangay_order': return { kind: 'barangay_order' };
  }
}

export function HomeScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(homeStrings);
  const common = useT(commonStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['phase', 'context', 'family', 'profiles', 'status', 'settings']);

  const [undoHidden, setUndoHidden] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const context = engine.context.get();
  const options = engine.context.options();
  const cards = engine.context.cards();
  const pending = engine.family.pending();
  const status = engine.status();
  const settings = engine.settings.get();
  const center = engine.evacuation.view().householdCenter;
  const phaseLabels = {
    before: common[phaseShortKeys.before],
    during: common[phaseShortKeys.during],
    after: common[phaseShortKeys.after],
  };
  const undoAvailable = context.undo !== undefined && !undoHidden;
  const aiStatus = status.ai.allowed
    ? t.aiAvailable
    : errorMessage(lang, 'ai', status.ai.reason) ?? '';

  const hero = (
    <View style={styles.hero}>
      <View style={styles.heroMain}>
        <View style={styles.heroCopy}>
          <Txt role="display" tone="accent" accessibilityRole="header">
            {engine.copy(phaseNameKeys[context.phase])}
          </Txt>
          <Txt role="body" tone="muted">{common[moodKeys[context.phase]]}</Txt>
        </View>
        {theme.mascot.placement === 'heroEnd' ? <MascotSlot /> : null}
      </View>
      <PhaseSelector
        value={context.phase}
        recommended={context.recommended?.phase}
        reasonText={context.recommended ? context.recommended.reason.text : context.reason.text}
        labels={phaseLabels}
        recommendedLabel={common.recommended}
        onSelect={(phase) => engine.context.setPhase(phase)}
      />
      {undoAvailable ? (
        <Button
          label={common.undo}
          variant="text"
          onPress={() => {
            const result = engine.context.undoPhase();
            if (!result.ok && result.error.code === 'nothing_to_undo') setUndoHidden(true);
          }}
        />
      ) : null}
      {theme.mascot.placement === 'heroBelow' ? <MascotSlot /> : null}
    </View>
  );

  const emergency = (
    <Button
      label={t.emergency}
      icon="alert-circle"
      variant="danger"
      fullWidth
      onPress={() => navigation.navigate('Emergency', {})}
    />
  );

  const warnings = (
    <View style={styles.section}>
      <Tile title={t.activeWarnings}>
        {cards.length === 0 ? (
          <Txt role="bodySmall" tone="muted">{t.noWarnings}</Txt>
        ) : (
          <View style={styles.warningRows}>
            {cards.map((card) => (
              <View key={card.warningId} style={styles.warningCard}>
                <WarningChip
                  label={card.label}
                  ageText={fill(t.ageHours, { hours: card.hoursSinceSet })}
                  tone={warningTone(theme, card.kind, cardLevel(options, card))}
                  stale={card.stale}
                  staleText={card.stale ? engine.copy('stale_warning') : undefined}
                  reconfirmLabel={card.stale ? t.reconfirmWarning : undefined}
                  onReconfirm={card.stale ? () => engine.context.reconfirmWarning(card.kind) : undefined}
                  clearLabel={`${t.clearWarning}: ${card.label}`}
                  onClear={() => engine.context.clearWarning(card.kind)}
                />
                {card.confirmed === false ? (
                  <Txt role="caption" tone="muted">{t.notChecked}</Txt>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Tile>
      <Tile title={t.chooseWarning}>
        {options.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noWarningOptions}</Txt> : null}
        {pickerGroups(options).map(({ kind, entries }) => (
          <View key={kind} style={styles.pickerGroup}>
            <Txt role="label" tone="muted">{t[`kind_${kind}`]}</Txt>
            <OptionGrid columns={3}>
              {entries.map((entry) => {
                const selected = isOptionActive(context, entry);
                return (
                  <WarningOption
                    key={entry.id}
                    label={entry.label}
                    tone={warningTone(theme, entry.kind, entry.level)}
                    selected={selected}
                    onPress={() => {
                      if (selected) engine.context.clearWarning(entry.kind);
                      else engine.context.setWarning(warningInput(entry));
                    }}
                  />
                );
              })}
            </OptionGrid>
          </View>
        ))}
      </Tile>
    </View>
  );

  const centerSection = (
    <CenterTile
      title={t.centerTitle}
      name={center ?? ''}
      emptyText={center ? undefined : t.centerEmpty}
      actionLabel={center ? undefined : t.openHotlines}
      onAction={center ? undefined : () => navigation.navigate('Tabs', { screen: 'Hotlines' })}
    />
  );

  const pendingPhotos = (
    <PendingReminder
      title={t.pendingTitle}
      items={pending.map((member) => ({
        id: member.id,
        text: engine.copy('photo_pending', { vars: { name: member.name } }),
      }))}
      actionLabel={t.addPhoto}
      onAddPhoto={(memberId) => navigation.navigate('Photo', { memberId })}
    />
  );

  const checklist = (
    <Tile title={t.checklistTitle} onPress={() => navigation.navigate('Checklist')}>
      <View style={styles.shortcutBody}>
        <Txt role="bodySmall" tone="muted">{t.checklistHint}</Txt>
        <Ionicons name="arrow-forward" size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
      </View>
    </Tile>
  );

  const shortcuts = (title: string, hint: string, icon: 'chatbubble-ellipses-outline' | 'book-outline' | 'call-outline', onPress: () => void): JSX.Element => (
    <Tile title={title} onPress={onPress}>
      <View style={styles.shortcutBody}>
        <Txt role="bodySmall" tone="muted">{hint}</Txt>
        <Ionicons name={icon} size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
      </View>
    </Tile>
  );

  const battery = (
    <Tile title={t.batteryTitle}>
      <ToggleRow
        label={t.lowBatteryMode}
        value={settings.lowBatteryMode}
        onValueChange={(lowBatteryMode) => {
          const result = engine.settings.update({ lowBatteryMode });
          setSettingsError(result.ok ? null : errorMessage(lang, 'settings', result.error.code));
        }}
      />
      {settingsError ? <Txt role="bodySmall" tone="muted">{settingsError}</Txt> : null}
      <Txt role="bodySmall" tone="muted">{aiStatus}</Txt>
    </Tile>
  );

  const sections: Partial<Record<HomeSection, JSX.Element | null>> = {
    hero,
    emergency,
    warnings,
    center: centerSection,
    pendingPhotos,
    checklist,
    ask: shortcuts(t.askTitle, t.askHint, 'chatbubble-ellipses-outline', () => navigation.navigate('Tabs', { screen: 'Ask' })),
    guide: shortcuts(t.guideTitle, t.guideHint, 'book-outline', () => navigation.navigate('Tabs', { screen: 'Guide' })),
    hotlines: shortcuts(t.hotlinesTitle, t.hotlinesHint, 'call-outline', () => navigation.navigate('Tabs', { screen: 'Hotlines' })),
    battery,
  };

  return (
    <Screen title={t.title} banner={<AppBanners />} right={<StatusBadges />} mascot={<MascotSlot />}>
      <View style={styles.sections}>
        {homeSections(theme.home.order, availableSections).map((section) => (
          <Fragment key={section}>{sections[section] ?? null}</Fragment>
        ))}
      </View>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  sections: {
    gap: t.space.section,
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
  section: {
    gap: t.space.gutter,
  },
  warningRows: {
    gap: t.space.md,
  },
  warningCard: {
    gap: t.space.xs,
  },
  pickerGroup: {
    gap: t.space.xs,
  },
  shortcutBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.md,
    minHeight: t.minTouch,
  },
});
