import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { guideStrings } from '../strings/guide';
import { genericMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { EmptyState, Screen, Tag, Tile, Txt } from '../components';
import type { RootNavigation, RootStackParamList } from '../navigation/types';

/**
 * "Saan galing ito?" — the full text of one guide passage in a calm reading measure, with its
 * structured source block (agency, title, date, locator, the URL shown only as selectable text),
 * the reviewer line and the version.
 */
export function PassageScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Passage'>>();
  const { lang } = useLang();
  const t = useT(guideStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['packs', 'phase']);

  const detail = engine.guide.passage(route.params.passageId);
  const title = engine.copy('source_link');

  return (
    <Screen title={title} banner={<AppBanners />} back={{ label: t.back, onPress: navigation.goBack }}>
      {detail === null ? (
        <EmptyState
          icon="document-text-outline"
          title={genericMessage(lang)}
        />
      ) : (
        <>
          <View style={styles.head}>
            {detail.critical ? <Tag label={t.critical} tone={theme.colors.dangerSurface} /> : null}
            <Txt role="headline" accessibilityRole="header">{detail.title}</Txt>
          </View>
          <Txt role="body" style={styles.reading}>{detail.text}</Txt>
          {lang === 'en' ? <Txt role="bodySmall" tone="muted" style={styles.note}>{t.englishNote}</Txt> : null}
          <Tile title={t.source}>
            <View style={styles.sourceRow}>
              <Txt role="body">{detail.source.agency} · {detail.source.title} · {detail.source.date}</Txt>
              {detail.source.locator !== undefined ? (
                <Txt role="bodySmall" tone="muted">{t.locator}: {detail.source.locator}</Txt>
              ) : null}
              <Txt role="bodySmall" tone="brand" selectable>{detail.source.url}</Txt>
              <Txt role="caption" tone="muted">{t.urlHint}</Txt>
            </View>
            <View style={styles.meta}>
              <Txt role="bodySmall" tone="muted">
                {fill(t.reviewedLine, { name: detail.reviewedBy, date: detail.reviewedAt })}
              </Txt>
              <Txt role="bodySmall" tone="muted">{fill(t.versionLabel, { version: detail.version })}</Txt>
            </View>
          </Tile>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  head: {
    gap: t.space.sm,
  },
  reading: {
    maxWidth: t.minTouch * 10,
    lineHeight: t.type.roles.body.lineHeight + t.space.xs,
  },
  sourceRow: {
    gap: t.space.xs,
  },
  meta: {
    gap: t.space.hair,
  },
  note: {
    fontStyle: 'italic',
  },
});
