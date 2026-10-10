import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Button } from './Button';
import { MascotSlot } from './MascotSlot';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

/**
 * Centred empty/zero state with a glyph, a headline, supporting copy and an optional action.
 * Used for empty checklists, no-guide matches, no hotlines and the Ask stream before a question.
 */
export function EmptyState({ icon, title, body, action }: EmptyStateProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.box}>
      <View style={styles.blob}>
        <MascotSlot size={150} accessibilityLabel={title} />
        <Ionicons name={icon} size={t.type.roles.title.fontSize} color={t.colors.ink} style={styles.glyph} />
      </View>
      <Txt role="title" align="center">{title}</Txt>
      {body !== undefined ? <Txt role="body" tone="muted" align="center">{body}</Txt> : null}
      {action !== undefined ? (
        <Button label={action.label} onPress={action.onPress} variant="primary" />
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.md,
    padding: t.space.xxl,
  },
  blob: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.wash,
  },
  glyph: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: t.space.sm,
    overflow: 'hidden',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.stickers.sunburst,
  },
})
