import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { guideStrings, guideTopicLabels } from '../strings/guide';
import { fill } from '../strings/format';
import { Button, EmptyState, Screen, Txt } from '../components';
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
  const phaseName = engine.copy(`phase_${engine.context.get().phase}`);

  const stamp = (label: string): JSX.Element => (
    <View style={styles.stamp}>
      <Txt role="caption" color={theme.colors.dangerSurface.ink} style={styles.caps}>{label}</Txt>
    </View>
  );

  const story = (topic: TopicGroup, count: number, size: 'lead' | 'column'): JSX.Element => {
    const items = engine.guide.byTopic(topic);
    const hasCritical = items.some((passage) => passage.critical);
    const lead = size === 'lead';
    return (
      <Pressable
        key={topic}
        accessibilityRole="button"
        accessibilityLabel={hasCritical ? `${labels[topic]}, ${count}, ${t.critical}` : `${labels[topic]}, ${count}`}
        onPress={() => setView({ kind: 'topic', topic })}
        style={({ pressed }) => [styles.story, pressed && styles.pressed]}
      >
        <Txt role="title" serif style={lead ? styles.leadHead : styles.colHead}>{labels[topic]}</Txt>
        {items[0] ? (
          <Txt role="bodySmall" serif numberOfLines={lead ? 4 : 5} style={lead ? styles.leadDek : styles.colDek}>{items[0].summary}</Txt>
        ) : null}
        <View style={styles.byline}>
          <Txt role="caption" tone="muted" style={styles.caps}>{fill(t.countLabel, { count })}</Txt>
          {hasCritical ? stamp(t.critical) : null}
        </View>
      </Pressable>
    );
  };

  if (view.kind === 'topics') {
    // Critical topics run first, like a front page that leads with what matters now.
    const ordered = [...topics].sort((x, y) => Number(engine.guide.byTopic(y.topic).some((p) => p.critical)) - Number(engine.guide.byTopic(x.topic).some((p) => p.critical)));
    const [first, ...rest] = ordered;
    const left = rest.filter((_item, index) => index % 2 === 0);
    const right = rest.filter((_item, index) => index % 2 === 1);
    const total = topics.reduce((sum, item) => sum + item.count, 0);
    const masthead = (
      <View style={styles.masthead}>
        <View style={styles.ruleThick} />
        <Txt role="display" accessibilityRole="header" align="center" style={styles.mastTitle}>{t.title.toUpperCase()}</Txt>
        <View style={styles.ruleThin} />
        <View style={styles.mastLine}>
          <Txt role="caption" style={styles.caps}>{phaseName}</Txt>
          <Txt role="caption" style={styles.caps}>{fill(t.countLabel, { count: total })}</Txt>
        </View>
        <View style={styles.ruleThin} />
      </View>
    );
    return (
      <Screen title={t.title} masthead={masthead} banner={<AppBanners />} right={<StatusBadges />}>
        {topics.length === 0 ? (
          <EmptyState icon="book-outline" title={t.noTopics} />
        ) : (
          <View style={styles.sheet}>
            {first ? story(first.topic, first.count, 'lead') : null}
            {rest.length > 0 ? <View style={styles.ruleThin} /> : null}
            <View style={styles.columns}>
              <View style={styles.column}>{left.map((item) => story(item.topic, item.count, 'column'))}</View>
              {right.length > 0 ? <View style={styles.colRule} /> : null}
              <View style={styles.column}>{right.map((item) => story(item.topic, item.count, 'column'))}</View>
            </View>
          </View>
        )}
      </Screen>
    );
  }

  const passages = engine.guide.byTopic(view.topic);
  const section = (
    <View style={styles.masthead}>
      <View style={styles.ruleThick} />
      <Txt role="headline" accessibilityRole="header" serif style={styles.sectionTitle}>{labels[view.topic]}</Txt>
      <View style={styles.ruleThin} />
    </View>
  );
  return (
    <Screen title={t.title} masthead={section} banner={<AppBanners />} right={<StatusBadges />}>
      <View style={styles.backRow}>
        <Button label={t.back} onPress={() => setView(goBack(view))} variant="outline" icon="arrow-back" />
      </View>
      {lang === 'en' ? <Txt role="bodySmall" tone="muted" serif="italic">{t.englishNote}</Txt> : null}
      {passages.length === 0 ? (
        <EmptyState icon="document-text-outline" title={t.noPassages} />
      ) : (
        <View style={styles.sheet}>
          {passages.map((passage, index) => (
            <Pressable
              key={passage.id}
              accessibilityRole="button"
              accessibilityLabel={passage.critical ? `${passage.title}, ${t.critical}` : passage.title}
              onPress={() => navigation.navigate('Passage', { passageId: passage.id })}
              style={({ pressed }) => [styles.article, index > 0 && styles.articleRule, pressed && styles.pressed]}
            >
              {passage.critical ? stamp(t.critical) : null}
              <Txt role="title" serif style={styles.leadHead}>{passage.title}</Txt>
              <Txt role="bodySmall" serif style={styles.justify}>{passage.summary}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  masthead: { gap: t.space.sm },
  ruleThick: { height: 4, backgroundColor: t.colors.ink },
  ruleThin: { height: t.border.control, backgroundColor: t.colors.stroke },
  mastTitle: { fontSize: 64, lineHeight: 70, letterSpacing: 2, paddingVertical: t.space.xs },
  mastLine: { flexDirection: 'row', justifyContent: 'space-between', gap: t.space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.1 },
  sheet: {
    padding: t.space.xl,
    gap: t.space.lg,
    borderRadius: t.radius.menu,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.surface,
    boxShadow: t.shadow.sticker,
  },
  story: { gap: t.space.sm, paddingBottom: t.space.md },
  pressed: { opacity: 0.6 },
  leadHead: { fontSize: 25, lineHeight: 31 },
  leadDek: { fontSize: 14, lineHeight: 22 },
  colHead: { fontSize: 17, lineHeight: 22 },
  colDek: { fontSize: 12.5, lineHeight: 19 },
  byline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space.sm },
  stamp: {
    alignSelf: 'flex-start',
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.hair,
    borderWidth: t.border.control,
    borderColor: t.colors.danger.fill,
    backgroundColor: t.colors.dangerSurface.fill,
  },
  columns: { flexDirection: 'row', gap: t.space.lg },
  column: { flex: 1, gap: t.space.sm },
  colRule: { width: t.border.hairline, backgroundColor: t.colors.hairline },
  sectionTitle: { fontSize: 32, lineHeight: 38, paddingVertical: t.space.xs },
  backRow: { flexDirection: 'row' },
  article: { gap: t.space.sm, paddingBottom: t.space.md },
  articleRule: { paddingTop: t.space.lg, borderTopWidth: t.border.hairline, borderTopColor: t.colors.hairline },
  justify: { textAlign: 'justify', lineHeight: 22 },
});
