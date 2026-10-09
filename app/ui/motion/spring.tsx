import type { JSX, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useMinimalMotion } from '../theme';

/**
 * Spring motion with Remotion's physics (damping / stiffness / mass, same presets).
 * Remotion itself needs a DOM and a frame clock, so only its spring model is used here,
 * driven by the native Animated loop.
 */
export const SPRING = {
  /** Remotion default: a visible overshoot. */
  bouncy: { damping: 10, stiffness: 100, mass: 1 },
  /** Remotion's `damping: 200` smooth preset, no overshoot. */
  smooth: { damping: 200, stiffness: 100, mass: 1 },
  /** Snappy press and release. */
  snap: { damping: 14, stiffness: 320, mass: 0.6 },
} as const;

export type SpringConfig = { damping: number; stiffness: number; mass: number };

/** Remotion-style interpolate for plain numbers, clamped at both ends. */
export function interpolate(input: number, from: [number, number], to: [number, number]): number {
  const t = Math.max(0, Math.min(1, (input - from[0]) / (from[1] - from[0])));
  return to[0] + (to[1] - to[0]) * t;
}

/** Springs 0 to 1 once on mount, after `delay` ms. Returns 1 at once under minimal motion. */
export function useSpringIn(delay = 0, config: SpringConfig = SPRING.bouncy): Animated.Value {
  const minimal = useMinimalMotion();
  const value = useRef(new Animated.Value(minimal ? 1 : 0)).current;
  useEffect(() => {
    if (minimal) { value.setValue(1); return undefined; }
    const run = Animated.spring(value, { toValue: 1, delay, useNativeDriver: true, ...config });
    run.start();
    return () => run.stop();
  }, [minimal, delay, config, value]);
  return value;
}

/** Scale-on-press spring for pressable surfaces. */
export function usePressSpring(to = 0.94): {
  style: { transform: { scale: Animated.Value }[] };
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const minimal = useMinimalMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const go = (toValue: number): void => {
    if (minimal) return;
    Animated.spring(scale, { toValue, useNativeDriver: true, ...SPRING.snap }).start();
  };
  return { style: { transform: [{ scale }] }, onPressIn: () => go(to), onPressOut: () => go(1) };
}

/** Rises and settles with a spring; `index` staggers siblings. */
export function SpringIn({ children, index = 0, style, rise = 28 }: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  rise?: number;
}): JSX.Element {
  const v = useSpringIn(Math.min(index, 8) * 70);
  return (
    <Animated.View
      style={[style, {
        opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Idle bob and tilt for the mascot: slow, never stops attention-grabbing. */
export function Float({ children, amplitude = 7, tilt = 2.5, style }: {
  children: ReactNode;
  amplitude?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}): JSX.Element {
  const minimal = useMinimalMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (minimal) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [minimal, v]);
  return (
    <Animated.View
      style={[style, {
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${-tilt}deg`, `${tilt}deg`] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Pops in with a rotation overshoot; for stickers. */
export function Pop({ children, delay = 0, rotate = 0, style }: {
  children: ReactNode;
  delay?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}): JSX.Element {
  const v = useSpringIn(delay, { damping: 7, stiffness: 140, mass: 0.9 });
  return (
    <Animated.View
      style={[style, {
        transform: [
          { scale: v },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${rotate - 40}deg`, `${rotate}deg`] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}
