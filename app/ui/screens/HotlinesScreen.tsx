import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEngine, useEngineChange } from '../context/useEngine';
import { hotlineStrings } from '../strings/hotlines';
import { useT } from '../i18n';
import { Button, Card, EmptyState, InlineError, Screen, SectionHeader } from '../components';
import { colors, font, space } from '../theme';

export function hotlineErrorMessage(code: string, message: string, noDialerMessage: string): string {
  return code === 'no_dialer' ? noDialerMessage : message;
}

export function HotlinesScreen(): JSX.Element {
  const engine = useEngine();
  const t = useT(hotlineStrings);
  useEngineChange(['packs']);
  const [callError, setCallError] = useState('');
  const hotlines = engine.plan.hotlines();

  const call = async (id: string): Promise<void> => {
    setCallError('');
    try {
      const result = await engine.plan.call(id);
      setCallError(result.ok ? '' : hotlineErrorMessage(result.error.code, result.error.message, t.noDialer));
    } catch {
      setCallError(t.actionFailed);
    }
  };

  return (
    <Screen title={t.title}>
      <SectionHeader title={t.hotlines} />
      {hotlines.length === 0 ? (
        <Card><EmptyState icon="call-outline" title={t.noHotlines} /></Card>
      ) : hotlines.map((hotline) => (
        <Card key={hotline.id}>
          <View style={styles.callRow}>
            <View style={styles.callText}>
              <Text style={styles.name}>{hotline.name}</Text>
              <Text style={styles.number}>{hotline.number}</Text>
              {hotline.hours ? <Text style={styles.muted}>{hotline.hours}</Text> : null}
            </View>
            <Button
              label={t.call}
              icon="call-outline"
              onPress={() => { void call(hotline.id); }}
              accessibilityLabel={`${t.call}: ${hotline.name}`}
            />
          </View>
        </Card>
      ))}
      {callError ? <InlineError message={callError} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  callRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  callText: { flex: 1, gap: space.xs },
  name: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  number: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: font.sm },
});
