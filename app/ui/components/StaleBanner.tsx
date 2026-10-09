import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * Stale-warning reminder shown on Home (and reused wherever live data may be out of date).
 * A calm alert surface with an optional action such as reconfirming the warning.
 */
export function StaleBanner({ text, translation, actionLabel, onAction }: {
  text: string;
  translation?: string;
  actionLabel?: string;
  onAction?: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={[styles.banner, { backgroundColor: t.colors.dangerSurface.fill }]}
    >
      <Ionicons
        name="alert-circle"
        size={t.type.roles.lead.fontSize}
        color={t.colors.dangerSurface.ink}
      />
      <View style={styles.copy}>
        <Txt role="body" color={t.colors.dangerSurface.ink}>{text}</Txt>
        {translation !== undefined ? <Txt role="bodySmall" color={t.colors.dangerSurface.ink}>{translation}</Txt> : null}
      </View>
      {actionLabel !== undefined && onAction !== undefined ? (
        <Button label={actionLabel} onPress={onAction} variant="tonal" />
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    padding: t.space.lg,
    borderRadius: t.radius.menu,
  },
  copy: {
    flex: 1,
    gap: t.space.xs,
  },
})
