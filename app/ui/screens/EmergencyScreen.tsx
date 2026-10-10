import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEngine } from '../context/useEngine';
import { Txt } from '../components';
import { useLang, useT } from '../i18n';
import { emergencyStrings } from '../strings/emergency';
import { errorMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import type { RootNavigation, RootStackParamList } from '../navigation/types';

/**
 * The Emergency card is its own danger world: the whole screen is the alert fill with alert ink,
 * the numbered steps speak loudest, and each hotline is a full-width call pill bound to data.
 * No phase banner, no status badges, no language toggle.
 */
export function EmergencyScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Emergency'>>();
  const t = useT(emergencyStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [callError, setCallError] = useState<string | null>(null);

  const ink = theme.colors.danger.ink;
  const card = engine.emergency.card(route.params?.cardId);

  const call = async (hotlineId: string): Promise<void> => {
    try {
      const result = await engine.plan.call(hotlineId);
      setCallError(result.ok ? null : errorMessage(lang, 'plan', result.error.code));
    } catch {
      setCallError(errorMessage(lang, 'plan', 'failed'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={navigation.goBack}
          hitSlop={theme.space.md}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={theme.type.roles.title.fontSize} color={ink} />
        </Pressable>
        <Ionicons name="alert-circle" size={theme.type.roles.title.fontSize} color={ink} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Txt role="display" color={ink} accessibilityRole="header" style={styles.title}>{card.title}</Txt>

        <View style={styles.steps}>
          {card.steps.map((step, index) => (
            <View key={`${index}-${step}`} style={styles.step}>
              <Txt role="display" color={ink} accessible={false} style={styles.stepNumber}>{index + 1}</Txt>
              <Txt role="lead" color={ink} style={styles.stepText}>{step}</Txt>
            </View>
          ))}
        </View>

        {card.hotlines.length > 0 ? (
          <View style={styles.calls}>
            {card.hotlines.map((hotline) => (
              <Pressable
                key={hotline.id}
                accessibilityRole="button"
                accessibilityLabel={fill(t.callTo, { name: hotline.name })}
                onPress={() => { void call(hotline.id); }}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <Ionicons name="call" size={theme.type.roles.title.fontSize} color={ink} />
                <View style={styles.pillCopy}>
                  <Txt role="label" color={ink}>{hotline.name}</Txt>
                  <Txt role="title" color={ink} style={styles.number}>{hotline.number}</Txt>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {callError !== null ? (
          <Txt role="bodySmall" color={ink} accessibilityRole="alert">{callError}</Txt>
        ) : null}

        <View style={styles.source}>
          <Txt role="caption" color={ink}>{t.sourceTitle}</Txt>
          <Txt role="bodySmall" color={ink}>
            {card.source.agency} · {card.source.title} · {card.source.date}
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.colors.danger.fill,
  },
  header: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.gutter,
  },
  back: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
  },
  body: {
    padding: t.space.tile,
    gap: t.space.section,
  },
  steps: {
    gap: t.space.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.lg,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
  },
  stepNumber: {
    minWidth: t.space.xxxl,
  },
  stepText: {
    flex: 1,
  },
  calls: {
    gap: t.space.md,
  },
  pill: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.lg,
    paddingHorizontal: t.space.tile,
    paddingVertical: t.space.sm,
    borderRadius: t.radius.pill,
    borderWidth: t.border.emphasis,
    borderColor: t.colors.danger.ink,
  },
  pressed: {
    opacity: 0.78,
  },
  pillCopy: {
    flex: 1,
    gap: t.space.xs,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  source: {
    gap: t.space.xs,
    paddingTop: t.space.md,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.danger.ink,
  },
});
