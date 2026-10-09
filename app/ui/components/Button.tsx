import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ButtonVariant = 'highlight' | 'primary' | 'tonal' | 'outline' | 'text' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  fullWidth?: boolean;
}

function inkFor(t: Theme, variant: ButtonVariant): string {
  switch (variant) {
    case 'highlight':
      return t.colors.highlight.ink;
    case 'primary':
      return t.colors.primary.ink;
    case 'tonal':
      return t.colors.capsule.ink;
    case 'danger':
      return t.colors.danger.ink;
    case 'outline':
      return t.colors.text;
    case 'text':
      return t.colors.brand;
  }
}

/**
 * Pill-shaped action button. `highlight` is the one loud action per view; `text` is the quiet
 * inline action (section headers, banner undo). Used across every screen and inside Capsule,
 * EmptyState, WarningChip, StaleBanner, SwitchBanner and the CropFrame zoom controls.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  fullWidth = false,
}: ButtonProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ink = inkFor(t, variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon !== undefined ? <Ionicons name={icon} size={t.type.roles.label.fontSize} color={ink} /> : null}
      <Txt role="label" color={ink} style={styles.label}>{label}</Txt>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  base: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.sm,
    paddingHorizontal: t.space.lg,
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
  },
  highlight: {
    backgroundColor: t.colors.highlight.fill,
    borderColor: t.colors.highlight.fill,
  },
  primary: {
    backgroundColor: t.colors.primary.fill,
    borderColor: t.colors.primary.fill,
  },
  tonal: {
    backgroundColor: t.colors.capsule.fill,
    borderColor: t.colors.capsule.fill,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: t.colors.controlBorder,
  },
  text: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: t.space.xs,
  },
  danger: {
    backgroundColor: t.colors.danger.fill,
    borderColor: t.colors.danger.fill,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.86,
  },
  label: {
    flexShrink: 1,
  },
})
