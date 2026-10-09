import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, minTouch } from '../theme';
export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }): JSX.Element {
  return <View style={styles.row}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{action ? <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.action}><Text style={styles.actionText}>{action.label}</Text></Pressable> : null}</View>;
}
const styles = StyleSheet.create({ row: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: colors.text, fontSize: font.lg, fontWeight: '700' }, action: { minHeight: minTouch, justifyContent: 'center' }, actionText: { color: colors.accent, fontSize: font.sm, fontWeight: '700' } });
