import type { JSX } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, font } from '../theme';
export function InlineError({ message }: { message: string }): JSX.Element { return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>; }
const styles = StyleSheet.create({ error: { color: colors.danger, fontSize: font.sm } });
