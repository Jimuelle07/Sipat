import type { JSX, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
export function Card({ title, subtitle, children, tone = 'default' }: { title?: string; subtitle?: string; children: ReactNode; tone?: 'default' | 'danger' | 'accent' }): JSX.Element {
  return <View style={[styles.card, tone === 'danger' && styles.danger, tone === 'accent' && styles.accent]}>{title ? <Text style={styles.title}>{title}</Text> : null}{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}{children}</View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm }, danger: { backgroundColor: colors.dangerSurface, borderColor: colors.danger }, accent: { borderColor: colors.accent }, title: { color: colors.text, fontSize: font.lg, fontWeight: '700' }, subtitle: { color: colors.muted, fontSize: font.sm } });
