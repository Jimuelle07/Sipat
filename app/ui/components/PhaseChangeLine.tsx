import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * One-line phase notice in the Ask stream (Ask screen). `switched` reports a change the app
 * already made; `recommended` offers a phase the app recognized but did not apply. The action
 * label is the caller's; nothing about the phase is decided here.
 */
export function PhaseChangeLine({ text, actionLabel, onAction, kind }: {
  text: string;
  actionLabel: string;
  onAction: () => void;
  kind: 'switched' | 'recommended';
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const switched = kind === 'switched';

  return (
    <View style={styles.row}>
      <Ionicons
        name={switched ? 'swap-horizontal' : 'sparkles'}
        size={t.type.roles.bodySmall.fontSize}
        color={switched ? t.colors.accentText : t.colors.textMuted}
      />
      <Txt role="bodySmall" tone={switched ? 'accent' : 'muted'} style={styles.text}>{text}</Txt>
      <Button label={actionLabel} variant="text" onPress={onAction} />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: t.minTouch,
  },
  text: {
    flex: 1,
  },
})
