import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Txt } from './Txt';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * A single hotline row used on Home's "hotlines" section and inside plan answers. The name sits
 * in the lead role, the number in the title role with tabular figures (bound to data, never
 * typed here), and a pill call button closes the row.
 */
export function HotlineRow({ name, number, callLabel, onCall }: {
  name: string;
  number: string;
  callLabel: string;
  onCall: () => void;
}): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Txt role="lead" tone="text">{name}</Txt>
        <Txt role="title" tone="accent" style={styles.number}>{number}</Txt>
      </View>
      <Button label={callLabel} icon="call" variant="primary" onPress={onCall} />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.lg,
    paddingVertical: t.space.md,
  },
  info: {
    flex: 1,
    gap: t.space.xs,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
})
