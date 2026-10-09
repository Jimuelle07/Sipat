import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Button } from './Button';
import { Txt } from './Txt';

export interface CapsuleProps {
  label: string;
  actionLabel: string;
  onAction: () => void;
  accessibilityHint?: string;
}

/**
 * The signature CTA capsule: a soft rounded container that pairs a `lead` label with the one
 * highlighter pill action. Used for the primary call to action on Home, Ask and Photo.
 */
export function Capsule({ label, actionLabel, onAction, accessibilityHint }: CapsuleProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.capsule}>
      <Txt role="lead" color={t.colors.capsule.ink} style={styles.label}>{label}</Txt>
      <Button
        label={actionLabel}
        onPress={onAction}
        variant="highlight"
        accessibilityHint={accessibilityHint}
      />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.lg,
    padding: t.space.gutter,
    borderRadius: t.radius.capsule,
    backgroundColor: t.colors.capsule.fill,
  },
  label: {
    flexShrink: 1,
  },
})
