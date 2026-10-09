import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CopyKey } from '../../types';
import { useEngine } from '../context/useEngine';
import { useLang } from '../i18n';
import { colors, font, space } from '../theme';
export function SafetyText({ copyKey }: { copyKey: CopyKey }): JSX.Element {
  const engine = useEngine(); const { lang } = useLang();
  return <View style={styles.wrap}><Text style={styles.primary}>{engine.copy(copyKey)}</Text>{lang === 'en' ? <Text style={styles.translation}>{engine.copy(copyKey, 'en')}</Text> : null}</View>;
}
const styles = StyleSheet.create({ wrap: { gap: space.xs }, primary: { color: colors.text, fontSize: font.md }, translation: { color: colors.muted, fontSize: font.sm } });
