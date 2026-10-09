import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { useMinimalMotion, useTheme } from '../theme';
import { Txt } from './Txt';

/**
 * Black announcement strip with uppercase text on a slow loop (design-v2 "Marquee Banner").
 * Stands still under minimal motion (during phase or reduce-motion).
 */
export function Marquee({ text }: { text: string }): JSX.Element {
  const t = useTheme();
  const minimal = useMinimalMotion();
  const x = useRef(new Animated.Value(0)).current;
  const [unit, setUnit] = useState(0);
  const line = `${text}  ✦  `;

  useEffect(() => {
    if (minimal || unit === 0) return undefined;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -unit, duration: unit * 28, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [minimal, unit, x]);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[styles.strip, { backgroundColor: t.colors.stickers.carbon, paddingVertical: t.space.sm }]}
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
