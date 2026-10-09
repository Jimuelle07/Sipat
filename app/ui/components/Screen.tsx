import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { DevPanelEntry } from '../context/DevPanel';
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
 * language toggle and optional trailing actions, and a gutter-spaced body. In the "during"
 * (essentials) theme the mascot sits at the header end.
 */
export function Screen({ title, children, scroll = true, right, mascot, back, banner, hideLanguage = false }: ScreenProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const route = useRoute();
  const headerMascot = t.mascot.placement === 'headerEnd' ? mascot : null;
  const showDevEntry = route.name === 'Settings';

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
      {!hideLanguage || headerMascot || right || showDevEntry ? (
        <View style={styles.statusRow}>
          {hideLanguage ? null : <LanguageToggle />}
          {headerMascot}
          {right}
          {showDevEntry ? <DevPanelEntry /> : null}
        </View>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.gutter,
    paddingHorizontal: t.space.gutter,
  },
  title: {
    flex: 1,
  },
  back: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
  },
  banner: {
    paddingHorizontal: t.space.gutter,
    gap: t.space.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: t.space.sm,
    paddingHorizontal: t.space.gutter,
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
