import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface InlineErrorProps {
  message: string;
}

/**
 * Compact error notice: a calm alert surface with an alert icon paired with the message so the
 * error never rides on colour alone. Used under forms and in the answer stream.
 */
export function InlineError({ message }: InlineErrorProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={[styles.row, { backgroundColor: t.colors.dangerSurface.fill }]}
    >
      <Ionicons
        name="alert-circle"
        size={t.type.roles.body.fontSize}
        color={t.colors.dangerSurface.ink}
      />
      <Txt role="bodySmall" color={t.colors.dangerSurface.ink} style={styles.text}>{message}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.sm,
    borderRadius: t.radius.form,
  },
  text: {
    flexShrink: 1,
  },
})
