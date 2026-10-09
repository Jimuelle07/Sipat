import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface TagProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
}

/**
 * Small caption pill that labels a tile or marks a state. Pair it with an icon so meaning
 * never rides on colour alone. Used inside Tile, PhaseSelector, MemberCardView, ChecklistRow
 * and the answer cards (Ask stream).
 */
export function Tag({ label, tone, icon }: TagProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const fill = tone?.fill ?? t.colors.selected.fill;
  const ink = tone?.ink ?? t.colors.selected.ink;

  return (
    <View style={[styles.tag, { backgroundColor: fill }]}>
      {icon !== undefined ? (
        <Ionicons name={icon} size={t.type.roles.caption.fontSize} color={ink} />
      ) : null}
      <Txt role="caption" color={ink}>{label}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    paddingHorizontal: t.space.gutter,
    borderRadius: t.radius.pill,
  },
})
