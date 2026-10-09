import type { JSX } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, font, minTouch, radius, space } from '../theme';
export function Field({ label, error, ...inputProps }: TextInputProps & { label: string; error?: string }): JSX.Element {
  return <><Text style={styles.label}>{label}</Text><TextInput {...inputProps} accessibilityLabel={label} style={[styles.input, inputProps.style]} placeholderTextColor={colors.muted} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}</>;
}
const styles = StyleSheet.create({ label: { color: colors.text, fontSize: font.sm, fontWeight: '600' }, input: { minHeight: minTouch, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: font.md }, error: { color: colors.danger, fontSize: font.sm } });
