import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { guideStrings, guideTopicLabels } from '../strings/guide';
import { Button, EmptyState, Screen, SectionHeader, Tile, Txt } from '../components';

export type GuideView =
  | { kind: 'topics' }
  | { kind: 'topic'; topic: TopicGroup }
  | { kind: 'passage'; topic: TopicGroup; id: string };

/** One step up the in-screen guide hierarchy: passage → topic → topics. */
export function goBack(view: GuideView): GuideView {
  return view.kind === 'passage' ? { kind: 'topic', topic: view.topic } : { kind: 'topics' };
}

export function GuideScreen(): JSX.Element {
  const engine = useEngine();
  const theme = useTheme();
  const { lang } = useLang();
  const t = useT(guideStrings);
  const labels = useT(guideTopicLabels);
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['packs']);
  const [view, setView] = useState<GuideView>({ kind: 'topics' });

  const topics = engine.guide.topics();
  const sources = engine.guide.sources();
  const info = engine.info();

  const backButton = view.kind === 'topics' ? null : (
    <View style={styles.backRow}>
      <Button label={t.back} onPress={() => setView(goBack(view))} variant="text" icon="arrow-back" />
      <Txt role="lead" tone="muted" numberOfLines={1} style={styles.crumb}>{labels[view.topic]}</Txt>
    </View>
  );

  if (view.kind === 'topics') {
    return (
      <Screen title={t.title}>
        <SectionHeader title={t.topicsTitle} />
        {topics.length === 0 ? <EmptyState icon="book-outline" title={t.noTopics} /> : (
          <View style={styles.grid}>
            {topics.map(({ topic, count }) => (
              <View key={topic} style={styles.gridCell}>
                <Tile
                  title={labels[topic]}
                  onPress={() => setView({ kind: 'topic', topic })}
                  accessibilityLabel={`${labels[topic]} (${count})`}
                >
                  <Txt role="title" tone="accent" align="right">{count}</Txt>
                </Tile>
              </View>
            ))}
          </View>
        )}

        <Tile title={t.sourcesTitle}>
          {sources.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noSources}</Txt> : sources.map((source) => (
            <View key={source.id} style={styles.sourceRow}>
              <Txt role="body">{source.agency} · {source.title} · {source.date}</Txt>
              <Txt role="bodySmall" tone="brand" selectable>{source.url}</Txt>
            </View>
          ))}
        </Tile>

        <Tile title={t.aboutTitle}>
          <Txt role="body">{t.guideDate}: {info.guideDate}</Txt>
          <Txt role="body">{t.passagesCount}: {info.passagesCount}</Txt>
          <Txt role="body">{t.sourcesCount}: {info.sourcesCount}</Txt>
          <Txt role="body">{t.model}: {info.model.present ? t.modelPresent : t.modelMissing}</Txt>
          <Txt role="bodySmall" tone="muted">{info.model.attribution}</Txt>
        </Tile>
      </Screen>
    );
  }

  if (view.kind === 'topic') {
    const passages = engine.guide.byTopic(view.topic);
    return (
      <Screen title={t.title}>
        {backButton}
        {lang === 'en' ? <Txt role="bodySmall" tone="muted" style={styles.note}>{t.englishNote}</Txt> : null}
        {passages.length === 0 ? <EmptyState icon="document-text-outline" title={t.noPassages} /> : passages.map((passage) => (
          <Tile
            key={passage.id}
            title={passage.title}
            tag={passage.critical ? { label: t.critical, tone: theme.colors.dangerSurface } : undefined}
            onPress={() => setView({ kind: 'passage', topic: view.topic, id: passage.id })}
            accessibilityLabel={passage.critical ? `${passage.title}. ${t.critical}` : passage.title}
          >
            <Txt role="bodySmall" tone="muted">{passage.summary}</Txt>
          </Tile>
        ))}
      </Screen>
    );
  }

  const detail = engine.guide.passage(view.id);
  return (
    <Screen title={t.title}>
      {backButton}
      {detail === null ? <EmptyState icon="document-text-outline" title={t.noPassages} /> : (
        <>
          <Tile
            title={detail.title}
            tag={detail.critical ? { label: t.critical, tone: theme.colors.dangerSurface } : undefined}
          >
            <Txt role="body">{detail.text}</Txt>
            {lang === 'en' ? <Txt role="bodySmall" tone="muted" style={styles.note}>{t.englishNote}</Txt> : null}
          </Tile>
          <Tile title={t.source}>
            <Txt role="body">{detail.source.agency} · {detail.source.title} · {detail.source.date}</Txt>
            <Txt role="bodySmall" tone="brand" selectable>{detail.source.url}</Txt>
            <Txt role="bodySmall" tone="muted">{t.reviewer}: {detail.reviewedBy} · {t.reviewedAt}: {detail.reviewedAt} · {t.version}: {detail.version}</Txt>
          </Tile>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.gutter,
  },
  gridCell: {
    width: '48%',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  crumb: {
    flexShrink: 1,
  },
  note: {
    fontStyle: 'italic',
  },
  sourceRow: {
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.hairline,
  },
});
