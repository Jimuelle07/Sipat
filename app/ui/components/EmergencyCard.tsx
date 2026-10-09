import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export interface EmergencyHotline {
  id: string;
  name: string;
  number: string;
}

/**
 * Emergency answer card in the Ask stream (Ask screen). A danger-filled tile with numbered
 * steps and one full-width call button per hotline. Steps, names and numbers arrive as props;
 * the step numbers are list indices rendered with `String(index + 1)`, never official figures.
 */
export function EmergencyCard({ title, steps, hotlines, callLabel, onCall, sourceLabel, onSource }: {
  title: string;
  steps: string[];
  hotlines: EmergencyHotline[];
  callLabel: string;
  onCall: (id: string) => void;
  sourceLabel?: string;
  onSource?: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tone = t.colors.danger;

  return (
    <View style={[styles.card, { backgroundColor: tone.fill, borderColor: tone.ink }]}>
      <View style={styles.header}>
        <Ionicons name="warning" size={t.type.roles.title.fontSize} color={tone.ink} />
        <Txt role="title" color={tone.ink} style={styles.title}>{title}</Txt>
      </View>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={`${index}-${step}`} style={styles.step}>
            <View style={[styles.stepIndex, { borderColor: tone.ink }]}>
              <Txt role="label" color={tone.ink}>{String(index + 1)}</Txt>
            </View>
            <Txt role="body" color={tone.ink} style={styles.stepText}>{step}</Txt>
          </View>
        ))}
      </View>
      {hotlines.length > 0 ? (
        <View style={styles.hotlines}>
          {hotlines.map((hotline) => (
            <Button
              key={hotline.id}
              label={`${hotline.name} \u00b7 ${hotline.number}`}
              accessibilityLabel={`${callLabel} ${hotline.name}`}
              icon="call"
              variant="tonal"
              fullWidth
              onPress={() => onCall(hotline.id)}
            />
          ))}
        </View>
      ) : null}
      {sourceLabel !== undefined && onSource !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sourceLabel}
          onPress={onSource}
          style={styles.source}
        >
          <Ionicons name="document-text-outline" size={t.type.roles.bodySmall.fontSize} color={tone.ink} />
          <Txt role="bodySmall" color={tone.ink} style={styles.sourceText}>{sourceLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    borderWidth: t.border.emphasis,
    borderRadius: t.radius.panel,
    padding: t.space.tile,
    gap: t.space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  title: {
    flex: 1,
  },
  steps: {
    gap: t.space.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.md,
  },
  stepIndex: {
    width: t.type.roles.body.lineHeight,
    height: t.type.roles.body.lineHeight,
    borderRadius: t.radius.pill,
    borderWidth: t.border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  hotlines: {
    gap: t.space.md,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    minHeight: t.minTouch,
  },
  sourceText: {
    flex: 1,
  },
})
