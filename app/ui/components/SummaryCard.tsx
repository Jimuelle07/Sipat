import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * Grounded summary card in the Ask stream (Ask screen). A pinned passage is the critical one:
 * the body is bolder, it carries the `pinnedLabel` tag in highlight tone, and the tile draws
 * an emphasis accent border. Text and labels are final strings from the caller.
 */
export function SummaryCard({ title, text, pinned = false, pinnedLabel, sourceLinkLabel, onSource }: {
  title: string;
  text: string;
  pinned?: boolean;
  pinnedLabel: string;
  sourceLinkLabel: string;
  onSource: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Tile
      title={title}
      tone={pinned ? 'accent' : 'default'}
      tag={pinned ? { label: pinnedLabel, tone: t.colors.highlight } : undefined}
    >
      <Txt
        role="body"
        tone="text"
        style={pinned ? styles.pinnedText : undefined}
      >
        {text}
      </Txt>
      <View style={styles.sourceLink}>
        <Button
          label={sourceLinkLabel}
          icon="document-text-outline"
          variant="text"
          onPress={onSource}
        />
      </View>
    </Tile>
  );
}

const makeStyles = (_t: Theme) => StyleSheet.create({
  pinnedText: {
    fontWeight: '700' as const,
  },
  sourceLink: {
    alignSelf: 'flex-start',
  },
})
