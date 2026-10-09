import type { JSX } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, font, minTouch, radius, space } from '../theme';
type IconName = ComponentProps<typeof Ionicons>['name'];
export function Button({ label, onPress, variant = 'primary', icon, disabled = false, accessibilityLabel }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName; disabled?: boolean; accessibilityLabel?: string }): JSX.Element {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, styles[variant], disabled && styles.disabled]}>{icon ? <Ionicons name={icon} size={20} color={variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.text} /> : null}<Text style={[styles.label, variant === 'primary' && styles.primaryLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: minTouch, paddingHorizontal: space.lg, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm }, primary: { backgroundColor: colors.accent, borderColor: colors.accent }, secondary: { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, danger: { backgroundColor: colors.dangerSurface, borderColor: colors.danger }, ghost: { backgroundColor: 'transparent', borderColor: 'transparent' }, disabled: { opacity: 0.45 }, label: { color: colors.text, fontSize: font.md, fontWeight: '700' }, primaryLabel: { color: colors.accentText }, dangerLabel: { color: colors.danger } });
