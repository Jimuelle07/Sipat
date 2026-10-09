import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { AccessibilityInfo, PixelRatio, StyleSheet, useColorScheme } from 'react-native';
import type { Phase } from '../../engine';
import { buildTheme } from './themes';
import type { Scheme, Theme } from './types';

/** System font scale at which the large-text variant takes over. */
const LARGE_TEXT_FONT_SCALE = 1.3;

interface ThemeContextValue {
  theme: Theme;
  reduceMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Picks one of the 12 themes (3 phases × light/dark × regular/large text).
 * The phase comes from the caller (context.get().phase); the scheme follows the phone
 * unless overridden; large text follows the phone's font scale unless overridden.
 */
export function ThemeProvider({ phase, scheme, largeText, children }: {
  phase: Phase;
  scheme?: Scheme;
  largeText?: boolean;
  children: ReactNode;
}): JSX.Element {
  const system = useColorScheme();
  const resolvedScheme: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const resolvedLarge = largeText ?? PixelRatio.getFontScale() >= LARGE_TEXT_FONT_SCALE;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => { if (alive) setReduceMotion(on); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = buildTheme({ phase, scheme: resolvedScheme, largeText: resolvedLarge });
    return { theme, reduceMotion };
  }, [phase, resolvedScheme, resolvedLarge, reduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** True when the phone asks for less motion or the theme's motion style is minimal. */
export function useMinimalMotion(): boolean {
  const { theme, reduceMotion } = useThemeContext();
  return reduceMotion || theme.motion.style === 'minimal';
}

/**
 * Builds the active theme's styles, rebuilt only when the theme changes.
 * The factory returns `StyleSheet.create({...})` so literal style types are checked at the definition.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
