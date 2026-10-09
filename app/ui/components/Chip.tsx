import type { JSX } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, minTouch, radius, space } from '../theme';
export function Chip({ label, selected = false, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }): JSX.Element {
  const content = <Text style={[styles.text, selected && styles.selectedText, color ? { color } : null]}>{label}</Text>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.selected]}>{content}</Pressable> : <Text style={[styles.chip, selected && styles.selected, styles.text]}>{label}</Text>;
}
const styles = StyleSheet.create({ chip: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill }, selected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised }, text: { color: colors.text, fontSize: font.sm }, selectedText: { color: colors.accent, fontWeight: '700' } });
