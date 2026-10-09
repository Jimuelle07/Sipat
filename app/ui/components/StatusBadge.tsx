import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Small status pill used on Home for AI availability and battery state. Every state pairs
 * its color with an icon (or a spinner while busy) so the meaning never rides on color.
 */
export function StatusBadge({ label, state, icon }: {
  label: string;
  state: 'on' | 'off' | 'busy';
  icon?: IconName;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  const tone = state === 'on'
    ? t.colors.selected
    : state === 'busy'
      ? { fill: t.colors.surfaceSunken, ink: t.colors.accentText }
      : { fill: t.colors.surfaceSunken, ink: t.colors.textMuted };
  const glyph: IconName | undefined = icon
    ?? (state === 'on' ? 'checkmark-circle' : state === 'off' ? 'close-circle' : undefined);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: tone.fill }]}
    >
      {state === 'busy' ? (
        <ActivityIndicator size="small" color={t.colors.accentText} />
      ) : glyph !== undefined ? (
        <Ionicons name={glyph} size={t.type.roles.caption.fontSize} color={tone.ink} />
      ) : null}
      <Txt role="caption" color={tone.ink}>{label}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  badge: {
    height: t.minTouch,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingHorizontal: t.space.lg,
    borderRadius: t.radius.pill,
  },
})
