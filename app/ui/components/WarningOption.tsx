import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';

function LevelBars({ count, color }: { count: number; color: string }): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.bars} accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_unused, index) => (
        <View
          key={index}
          style={[styles.bar, { backgroundColor: color, height: t.space.xs + index * t.space.hair }]}
        />
      ))}
    </View>
  );
}

/**
 * Large warning tile used in Home's "Ano ang narinig mo?" picker. Grid friendly and tall
 * enough for a deliberate tap; selection is marked with a check, never color alone.
 */
export function WarningOption({ label, tone, selected, onPress, levelGlyph }: {
  label: string;
  tone: Tone;
  selected: boolean;
  onPress: () => void;
  levelGlyph?: number;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: tone.fill,
          borderColor: tone.ink,
          borderWidth: selected ? t.border.emphasis : t.border.hairline,
        },
      ]}
    >
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark-circle" size={t.type.roles.title.fontSize} color={tone.ink} />
        </View>
      ) : null}
      {levelGlyph !== undefined ? <LevelBars count={levelGlyph} color={tone.ink} /> : null}
      <Txt role="label" align="center" color={tone.ink}>{label}</Txt>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  option: {
    flexGrow: 1,
    minHeight: t.minTouch * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.sm,
    padding: t.space.lg,
    borderRadius: t.radius.menu,
  },
  check: {
    position: 'absolute',
    top: t.space.md,
    right: t.space.md,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space.hair,
  },
  bar: {
    width: t.space.xs,
    borderRadius: t.radius.pill,
  },
})
