import type { JSX, ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';
import { Tag } from './Tag';
import { Txt } from './Txt';

export type TileTone = 'default' | 'danger' | 'accent';

export interface TileProps {
  children: ReactNode;
  tag?: { label: string; tone?: Tone };
  title?: string;
  subtitle?: string;
  tone?: TileTone;
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
  onPress,
  accessibilityLabel,
}: TileProps): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  const body = (
    <>
      {tag !== undefined ? <Tag label={tag.label} tone={tag.tone} /> : null}
      {title !== undefined ? <Txt role="title">{title}</Txt> : null}
      {subtitle !== undefined ? <Txt role="bodySmall" tone="muted">{subtitle}</Txt> : null}
      {children}
    </>
  );

  const surface = [styles.tile, tone === 'danger' && styles.danger, tone === 'accent' && styles.accent];

  if (onPress === undefined) {
    return <View style={surface}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [...surface, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  tile: {
    alignSelf: 'stretch',
    backgroundColor: t.colors.surface,
    borderColor: t.colors.hairline,
    borderWidth: t.border.hairline,
    borderRadius: t.radius.panel,
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
    opacity: 0.86,
  },
})
