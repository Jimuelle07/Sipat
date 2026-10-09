import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
export function ProgressBar({ value, label }: { value: number; label?: string }): JSX.Element {
  const progress = Math.max(0, Math.min(1, value));
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={styles.wrap}>{label ? <Text style={styles.label}>{label}</Text> : null}<View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View></View>;
}
const styles = StyleSheet.create({ wrap: { gap: space.sm }, label: { color: colors.muted, fontSize: font.sm }, track: { height: 10, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceRaised }, fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill } });
