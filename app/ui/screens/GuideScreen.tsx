import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { guideStrings, guideTopicLabels } from '../strings/guide';
import { Button, EmptyState, Screen, SectionHeader, Tag, Tile, Txt } from '../components';
import type { RootNavigation, RootTabParamList } from '../navigation/types';

export type GuideView =
  | { kind: 'topics' }
  | { kind: 'topic'; topic: TopicGroup };

/** One step up the in-screen guide hierarchy: a topic list returns to the topic grid. */
export function goBack(view: GuideView): GuideView {
  return view.kind === 'topic' ? { kind: 'topics' } : { kind: 'topics' };
}

/**
 * Guide tab: the phase-filtered topic grid and each topic's passage list. Tapping a passage
 * pushes the "Saan galing ito?" screen. A `topic` route param opens that topic directly,
 * which is how the Ask refusal chips send people here.
 */
export function GuideScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootTabParamList, 'Guide'>>();
  const { lang } = useLang();
  const t = useT(guideStrings);
  const labels = useT(guideTopicLabels);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const guideRevision = useEngineChange(['packs', 'phase']);
  const previousRevision = useRef(guideRevision);

  const routeTopic = route.params?.topic;
  const [view, setView] = useState<GuideView>(
    routeTopic ? { kind: 'topic', topic: routeTopic } : { kind: 'topics' },
  );

  useEffect(() => {
    if (route.params?.topic !== undefined) setView({ kind: 'topic', topic: route.params.topic });
  }, [route.params?.topic]);

  useEffect(() => {
    if (previousRevision.current !== guideRevision) {
      previousRevision.current = guideRevision;
      setView({ kind: 'topics' });
    }
  }, [guideRevision]);

  const topics = engine.guide.topics();

  if (view.kind === 'topics') {
    return (
      <Screen title={t.title} banner={<AppBanners />} right={<StatusBadges />}>
        <SectionHeader title={t.topicsTitle} />
        {topics.length === 0 ? (
          <EmptyState icon="book-outline" title={t.noTopics} />
        ) : (
          <View style={styles.grid}>
            {topics.map(({ topic, count }) => {
              const hasCritical = engine.guide.byTopic(topic).some((passage) => passage.critical);
              return (
                <View key={topic} style={styles.gridCell}>
                  <Tile
                    title={labels[topic]}
                    onPress={() => setView({ kind: 'topic', topic })}
                    accessibilityLabel={hasCritical ? `${labels[topic]}, ${count}, ${t.critical}` : `${labels[topic]}, ${count}`}
                  >
                    <View style={styles.tileMeta}>
                      <Tag label={String(count)} />
                      {hasCritical ? (
                        <Tag label={t.critical} tone={theme.colors.dangerSurface} icon="alert-circle-outline" />
                      ) : null}
                    </View>
                  </Tile>
                </View>
              );
            })}
          </View>
        )}
      </Screen>
    );
  }

  const passages = engine.guide.byTopic(view.topic);
  return (
    <Screen title={t.title} banner={<AppBanners />} right={<StatusBadges />}>
      <View style={styles.backRow}>
        <Button label={t.back} onPress={() => setView(goBack(view))} variant="text" icon="arrow-back" />
        <Txt role="lead" tone="muted" numberOfLines={1} style={styles.crumb}>{labels[view.topic]}</Txt>
      </View>
      {lang === 'en' ? <Txt role="bodySmall" tone="muted" style={styles.note}>{t.englishNote}</Txt> : null}
      {passages.length === 0 ? (
        <EmptyState icon="document-text-outline" title={t.noPassages} />
      ) : passages.map((passage) => (
        <Tile
          key={passage.id}
          title={passage.title}
          tag={passage.critical ? { label: t.critical, tone: theme.colors.dangerSurface } : undefined}
          onPress={() => navigation.navigate('Passage', { passageId: passage.id })}
          accessibilityLabel={passage.critical ? `${passage.title}, ${t.critical}` : passage.title}
        >
          <Txt role="bodySmall" tone="muted">{passage.summary}</Txt>
        </Tile>
      ))}
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
  tileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: t.space.xs,
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
});
