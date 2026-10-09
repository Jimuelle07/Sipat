import type { JSX, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageToggle } from './LanguageToggle';
import { colors, font, space } from '../theme';

export function Screen({ title, children, scroll = true, right }: { title: string; children: ReactNode; scroll?: boolean; right?: ReactNode }): JSX.Element {
  const content = scroll ? <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={styles.body}>{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text><View style={styles.actions}><LanguageToggle />{right}</View></View>{content}</SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, gap: space.md }, title: { color: colors.text, fontSize: font.xl, fontWeight: '700', flexShrink: 1 }, actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm }, body: { padding: space.lg, gap: space.lg, flexGrow: 1 } });
