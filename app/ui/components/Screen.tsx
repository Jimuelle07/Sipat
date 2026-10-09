import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { LanguageToggle } from './LanguageToggle';
import { Txt } from './Txt';

export interface ScreenProps {
  title: string;
  children: ReactNode;
  scroll?: boolean;
  right?: ReactNode;
  /** Rendered at the header's end when the active theme places the mascot there. */
  mascot?: ReactNode;
  /** Stack screens: shows a back arrow before the title. */
  back?: { label: string; onPress: () => void };
  /** App-wide banners (phase switch, stale warning) rendered above the body, outside the scroll. */
  banner?: ReactNode;
  /** Hides the language toggle (full-bleed screens such as the photo studio). */
  hideLanguage?: boolean;
}

/**
 * Page shell for every screen: canvas background, safe area, a header with the title, the
 * language toggle and optional trailing actions, and a gutter-spaced body. The header is a
 * single wrapping row: the title (with an optional back arrow) takes the first line and the
 * compact actions wrap to a deliberate second line, right-aligned, only when they cannot sit
 * beside the title. In the "during" (essentials) theme the mascot sits at the header end.
 */
export function Screen({ title, children, scroll = true, right, mascot, back, banner, hideLanguage = false }: ScreenProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const headerMascot = t.mascot.placement === 'headerEnd' ? mascot : null;
  const hasActions = !hideLanguage || headerMascot !== null || right !== undefined;

  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.bodyFlex}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={back.label}
              onPress={back.onPress}
              hitSlop={t.space.md}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={t.type.roles.title.fontSize} color={t.colors.text} />
            </Pressable>
          ) : null}
          <Txt role="headline" accessibilityRole="header" numberOfLines={2} style={styles.title}>
            {title}
          </Txt>
        </View>
        {hasActions ? (
          <View style={styles.actions}>
            {hideLanguage ? null : <LanguageToggle />}
            {headerMascot}
            {right}
          </View>
        ) : null}
      </View>
      {banner ? <View style={styles.banner}>{banner}</View> : null}
      {body}
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.colors.canvas,
  },
  header: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.space.sm,
    rowGap: t.space.xs,
    paddingHorizontal: t.space.gutter,
    paddingTop: t.space.md,
  },
  titleGroup: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gutter,
  },
  title: {
    flexShrink: 1,
  },
  back: {
    width: t.minTouch,
    height: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stickers.carbon,
    backgroundColor: t.colors.wash,
  },
  banner: {
    paddingHorizontal: t.space.gutter,
    gap: t.space.sm,
  },
  actions: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: t.space.sm,
    marginLeft: 'auto',
  },
  body: {
    padding: t.space.gutter,
    gap: t.space.gutter,
    flexGrow: 1,
  },
  bodyFlex: {
    flex: 1,
    padding: t.space.gutter,
    gap: t.space.gutter,
  },
})
