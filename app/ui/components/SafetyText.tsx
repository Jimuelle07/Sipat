import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface SafetyTextProps {
  text: string;
  /** Optional plain-English helper shown under the primary text. */
  translation?: string;
}

/**
 * Safety sentence presentation (always last in an answer). Props-only: callers pass
 * `engine.copy(key)` and the English helper; the component never reads the engine itself.
 * Used on Home, Ask and the emergency cards.
 */
export function SafetyText({ text, translation }: SafetyTextProps): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <Txt role="body">{text}</Txt>
      {translation !== undefined ? (
        <Txt role="bodySmall" tone="muted">{translation}</Txt>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.xs,
  },
})
