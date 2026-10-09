import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip } from './Chip';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * "Wala ito sa gabay" refusal card in the Ask stream (Ask screen). Shows the refusal text and
 * suggestion chips; each chip re-asks a nearby topic the guides do cover.
 */
export function RefusalCard({ text, suggestions, onSuggestion }: {
  text: string;
  suggestions: { topic: string; label: string }[];
  onSuggestion: (topic: string) => void;
}): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <Tile>
      <Txt role="body" tone="text">{text}</Txt>
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion.topic}
              label={suggestion.label}
              onPress={() => onSuggestion(suggestion.topic)}
            />
          ))}
        </View>
      ) : null}
    </Tile>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.sm,
  },
})
