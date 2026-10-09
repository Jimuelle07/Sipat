import type { JSX } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * Quiet AI status line in the Ask stream (Ask screen): a spinner with the caller's "thinking"
 * text while the model is busy, or a one-line note (for example, that AI was skipped).
 */
export function AiStatusLine({ text, busy = false }: { text: string; busy?: boolean }): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      {busy ? (
        <ActivityIndicator size="small" color={t.colors.accentText} />
      ) : (
        <Ionicons
          name="information-circle-outline"
          size={t.type.roles.bodySmall.fontSize}
          color={t.colors.textMuted}
        />
      )}
      <Txt role="bodySmall" tone="muted" style={styles.text}>{text}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  text: {
    flex: 1,
  },
})
