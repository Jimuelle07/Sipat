import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';
import { usePressSpring } from '../motion/spring';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: Tone;
  icon?: IconName;
}

/**
 * Selectable pill for filters, topics and suggestions (Guide, Ask refusal suggestions).
 * Selected state uses the selected tone plus a checkmark, so it never reads on colour alone.
 */
export function Chip({ label, selected = false, onPress, tone, icon }: ChipProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const press = usePressSpring(0.93);

  const ink = tone?.ink ?? (selected ? t.colors.selected.ink : t.colors.text);
  const glyph: IconName | undefined = selected ? 'checkmark' : icon;
  const fill = tone?.fill ?? (selected ? t.colors.selected.fill : t.colors.surface);
  const border = tone?.fill ?? (selected ? t.colors.selected.fill : t.colors.controlBorder);

  const content = (
    <>
      {glyph !== undefined ? (
        <Ionicons name={glyph} size={t.type.roles.label.fontSize} color={ink} />
      ) : null}
      <Txt role="label" color={ink} numberOfLines={1} style={styles.label}>{label}</Txt>
    </>
  );

  const surface = [
    styles.chip,
    { backgroundColor: fill, borderColor: border },
    selected && !tone ? styles.emphasis : null,
  ];

  if (onPress === undefined) {
    return <View style={surface}>{content}</View>;
  }

  return (
    <Animated.View style={[press.style, styles.wrap]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={surface}
    >
      {content}
    </Pressable>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: t.minTouch,
    paddingHorizontal: t.space.lg,
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    boxShadow: t.shadow.sticker,
  },
  emphasis: {
    borderWidth: t.border.emphasis,
  },
  label: {
    flexShrink: 1,
  },
  pressed: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
  },
})
