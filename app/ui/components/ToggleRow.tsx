import type { JSX } from 'react';
import { Pressable, Switch, View, StyleSheet } from 'react-native';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * A settings row with a label, an optional description and a switch, used on the Profile and
 * Settings screens. The whole row is the touch target and carries the switch a11y semantics.
 */
export function ToggleRow({ label, description, value, onValueChange }: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View style={styles.texts}>
        <Txt role="body">{label}</Txt>
        {description !== undefined ? (
          <Txt role="bodySmall" tone="muted">{description}</Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessible={false}
        trackColor={{ false: t.colors.controlBorder, true: t.colors.selected.fill }}
        thumbColor={t.colors.surface}
        ios_backgroundColor={t.colors.controlBorder}
      />
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    minHeight: t.minTouch,
    paddingVertical: t.space.sm,
  },
  texts: {
    flex: 1,
    gap: t.space.hair,
  },
})
