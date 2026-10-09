import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Phase } from '../../engine';
import { Tag } from './Tag';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

const PHASES: readonly Phase[] = ['before', 'during', 'after'];

/**
 * Three-segment phase control for the Home hero ("Ngayon").
 * It only reports the phase the user picked; the caller decides anything else.
 */
export function PhaseSelector({ value, recommended, reasonText, labels, recommendedLabel, onSelect }: {
  value: Phase;
  recommended?: Phase;
  reasonText?: string;
  labels: Record<Phase, string>;
  recommendedLabel: string;
  onSelect: (phase: Phase) => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.track}>
        {PHASES.map((phase) => {
          const active = value === phase;
          const showRecommended = recommended !== undefined && recommended === phase && recommended !== value;
          return (
            <Pressable
              key={phase}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={showRecommended ? `${labels[phase]}. ${recommendedLabel}` : labels[phase]}
              onPress={() => onSelect(phase)}
              style={styles.segment}
            >
              <View style={[styles.segmentFill, active && styles.segmentSelected]}>
                {active ? (
                  <Ionicons name="checkmark" size={t.type.roles.label.fontSize} color={t.colors.selected.ink} />
                ) : null}
                <Txt
                  role="caption"
                  numberOfLines={1}
                  color={active ? t.colors.selected.ink : t.colors.text}
                >
                  {labels[phase]}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
      {recommended !== undefined && recommended !== value ? (
        <View style={styles.recommendation}>
          <Tag label={recommendedLabel} tone={t.colors.highlight} icon="sparkles" />
          <Txt role="bodySmall" tone="muted">{labels[recommended]}</Txt>
        </View>
      ) : null}
      {reasonText !== undefined && reasonText.length > 0 ? (
        <Txt role="bodySmall" tone="muted" style={styles.reason}>{reasonText}</Txt>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.sm,
  },
  track: {
    flexDirection: 'row',
    gap: t.space.xs,
    padding: t.space.xs,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: t.border.control,
    borderColor: t.colors.stickers.carbon,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.xs,
  },
  segmentFill: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.xs,
    minHeight: t.minTouch - t.space.xs * 2,
    paddingHorizontal: t.space.xs,
    borderRadius: t.radius.pill,
  },
  segmentSelected: {
    backgroundColor: t.colors.selected.fill,
    borderWidth: t.border.control,
    borderColor: t.colors.stickers.carbon,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: t.space.sm,
    paddingHorizontal: t.space.xs,
  },
  reason: {
    paddingHorizontal: t.space.xs,
  },
})
