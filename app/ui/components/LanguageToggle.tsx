import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLang } from '../i18n';
import { colors, font, minTouch, radius, space } from '../theme';

export function LanguageToggle(): JSX.Element {
  const { lang, setLang } = useLang();
  return <View accessibilityRole="radiogroup" style={styles.wrap}>{(['tl', 'en'] as const).map((item) => (
    <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: lang === item }} onPress={() => setLang(item)} style={[styles.choice, lang === item && styles.selected]}>
      <Text style={[styles.text, lang === item && styles.selectedText]}>{item.toUpperCase()}</Text>
    </Pressable>
  ))}</View>;
}
const styles = StyleSheet.create({ wrap: { flexDirection: 'row', borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, padding: 2 }, choice: { minHeight: minTouch - 4, minWidth: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: space.sm }, selected: { backgroundColor: colors.accent }, text: { color: colors.muted, fontSize: font.sm, fontWeight: '700' }, selectedText: { color: colors.accentText } });
