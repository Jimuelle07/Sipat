import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { useReduceMotion, useTheme } from '../theme';
import { Txt } from './Txt';

/**
 * Black announcement strip with uppercase text on a slow loop (design-v2 "Marquee Banner").
 * Runs in every phase; stands still only under the phone's reduce-motion setting.
 */
export function Marquee({ text }: { text: string }): JSX.Element {
  const t = useTheme();
  // Keeps scrolling in the during phase too: it is the ticker, not decoration. Only the phone's reduce-motion setting stops it.
  const minimal = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const [unit, setUnit] = useState(0);
  const line = `${text}  ✦  `;

  useEffect(() => {
    if (minimal || unit === 0) return undefined;
    // One explicit lap after another, so the strip can never settle: each lap ends exactly one copy later.
    let live = true;
    const lap = (): void => {
      x.setValue(0);
      Animated.timing(x, { toValue: -unit, duration: unit * 28, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
        if (live && finished) lap();
      });
    };
    lap();
    return () => { live = false; x.stopAnimation(); };
  }, [minimal, unit, x]);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[styles.strip, { backgroundColor: t.colors.ink, paddingVertical: t.space.sm }]}
    >
      <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} onLayout={i === 0 ? (e) => setUnit(e.nativeEvent.layout.width) : undefined}>
            <Txt role="caption" color={t.colors.stickers.paper} numberOfLines={1} style={styles.text}>{line}</Txt>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { overflow: 'hidden', alignSelf: 'stretch' },
  row: { flexDirection: 'row', width: 4000 },
  text: { textTransform: 'uppercase', letterSpacing: 1.4, flexShrink: 0 },
});
