import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Tag } from './Tag';
import { Txt } from './Txt';
import { useMinimalMotion, useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export interface AiSourceLink {
  id: string;
  label: string;
}

/**
 * The model's part of an Ask answer (Ask screen): the streaming "checking" state with a stop
 * action, the final plain-words answer with its guide sources, or a muted note when the
 * verifier rejected the model and the vetted summary takes over. Fades in over motion.fast
 * whenever the state changes.
 */
export function AiBlock({ state, text, checkingLabel, rejectedText, sourceLinks, onSource, stopLabel, onStop }: {
  state: 'partial' | 'final' | 'rejected';
  text?: string;
  checkingLabel: string;
  rejectedText?: string;
  sourceLinks?: AiSourceLink[];
  onSource: (id: string) => void;
  stopLabel?: string;
  onStop?: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const minimal = useMinimalMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (minimal) {
      opacity.setValue(1);
      return undefined;
    }
    opacity.setValue(0);
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: t.motion.fast,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [state, minimal, t.motion.fast, opacity]);

  if (state === 'partial') {
    return (
      <Animated.View style={[styles.block, { opacity }]}>
        <View style={styles.header}>
          <Tag label={checkingLabel} tone={t.colors.selected} icon="sparkles" />
          {stopLabel !== undefined && onStop !== undefined ? (
            <Button label={stopLabel} variant="text" onPress={onStop} />
          ) : null}
        </View>
        {text !== undefined && text.length > 0 ? (
          <Txt role="body" tone="muted">{text}</Txt>
        ) : null}
      </Animated.View>
    );
  }

  if (state === 'final') {
    return (
      <Animated.View style={[styles.block, { opacity }]}>
        {text !== undefined && text.length > 0 ? (
          <Txt role="body" tone="text">{text}</Txt>
        ) : null}
        {sourceLinks?.map((link) => (
          <Button
            key={link.id}
            label={link.label}
            icon="document-text-outline"
            variant="text"
            onPress={() => onSource(link.id)}
          />
        ))}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.block, { opacity }]}>
      {rejectedText !== undefined ? (
        <Txt role="bodySmall" tone="muted">{rejectedText}</Txt>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    gap: t.space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
  },
})
