import type { JSX, ReactNode } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';
import { usePressSpring } from '../motion/spring';
import { Tag } from './Tag';
import { Txt } from './Txt';

export type TileTone = 'default' | 'danger' | 'accent';

export interface TileProps {
  children: ReactNode;
  tag?: { label: string; tone?: Tone };
  title?: string;
  subtitle?: string;
  tone?: TileTone;
  /** Sticker colour for the fill (palette value from the theme). */
  wash?: string;
  /** Degrees of tilt, like a cut-out pinned slightly off square. */
  tilt?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Soft floating surface (radius.panel, hairline border) that holds a Home section: the pending
 * photo reminder, warning groups, checklist and answer cards. `danger` and `accent` recolour it
 * for emergency and highlighted content.
 */
export function Tile({
  children,
  tag,
  title,
  subtitle,
  tone = 'default',
  wash,
  tilt = 0,
  onPress,
  accessibilityLabel,
}: TileProps): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const press = usePressSpring(0.97);

  const body = (
    <>
      {tag !== undefined ? <Tag label={tag.label} tone={tag.tone} /> : null}
      {title !== undefined ? <Txt role="title">{title}</Txt> : null}
      {subtitle !== undefined ? <Txt role="bodySmall" tone="muted">{subtitle}</Txt> : null}
      {children}
    </>
  );

  const surface = [
    styles.tile,
    wash !== undefined && { backgroundColor: wash },
    tilt !== 0 && { transform: [{ rotate: `${tilt}deg` }] },
    tone === 'danger' && styles.danger,
    tone === 'accent' && styles.accent,
  ];

  if (onPress === undefined) {
    return <View style={surface}>{body}</View>;
  }

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={surface}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  tile: {
    alignSelf: 'stretch',
    backgroundColor: t.colors.surface,
    borderColor: t.colors.hairline,
    borderWidth: t.border.hairline,
    borderRadius: t.radius.panel,
    boxShadow: t.shadow.sticker,
    padding: t.space.tile,
    gap: t.space.lg,
  },
  danger: {
    backgroundColor: t.colors.dangerSurface.fill,
    borderColor: t.colors.danger.fill,
    borderWidth: t.border.emphasis,
  },
  accent: {
    borderColor: t.colors.accentText,
    borderWidth: t.border.emphasis,
  },
  pressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
  },
})
