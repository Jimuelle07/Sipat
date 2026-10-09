import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useLang } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

const LANGS = ['tl', 'en'] as const;

/**
 * Two-segment language pill wired to the stored setting; the active segment uses the selected
 * tone. Lives in the Screen header on every screen.
 */
export function LanguageToggle(): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { lang, setLang } = useLang();

  return (
    <View accessibilityRole="radiogroup" style={styles.wrap}>
      {LANGS.map((item) => {
        const active = lang === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.toUpperCase()}
            onPress={() => setLang(item)}
            style={[styles.choice, active && styles.selected]}
          >
            <Txt role="label" color={active ? t.colors.selected.ink : t.colors.textMuted}>
              {item.toUpperCase()}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.space.hair,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceSunken,
  },
  choice: {
    minHeight: t.minTouch,
    minWidth: t.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
  },
  selected: {
    backgroundColor: t.colors.selected.fill,
  },
})
