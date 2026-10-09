import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextKind } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { hotlineStrings } from '../strings/hotlines';
import { useT } from '../i18n';
import { Button, Card, EmptyState, Field, InlineError, Screen, SectionHeader } from '../components';
import { colors, font, minTouch, radius, space } from '../theme';

export function parseRecipients(raw: string): string[] {
  return raw.split(/[;,\n]+/).map((recipient) => recipient.trim()).filter((recipient) => recipient.length > 0);
}

export function hotlineErrorMessage(code: string, message: string, noDialerMessage: string): string {
  return code === 'no_dialer' ? noDialerMessage : message;
}

export function HotlinesScreen(): JSX.Element {
  const engine = useEngine();
  const t = useT(hotlineStrings);
  useEngineChange(['packs']);
  const [callError, setCallError] = useState('');
  const [composeError, setComposeError] = useState('');
  const [kind, setKind] = useState<TextKind>('safe');
  const [where, setWhere] = useState('');
  const [recipients, setRecipients] = useState('');
  const [busy, setBusy] = useState(false);
  const hotlines = engine.plan.hotlines();
  const centers = engine.plan.evacuationCenters();
  const preview = engine.plan.textPreview(kind, where.trim().length > 0 ? { where: where.trim() } : {});

  const call = async (id: string): Promise<void> => {
    setCallError('');
    try {
      const result = await engine.plan.call(id);
      setCallError(result.ok ? '' : hotlineErrorMessage(result.error.code, result.error.message, t.noDialer));
    } catch {
      setCallError(t.actionFailed);
    }
  };

  const compose = async (): Promise<void> => {
    setBusy(true);
    setComposeError('');
    try {
      const result = await engine.plan.composeText(kind, {
        to: parseRecipients(recipients),
        ...(where.trim().length > 0 ? { where: where.trim() } : {}),
      });
      setComposeError(result.ok ? '' : result.error.message);
    } catch {
      setComposeError(t.actionFailed);
    } finally {
      setBusy(false);
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

      <SectionHeader title={t.centers} />
      {centers.length === 0 ? (
        <Card><EmptyState icon="home-outline" title={t.noCentersTitle} body={t.noCenters} /></Card>
      ) : centers.map((center) => (
        <Card key={center.id} title={center.name}>
          <Text style={styles.text}>{t.landmark}: {center.landmark}</Text>
          {center.capacity !== undefined ? <Text style={styles.muted}>{t.capacity}: {center.capacity}</Text> : null}
          {center.accessible !== undefined ? <Text style={styles.muted}>{t.accessible}: {center.accessible ? t.yes : t.no}</Text> : null}
          {center.accepts_pets !== undefined ? <Text style={styles.muted}>{t.pets}: {center.accepts_pets ? t.yes : t.no}</Text> : null}
        </Card>
      ))}

      <SectionHeader title={t.sms} />
      <Card>
        <View accessibilityRole="radiogroup" style={styles.segment}>
          {(['safe', 'need_help'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === option }}
              onPress={() => setKind(option)}
              style={[styles.segmentButton, kind === option && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, kind === option && styles.segmentSelectedText]}>
                {option === 'safe' ? t.safe : t.needHelp}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label={t.where} value={where} onChangeText={setWhere} placeholder={t.where} />
        <Text style={styles.previewLabel}>{t.preview}</Text>
        <View style={styles.preview}><Text style={styles.text}>{preview}</Text></View>
        <Field
          label={t.recipients}
          value={recipients}
          onChangeText={setRecipients}
          placeholder={t.recipientsPlaceholder}
          keyboardType="phone-pad"
        />
        <Button
          label={busy ? t.openingSms : t.compose}
          icon="chatbubble-ellipses-outline"
          onPress={() => { void compose(); }}
          disabled={busy}
        />
        {composeError ? <InlineError message={composeError} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  callRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  callText: { flex: 1, gap: space.xs },
  name: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  number: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  text: { color: colors.text, fontSize: font.md },
  muted: { color: colors.muted, fontSize: font.sm },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  segmentButton: { minHeight: minTouch, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.sm, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.accent },
  segmentText: { color: colors.text, fontSize: font.sm, textAlign: 'center' },
  segmentSelectedText: { color: colors.accentText, fontWeight: '700' },
  previewLabel: { color: colors.muted, fontSize: font.sm, fontWeight: '700' },
  preview: { minHeight: minTouch, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
});
