import type { JSX } from 'react';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Txt } from './Txt';
import { useMinimalMotion, useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

/**
 * The phase-switch announcement, styled like a phone's emergency text alert: a red header strip
 * with the sender and time, then the message in bold. It drops in from the top and pulses its
 * icon twice; under minimal motion it only fades. Re-runs when `revealKey` (the switch time) changes.
 * The sender is always the app, never an agency: the alert must not pass for an official broadcast.
 */
export function SwitchBanner({ sender, time, text, reason, undoLabel, onUndo, dismissLabel, onDismiss, revealKey }: {
  sender: string;
  time: string;
  text: string;
  reason?: string;
  undoLabel?: string;
  onUndo?: () => void;
  dismissLabel: string;
  onDismiss: () => void;
  revealKey: string;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const minimal = useMinimalMotion();
  const enter = useMemo(() => new Animated.Value(1), []);
  const pulse = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    enter.setValue(0);
    pulse.setValue(0);
    const drop = Animated.timing(enter, {
      toValue: 1,
      duration: minimal ? t.motion.fast : t.motion.base,
      easing: Easing.bezier(...t.motion.enter),
      useNativeDriver: true,
    });
    if (minimal) {
      drop.start();
      return () => drop.stop();
    }
    const beat = Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: t.motion.fast, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: t.motion.fast, useNativeDriver: true }),
    ]);
    const anim = Animated.sequence([drop, beat, beat]);
    anim.start();
    return () => anim.stop();
  }, [revealKey, minimal, t, enter, pulse]);

  const ink = t.colors.danger.ink;
  const slide = minimal
    ? { opacity: enter }
    : { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-t.space.xxl, 0] }) }] };

  return (
    <Animated.View
      accessible={false}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.alert, slide]}
    >
      <View style={[styles.header, { backgroundColor: t.colors.danger.fill }]}>
        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] }}>
          <Ionicons name="warning" size={t.type.roles.lead.fontSize} color={ink} />
        </Animated.View>
        <Txt role="label" color={ink} numberOfLines={1} style={styles.sender}>{sender}</Txt>
        <Txt role="caption" color={ink}>{time}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={t.space.md}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={t.type.roles.lead.fontSize} color={ink} />
        </Pressable>
      </View>
      <View style={styles.body} accessible accessibilityLabel={reason ? `${sender}. ${text} ${reason}` : `${sender}. ${text}`}>
        <Txt role="title">{text}</Txt>
        {reason ? <Txt role="body" tone="muted">{reason}</Txt> : null}
      </View>
      {undoLabel !== undefined && onUndo !== undefined ? (
        <View style={styles.actions}>
          <Button label={undoLabel} onPress={onUndo} variant="text" icon="arrow-undo" />
        </View>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  alert: {
    overflow: 'hidden',
    borderRadius: t.radius.menu,
    borderWidth: t.border.emphasis,
    borderColor: t.colors.danger.fill,
    backgroundColor: t.colors.surface,
    boxShadow: t.shadow.float,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    minHeight: t.minTouch,
    paddingLeft: t.space.xl,
  },
  sender: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dismiss: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: t.space.xs,
    paddingHorizontal: t.space.xl,
    paddingTop: t.space.lg,
    paddingBottom: t.space.md,
  },
  actions: {
    alignItems: 'flex-end',
    paddingHorizontal: t.space.md,
    paddingBottom: t.space.sm,
  },
});
