import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Txt } from './Txt';
import { revealSchedule, useMinimalMotion, useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * The signature phase-switch announcement on Home: a capsule banner that reveals its copy
 * word by word and sweeps a highlighter under the emphasis word. It re-runs when `revealKey`
 * changes (the caller passes the switch timestamp).
 */
export function SwitchBanner({ text, emphasis, undoLabel, onUndo, dismissLabel, onDismiss, revealKey }: {
  text: string;
  emphasis?: string;
  undoLabel?: string;
  onUndo?: () => void;
  dismissLabel: string;
  onDismiss: () => void;
  revealKey: string;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const minimal = useMinimalMotion();

  const words = useMemo(() => text.split(/\s+/).filter((word) => word.length > 0), [text]);
  const wordCount = words.length;
  const values = useMemo(() => words.map(() => new Animated.Value(0)), [wordCount]);
  const highlight = useMemo(() => new Animated.Value(0), []);
  const banner = useMemo(() => new Animated.Value(1), []);
  const [emphasisWidth, setEmphasisWidth] = useState(0);

  const emphasisIndex = useMemo(() => {
    if (emphasis === undefined || emphasis.length === 0) return -1;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const target = normalize(emphasis);
    if (target.length === 0) return -1;
    return words.findIndex((word) => target.includes(normalize(word)));
  }, [emphasis, words]);

  useEffect(() => {
    const schedule = revealSchedule(wordCount, t.motion);
    const enter = Easing.bezier(t.motion.enter[0], t.motion.enter[1], t.motion.enter[2], t.motion.enter[3]);

    if (minimal) {
      values.forEach((value) => value.setValue(1));
      highlight.setValue(1);
      banner.setValue(0);
      const fade = Animated.timing(banner, {
        toValue: 1,
        duration: t.motion.fast,
        useNativeDriver: true,
      });
      fade.start();
      return () => fade.stop();
    }

    values.forEach((value) => value.setValue(0));
    highlight.setValue(0);
    banner.setValue(1);

    const wordAnims = values.map((value) => Animated.timing(value, {
      toValue: 1,
      duration: t.motion.reveal,
      easing: enter,
      useNativeDriver: true,
    }));
    const reveal = Animated.stagger(t.motion.stagger, wordAnims);
    const sweep = Animated.timing(highlight, {
      toValue: 1,
      duration: t.motion.highlight,
      delay: Math.max(0, schedule.total - t.motion.highlight),
      easing: enter,
      useNativeDriver: true,
    });
    const anim = Animated.parallel([reveal, sweep]);
    anim.start();
    return () => anim.stop();
  }, [revealKey, wordCount, minimal, t, values, highlight, banner]);

  const highlightHeight = Math.round(t.type.roles.lead.lineHeight * 0.4);
  const highlightTranslate = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: [-emphasisWidth / 2, 0],
  });

  const riseFor = (value: Animated.Value) => value.interpolate({
    inputRange: [0, 1],
    outputRange: [t.motion.rise, 0],
  });

  return (
    <Animated.View style={[styles.banner, { opacity: banner }]}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={text}
        style={styles.textRow}
      >
        {words.map((word, index) => {
          const value = values[index] ?? highlight;
          const wordStyle = minimal
            ? null
            : { opacity: value, transform: [{ translateY: riseFor(value) }] };
          const isEmphasis = index === emphasisIndex;
          return (
            <Animated.View
              key={`${index}-${word}`}
              style={[styles.word, wordStyle]}
              onLayout={isEmphasis ? (event) => setEmphasisWidth(event.nativeEvent.layout.width) : undefined}
            >
              {isEmphasis ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.highlightBar,
                    {
                      height: highlightHeight,
                      backgroundColor: t.colors.highlight.fill,
                      transform: [{ translateX: highlightTranslate }, { scaleX: highlight }],
                    },
                  ]}
                />
              ) : null}
              <Txt role="lead" color={t.colors.capsule.ink}>{word}</Txt>
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.actions}>
        {undoLabel !== undefined && onUndo !== undefined ? (
          <Button label={undoLabel} onPress={onUndo} variant="text" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={t.space.sm}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={t.type.roles.lead.fontSize} color={t.colors.capsule.ink} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  banner: {
    gap: t.space.lg,
    paddingVertical: t.space.lg,
    paddingHorizontal: t.space.tile,
    borderRadius: t.radius.capsule,
    backgroundColor: t.colors.capsule.fill,
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: t.space.xs,
  },
  word: {
    position: 'relative',
    marginRight: t.space.sm,
  },
  highlightBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: t.radius.pill,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: t.space.md,
  },
  dismiss: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
