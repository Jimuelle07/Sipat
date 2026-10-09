import type { JSX } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';
import { commonStrings } from '../strings/common';

const LANGS = ['tl', 'en'] as const;

/**
 * Two-segment language pill wired to the stored setting; the active segment uses the selected
 * tone. Lives in the Screen header on every screen.
 */
export function LanguageToggle(): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { lang, setLang } = useLang();
  const copy = useT(commonStrings);
  const labels = { tl: copy.languageTag_tl, en: copy.languageTag_en };

  return (
    <View accessibilityRole="radiogroup" style={styles.wrap}>
      {LANGS.map((item) => {
        const active = lang === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={labels[item]}
            onPress={() => setLang(item)}
            style={[styles.choice, active && styles.selected]}
          >
            {active ? <Ionicons name="checkmark" size={t.type.roles.label.fontSize} color={t.colors.selected.ink} /> : null}
            <Txt role="label" color={active ? t.colors.selected.ink : t.colors.textMuted}>
              {labels[item]}
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
    backgroundColor: t.colors.surface,
    borderWidth: t.border.control,
    borderColor: t.colors.stickers.carbon,
  },
  choice: {
    minHeight: t.minTouch,
    minWidth: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.xs,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
  },
  selected: {
    backgroundColor: t.colors.selected.fill,
  },
})
