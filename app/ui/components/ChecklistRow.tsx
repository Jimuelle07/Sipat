import type { JSX } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme, Tone } from '../theme';
import { Txt } from './Txt';
import { Tag } from './Tag';

export interface ChecklistRowProps {
  text: string;
  ticked: boolean;
  onToggle: () => void;
  tag?: { label: string; tone?: Tone };
  critical?: boolean;
  criticalLabel?: string;
}

/**
 * Household checklist line with a tappable check box; ticked lines strike through and
 * critical items carry a danger tag (Home checklist section).
 */
export function ChecklistRow({ text, ticked, onToggle, tag, critical = false, criticalLabel }: ChecklistRowProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ticked }}
      accessibilityLabel={text}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, ticked && styles.boxTicked]}>
        {ticked ? <Ionicons name="checkmark" size={t.type.roles.label.fontSize} color={t.colors.selected.ink} /> : null}
      </View>
      <View style={styles.content}>
        <Txt role="body" tone={ticked ? 'muted' : 'text'} style={ticked ? styles.struck : undefined}>
          {text}
        </Txt>
        {critical && criticalLabel ? (
          <View style={styles.tags}>
            <Tag label={criticalLabel} tone={t.colors.dangerSurface} icon="alert-circle" />
          </View>
        ) : null}
        {tag ? (
          <View style={styles.tags}>
            <Tag label={tag.label} tone={tag.tone} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.lg,
    minHeight: t.minTouch,
    paddingVertical: t.space.sm,
  },
  pressed: { opacity: 0.86 },
  box: {
    width: t.minTouch / 2,
    height: t.minTouch / 2,
    borderRadius: t.space.md,
    borderWidth: t.border.control,
    borderColor: t.colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTicked: { backgroundColor: t.colors.selected.fill, borderColor: t.colors.selected.fill },
  content: { flex: 1, gap: t.space.xs },
  struck: { textDecorationLine: 'line-through' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
})
