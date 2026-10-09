import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from './Txt';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * The safety closing line that always ends an Ask answer (Ask screen): a short hairline rule
 * above the standing "follow your barangay and the authorities" reminder from the engine.
 */
export function ClosingLine({ text }: { text: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.rule} />
      <Txt role="bodySmall" tone="accent">{text}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: t.space.sm,
  },
  rule: {
    height: t.border.hairline,
    width: t.space.xxxl,
    backgroundColor: t.colors.hairline,
  },
})
