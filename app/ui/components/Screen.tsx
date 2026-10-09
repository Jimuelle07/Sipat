import type { JSX, ReactNode } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
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
}

/**
 * Page shell for every screen: canvas background, safe area, a header with the title, the
 * language toggle and optional trailing actions, and a gutter-spaced body. In the "during"
 * (essentials) theme the mascot sits at the header end.
 */
export function Screen({ title, children, scroll = true, right, mascot }: ScreenProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const headerMascot = t.mascot.placement === 'headerEnd' ? mascot : null;

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
        <Txt role="headline" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Txt>
        <View style={styles.actions}>
          {headerMascot}
          <LanguageToggle />
          {right}
        </View>
      </View>
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
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
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
