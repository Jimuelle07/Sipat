import type { JSX, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Animated, Image, Pressable, RefreshControl, View, StyleSheet } from 'react-native';
import logo from '../../../assets/agi-sipat-logo.png';
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
  /** Replaces the plain title row (the Gabay front page masthead). */
  masthead?: ReactNode;
  /** Hides the language toggle (full-bleed screens such as the photo studio). */
  hideLanguage?: boolean;
  /** Pull to refresh on scrolling screens (the feed); the caller owns the request. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
}

/**
 * Page shell for every screen: canvas background, safe area, a header with the title, the
 * language toggle and optional trailing actions, and a gutter-spaced body. The header is a
 * single wrapping row: the title (with an optional back arrow) takes the first line and the
 * compact actions wrap to a deliberate second line, right-aligned, only when they cannot sit
 * beside the title. In the "during" (essentials) theme the mascot sits at the header end.
 */
export function Screen({ title, children, scroll = true, right, mascot, back, banner, masthead, hideLanguage = false, refresh }: ScreenProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The tab dock floats over the screen, so tab screens reserve its height at the end of the body.
  const dockHeight = useDockInset();
  // The header floats over the body (no bar behind it), so the body starts below its measured height.
  const [overlayHeight, setOverlayHeight] = useState(0);
  // The floating controls ease down to a lower opacity as the content scrolls beneath them.
  const scrollY = useRef(new Animated.Value(0)).current;
  const controlsOpacity = scroll
    ? scrollY.interpolate({ inputRange: [0, 140], outputRange: [1, 0.45], extrapolate: 'clamp' })
    : 1;
  const headerMascot = t.mascot.placement === 'headerEnd' ? mascot : null;
  const hasActions = !hideLanguage;

  // The title scrolls with the content; only the controls float (no bar behind them).
  const titleRow = masthead ?? (
    <View style={styles.titleGroup}>
      <Txt role="headline" accessibilityRole="header" numberOfLines={2} style={styles.title}>
        {title}
      </Txt>
      {headerMascot !== null && headerMascot !== undefined ? <View style={styles.headerMascot}>{headerMascot}</View> : null}
    </View>
  );
  const padTop = styles.body.padding + overlayHeight + t.space.md;
  const padBottom = styles.body.padding + dockHeight + (dockHeight > 0 ? 24 : 0);

  const body = scroll ? (
    <Animated.ScrollView
      contentContainerStyle={[styles.body, { paddingTop: padTop, paddingBottom: padBottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      refreshControl={refresh ? (
        <RefreshControl
          refreshing={refresh.refreshing}
          onRefresh={refresh.onRefresh}
          progressViewOffset={overlayHeight}
          tintColor={t.colors.accentText}
          colors={[t.colors.accentText]}
        />
      ) : undefined}
    >
      {titleRow}
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={[styles.bodyFlex, { paddingTop: padTop, paddingBottom: padBottom }]}>
      {titleRow}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {body}
      <View pointerEvents="box-none" style={styles.overlay} onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}>
        <Animated.View pointerEvents="box-none" style={[styles.header, { opacity: controlsOpacity }]}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={back.label}
              onPress={back.onPress}
              hitSlop={t.space.md}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={t.type.roles.title.fontSize} color={t.colors.ink} />
            </Pressable>
          ) : null}
          <Image source={logo} accessibilityIgnoresInvertColors style={styles.logo} />
          {hideLanguage ? null : <LanguageToggle />}
          <View pointerEvents="box-none" style={styles.actionsEnd}>
            {right}
          </View>
        </Animated.View>
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
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gutter,
  },
  title: {
    flexShrink: 1,
  },
  logo: {
    width: t.minTouch * 0.75,
    height: t.minTouch * 0.75,
    borderRadius: t.radius.pill,
  },
  back: {
    width: t.minTouch,
    height: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.surface,
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
