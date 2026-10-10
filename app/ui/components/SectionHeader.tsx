import type { JSX } from 'react';
import type { AccessibilityState } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Button } from './Button';
import { Txt } from './Txt';

export interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void; accessibilityState?: AccessibilityState };
}

/**
 * Section title row for Home and Guide: a headline with an optional quiet text action such as
 * "Lahat" on the right.
 */
export function SectionHeader({ title, action }: SectionHeaderProps): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      <Txt role="headline" accessibilityRole="header" style={styles.title}>{title}</Txt>
      {action !== undefined ? (
        <Button label={action.label} onPress={action.onPress} variant="outline" accessibilityState={action.accessibilityState} />
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.gutter,
  },
  title: {
    flexShrink: 1,
  },
})
