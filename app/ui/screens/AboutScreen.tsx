import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { PackKind } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { useT } from '../i18n';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { aboutStrings } from '../strings/about';
import { fill } from '../strings/format';
import { SafetyText, Screen, SectionHeader, Tile, Txt } from '../components';
import type { RootNavigation } from '../navigation/types';

const packKindKeys: Record<PackKind, keyof typeof aboutStrings.tl> = {
  core: 'packKind_core',
  area: 'packKind_area',
  model: 'packKind_model',
};

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Txt role="bodySmall" tone="muted" style={styles.rowLabel}>{label}</Txt>
      <Txt role="body" style={styles.rowValue}>{value}</Txt>
    </View>
  );
}

/**
 * About: the app and engine versions, the guide date and counts, the bundled AI model and its
 * attribution, the vetted sources and reviewers, and the installed packs. The emergency-aid
 * notice leads the page as the prominent safety line.
 */
export function AboutScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(aboutStrings);
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['packs']);

  const info = engine.info();
  const sources = engine.guide.sources();
  const reviewers = engine.guide.reviewers();
  const packs = engine.packs.installed();

  return (
    <Screen title={t.title} banner={<AppBanners />} back={{ label: t.back, onPress: navigation.goBack }}>
      <Tile tone="accent">
        <SafetyText text={engine.copy('aid_notice')} />
      </Tile>

      <View style={styles.group}>
        <SectionHeader title={t.infoTitle} />
        <Tile>
          <InfoRow label={t.appVersion} value={info.appVersion} />
          <InfoRow label={t.engineVersion} value={String(info.engineApiVersion)} />
          <InfoRow label={t.guideDate} value={info.guideDate} />
          <InfoRow label={t.passagesCount} value={String(info.passagesCount)} />
          <InfoRow label={t.sourcesCount} value={String(info.sourcesCount)} />
        </Tile>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t.modelTitle} />
        <Tile>
          <InfoRow label={t.modelFile} value={info.model.fileName} />
          <InfoRow label={t.modelLicense} value={info.model.attribution} />
          <Txt role="bodySmall" tone="muted">{info.model.present ? t.modelPresent : t.modelMissing}</Txt>
        </Tile>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t.sourcesTitle} />
        <Tile>
          {sources.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noSources}</Txt> : sources.map((source) => (
            <View key={source.id} style={styles.entry}>
              <Txt role="body">{source.title}</Txt>
              <Txt role="bodySmall" tone="muted">{source.agency} · {source.date}</Txt>
            </View>
          ))}
        </Tile>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t.reviewersTitle} />
        <Tile>
          {reviewers.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noReviewers}</Txt> : reviewers.map((reviewer) => (
            <View key={reviewer.name} style={styles.entry}>
              <Txt role="body">{reviewer.name}</Txt>
              <Txt role="bodySmall" tone="muted">
                {fill(t.reviewerPassages, { count: reviewer.passages })}
              </Txt>
            </View>
          ))}
        </Tile>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t.packsTitle} />
        <Tile>
          {packs.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noPacks}</Txt> : packs.map((pack) => (
            <View key={pack.packId} style={styles.entry}>
              <Txt role="body">{t[packKindKeys[pack.kind]]}</Txt>
              <Txt role="bodySmall" tone="muted">
                {fill(t.packVersion, { version: pack.version })}
                {pack.guideDate !== undefined ? ` · ${fill(t.packGuideDate, { date: pack.guideDate })}` : ''}
              </Txt>
              <Txt role="caption" tone="muted">{fill(t.packInstalledAt, { at: pack.installedAt })}</Txt>
            </View>
          ))}
        </Tile>
      </View>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  group: {
    gap: t.space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: t.space.gutter,
  },
  rowLabel: {
    flexShrink: 1,
  },
  rowValue: {
    flexShrink: 0,
    textAlign: 'right',
  },
  entry: {
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.hairline,
  },
});
