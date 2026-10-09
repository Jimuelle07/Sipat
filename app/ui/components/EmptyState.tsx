import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, font, space } from '../theme';
import { Button } from './Button';
type IconName = ComponentProps<typeof Ionicons>['name'];
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: { label: string; onPress: () => void } }): JSX.Element {
  return <View style={styles.box}><Ionicons name={icon} size={36} color={colors.muted} /><Text style={styles.title}>{title}</Text>{body ? <Text style={styles.body}>{body}</Text> : null}{action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}</View>;
}
const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }, title: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' }, body: { color: colors.muted, fontSize: font.md, textAlign: 'center' } });
