import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { useLang, useT } from '../i18n';
import { guideStrings, guideTopicLabels } from '../strings/guide';
import { Button, Card, EmptyState, Screen, SectionHeader } from '../components';
import { colors, font, minTouch, radius, space } from '../theme';

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
  const { lang } = useLang();
  const t = useT(guideStrings);
  const labels = useT(guideTopicLabels);
  useEngineChange(['packs']);
  const [view, setView] = useState<GuideView>({ kind: 'topics' });

  const topics = engine.guide.topics();
  const sources = engine.guide.sources();
  const info = engine.info();

  const backButton = view.kind === 'topics' ? null : (
    <View style={styles.backRow}>
      <Button label={t.back} onPress={() => setView(goBack(view))} variant="ghost" icon="arrow-back" />
      <Text style={styles.crumb}>{labels[view.topic]}</Text>
    </View>
  );

  if (view.kind === 'topics') {
    return (
      <Screen title={t.title}>
        <SectionHeader title={t.topicsTitle} />
        {topics.length === 0 ? <EmptyState icon="book-outline" title={t.noTopics} /> : (
          <View style={styles.grid}>
            {topics.map(({ topic, count }) => (
              <Pressable
                key={topic}
                accessibilityRole="button"
                accessibilityLabel={`${labels[topic]} (${count})`}
                onPress={() => setView({ kind: 'topic', topic })}
                style={styles.tile}
              >
                <Text style={styles.tileLabel}>{labels[topic]}</Text>
                <Text style={styles.tileCount}>{count}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Card title={t.sourcesTitle}>
          {sources.length === 0 ? <Text style={styles.muted}>{t.noSources}</Text> : sources.map((source) => (
            <View key={source.id} style={styles.sourceRow}>
              <Text style={styles.body}>{source.agency} · {source.title} · {source.date}</Text>
              <Text selectable style={styles.link}>{source.url}</Text>
            </View>
          ))}
        </Card>

        <Card title={t.aboutTitle}>
          <Text style={styles.body}>{t.guideDate}: {info.guideDate}</Text>
          <Text style={styles.body}>{t.passagesCount}: {info.passagesCount}</Text>
          <Text style={styles.body}>{t.sourcesCount}: {info.sourcesCount}</Text>
          <Text style={styles.body}>{t.model}: {info.model.present ? t.modelPresent : t.modelMissing}</Text>
          <Text style={styles.muted}>{info.model.attribution}</Text>
        </Card>
      </Screen>
    );
  }

  if (view.kind === 'topic') {
    const passages = engine.guide.byTopic(view.topic);
    return (
      <Screen title={t.title}>
        {backButton}
        {lang === 'en' ? <Text style={styles.note}>{t.englishNote}</Text> : null}
        {passages.length === 0 ? <EmptyState icon="document-text-outline" title={t.noPassages} /> : passages.map((passage) => (
          <Pressable
            key={passage.id}
            accessibilityRole="button"
            accessibilityLabel={passage.critical ? `${passage.title}. ${t.critical}` : passage.title}
            onPress={() => setView({ kind: 'passage', topic: view.topic, id: passage.id })}
            style={styles.passageCard}
          >
            <View style={styles.passageHead}>
              <Text style={styles.passageTitle}>{passage.title}</Text>
              {passage.critical ? <Text style={styles.badge}>{t.critical}</Text> : null}
            </View>
            <Text style={styles.muted}>{passage.summary}</Text>
          </Pressable>
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
          <Card title={detail.title}>
            {detail.critical ? <Text style={styles.badge}>{t.critical}</Text> : null}
            <Text style={styles.body}>{detail.text}</Text>
            {lang === 'en' ? <Text style={styles.note}>{t.englishNote}</Text> : null}
          </Card>
          <Card title={t.source}>
            <Text style={styles.body}>{detail.source.agency} · {detail.source.title} · {detail.source.date}</Text>
            <Text selectable style={styles.link}>{detail.source.url}</Text>
            <Text style={styles.muted}>{t.reviewer}: {detail.reviewedBy} · {t.reviewedAt}: {detail.reviewedAt} · {t.version}: {detail.version}</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: '48%', minHeight: 96, justifyContent: 'space-between', padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
  tileLabel: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  tileCount: { color: colors.accent, fontSize: font.lg, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  crumb: { flexShrink: 1, color: colors.muted, fontSize: font.md, fontWeight: '700' },
  note: { color: colors.muted, fontSize: font.sm, fontStyle: 'italic' },
  passageCard: { minHeight: minTouch, padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
  passageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  passageTitle: { flex: 1, color: colors.text, fontSize: font.md, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: space.xs, color: colors.danger, fontSize: font.xs, fontWeight: '700', borderColor: colors.danger, borderWidth: 1, borderRadius: radius.pill },
  body: { color: colors.text, fontSize: font.md, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: font.sm, lineHeight: 22 },
  link: { color: colors.accent, fontSize: font.sm },
  sourceRow: { gap: space.xs, paddingVertical: space.xs, borderBottomColor: colors.border, borderBottomWidth: 1 },
});
