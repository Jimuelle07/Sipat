import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDockInset } from '../context/DockInset';
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
  // The tab dock floats over the screen, so tab screens reserve its height at the end of the body.
  const dockHeight = useDockInset();
  // The header floats over the body (no bar behind it), so the body starts below its measured height.
  const [overlayHeight, setOverlayHeight] = useState(0);
  const headerMascot = t.mascot.placement === 'headerEnd' ? mascot : null;
  const hasActions = !hideLanguage;

  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.body, { paddingTop: styles.body.padding + overlayHeight, paddingBottom: styles.body.padding + dockHeight + (dockHeight > 0 ? 24 : 0) }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.bodyFlex, { paddingTop: styles.bodyFlex.padding + overlayHeight, paddingBottom: styles.bodyFlex.padding + dockHeight + (dockHeight > 0 ? 24 : 0) }]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {body}
      <View pointerEvents="box-none" style={styles.overlay} onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={styles.header}>
        <View pointerEvents="box-none" style={styles.titleGroup}>
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
          {headerMascot !== null && headerMascot !== undefined ? <View style={styles.headerMascot}>{headerMascot}</View> : null}
          {hideLanguage && right !== undefined ? <View style={styles.headerMascot}>{right}</View> : null}
        </View>
        {hasActions ? (
          <View pointerEvents="box-none" style={styles.actions}>
            {hideLanguage ? null : <LanguageToggle />}
            <View style={styles.actionsEnd}>
              {right}
            </View>
          </View>
        ) : null}
      </View>
      {banner ? <View style={styles.banner}>{banner}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.colors.canvas,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
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
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.wash,
  },
  banner: {
    paddingHorizontal: t.space.gutter,
    gap: t.space.sm,
  },
  actions: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.sm,
  },
  headerMascot: {
    marginLeft: 'auto',
  },
  actionsEnd: {
    flexDirection: 'row',
    alignItems: 'center',
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
