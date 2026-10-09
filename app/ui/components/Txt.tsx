import type { JSX } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme';
import type { TypeRole } from '../theme';

export type TxtTone = 'text' | 'muted' | 'accent' | 'brand' | 'onFill';

/** `role` is the type-scale step; React Native's ARIA `role` prop is not used (use `accessibilityRole`). */
export interface TxtProps extends Omit<TextProps, 'style' | 'role'> {
  role?: TypeRole;
  tone?: TxtTone;
  align?: TextStyle['textAlign'];
  /** Theme value only; wins over `tone`. */
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * The single text primitive for the whole UI. Pick a `role` for the size/weight step and a
 * `tone` for the ink; pass `color` only for a fill-specific ink (Tag/Chip fill pairs).
 * Used on every screen (Home, Ask, Photo, Guide, Hotlines, Profile, Account) and inside
 * every other component.
 */
export function Txt({
  role = 'body',
  tone = 'text',
  align,
  color,
  style,
  accessibilityRole,
  children,
  ...rest
}: TxtProps): JSX.Element {
  const t = useTheme();
  const token = t.type.roles[role];
  const ink = color
    ?? (tone === 'muted'
      ? t.colors.textMuted
      : tone === 'accent'
        ? t.colors.accentText
        : tone === 'brand'
          ? t.colors.brand
          : tone === 'onFill'
            ? t.colors.capsule.ink
            : t.colors.text);

  return (
    <Text
      {...rest}
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={t.type.maxFontSizeMultiplier}
      style={[
        {
          fontSize: token.fontSize,
          lineHeight: token.lineHeight,
          // Bundled faces carry their own weight; a fontWeight on top would be faked on Android.
          fontFamily: token.fontWeight === '800' ? t.type.families.display : token.fontWeight === '700' ? t.type.families.bold : t.type.families.medium,
          fontWeight: 'normal',
          letterSpacing: token.letterSpacing,
        },
        { color: ink },
        align !== undefined ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
