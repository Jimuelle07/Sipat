import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface ProgressBarProps {
  /** 0..1. */
  value: number;
  label?: string;
}

/**
 * Pill progress track on a sunken well, filled with the phase accent. Used for checklist
 * completion on Home and battery/readiness blocks.
 */
export function ProgressBar({ value, label }: ProgressBarProps): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const progress = Math.max(0, Math.min(1, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={styles.wrap}
    >
      {label !== undefined ? <Txt role="caption" tone="muted">{label}</Txt> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.xs,
  },
  track: {
    height: t.space.xl,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.border.control,
    borderColor: t.colors.stickers.carbon,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.wash,
  },
})
