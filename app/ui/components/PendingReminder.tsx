import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * Home "pendingPhotos" reminder: lists members that still need a face photo and offers the
 * camera action per row. The line text is passed in already composed by the caller.
 * Renders nothing when there is nothing pending.
 */
export function PendingReminder({ title, items, actionLabel, onAddPhoto }: {
  title: string;
  items: { id: string; text: string }[];
  actionLabel: string;
  onAddPhoto: (id: string) => void;
}): JSX.Element | null {
  const styles = useThemedStyles(makeStyles);

  if (items.length === 0) return null;

  return (
    <Tile title={title}>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Txt role="body" style={styles.text}>{item.text}</Txt>
          <Button
            label={actionLabel}
            icon="camera-outline"
            variant="text"
            accessibilityLabel={`${actionLabel}: ${item.text}`}
            onPress={() => onAddPhoto(item.id)}
          />
        </View>
      ))}
    </Tile>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    gap: t.space.md,
    minHeight: t.minTouch,
  },
  text: {},
})
