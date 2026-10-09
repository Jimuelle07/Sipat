import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
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
 * Active-warning chip on Home's "warnings" section. A tone-colored pill with the label,
 * an optional age and a level-bars glyph (so the level never rides on color alone), plus a
 * clear action. When stale it shows an attached danger row with a reconfirm action.
 */
export function WarningChip({ label, ageText, tone, levelGlyph, stale, staleText, reconfirmLabel, onReconfirm, clearLabel, onClear }: {
  label: string;
  ageText?: string;
  tone: Tone;
  levelGlyph?: number;
  stale?: boolean;
  staleText?: string;
  reconfirmLabel?: string;
  onReconfirm?: () => void;
  clearLabel: string;
  onClear: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: tone.fill }]}>
        {levelGlyph !== undefined ? <LevelBars count={levelGlyph} color={tone.ink} /> : null}
        <Txt role="label" color={tone.ink}>{label}</Txt>
        {ageText !== undefined ? (
          <Txt role="caption" color={tone.ink}>{ageText}</Txt>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={t.space.sm}
          onPress={onClear}
          style={styles.clear}
        >
          <Ionicons name="close" size={t.type.roles.label.fontSize} color={tone.ink} />
        </Pressable>
      </View>
      {stale ? (
        <View style={[styles.staleRow, { backgroundColor: t.colors.dangerSurface.fill }]}>
          <Ionicons
            name="alert-circle"
            size={t.type.roles.bodySmall.fontSize}
            color={t.colors.dangerSurface.ink}
          />
          {staleText !== undefined ? (
            <Txt role="bodySmall" color={t.colors.dangerSurface.ink} style={styles.staleText}>{staleText}</Txt>
          ) : null}
          {reconfirmLabel !== undefined && onReconfirm !== undefined ? (
            <Button label={reconfirmLabel} onPress={onReconfirm} variant="tonal" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.xs,
    alignItems: 'flex-start',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: t.minTouch,
    paddingLeft: t.space.lg,
    paddingRight: t.space.xs,
    borderRadius: t.radius.pill,
  },
  clear: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
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
  staleRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    padding: t.space.md,
    borderRadius: t.radius.menu,
  },
  staleText: {
    flex: 1,
  },
})
