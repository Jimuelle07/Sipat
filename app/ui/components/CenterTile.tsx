import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * Home "center" tile in the during phase: the household's evacuation center and meeting
 * place. Empty when the family has not set one, with an optional action to fill it in.
 */
export function CenterTile({ title, name, meetingPlace, emptyText, actionLabel, onAction }: {
  title: string;
  name: string;
  meetingPlace?: string;
  emptyText?: string;
  actionLabel?: string;
  onAction?: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hasName = name.trim().length > 0;

  return (
    <Tile title={title}>
      {hasName ? (
        <View style={styles.row}>
          <Ionicons name="home" size={t.type.roles.title.fontSize} color={t.colors.accentText} />
          <Txt role="title" tone="accent" style={styles.name}>{name}</Txt>
        </View>
      ) : emptyText !== undefined ? (
        <Txt role="body" tone="muted">{emptyText}</Txt>
      ) : null}
      {meetingPlace !== undefined && meetingPlace.length > 0 ? (
        <View style={styles.row}>
          <Ionicons name="people" size={t.type.roles.bodySmall.fontSize} color={t.colors.textMuted} />
          <Txt role="bodySmall" tone="muted" style={styles.name}>{meetingPlace}</Txt>
        </View>
      ) : null}
      {actionLabel !== undefined && onAction !== undefined ? (
        <Button label={actionLabel} onPress={onAction} variant="tonal" />
      ) : null}
    </Tile>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  name: {
    flex: 1,
  },
})
