import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TextKind } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { hotlineStrings } from '../strings/hotlines';
import { useT } from '../i18n';
import { Button, Chip, EmptyState, Field, HotlineRow, InlineError, Screen, SectionHeader, Tile, Txt } from '../components';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export function parseRecipients(raw: string): string[] {
  return raw.split(/[;,\n]+/).map((recipient) => recipient.trim()).filter((recipient) => recipient.length > 0);
}

export function hotlineErrorMessage(code: string, message: string, noDialerMessage: string): string {
  return code === 'no_dialer' ? noDialerMessage : message;
}

export function HotlinesScreen(): JSX.Element {
  const engine = useEngine();
  const t = useT(hotlineStrings);
  const styles = useThemedStyles(makeStyles);
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
        <Tile><EmptyState icon="call-outline" title={t.noHotlines} /></Tile>
      ) : hotlines.map((hotline) => (
        <Tile key={hotline.id}>
          <HotlineRow
            name={hotline.name}
            number={hotline.number}
            callLabel={t.call}
            onCall={() => { void call(hotline.id); }}
          />
          {hotline.hours ? <Txt role="bodySmall" tone="muted">{hotline.hours}</Txt> : null}
        </Tile>
      ))}
      {callError ? <InlineError message={callError} /> : null}

      <SectionHeader title={t.centers} />
      {centers.length === 0 ? (
        <Tile><EmptyState icon="home-outline" title={t.noCentersTitle} body={t.noCenters} /></Tile>
      ) : centers.map((center) => (
        <Tile key={center.id} title={center.name}>
          <Txt role="body">{t.landmark}: {center.landmark}</Txt>
          {center.capacity !== undefined ? <Txt role="bodySmall" tone="muted">{t.capacity}: {center.capacity}</Txt> : null}
          {center.accessible !== undefined ? <Txt role="bodySmall" tone="muted">{t.accessible}: {center.accessible ? t.yes : t.no}</Txt> : null}
          {center.accepts_pets !== undefined ? <Txt role="bodySmall" tone="muted">{t.pets}: {center.accepts_pets ? t.yes : t.no}</Txt> : null}
        </Tile>
      ))}

      <SectionHeader title={t.sms} />
      <Tile>
        <View style={styles.segment}>
          {(['safe', 'need_help'] as const).map((option) => (
            <Chip
              key={option}
              label={option === 'safe' ? t.safe : t.needHelp}
              selected={kind === option}
              onPress={() => setKind(option)}
            />
          ))}
        </View>
        <Field label={t.where} value={where} onChangeText={setWhere} placeholder={t.where} />
        <Txt role="label" tone="muted">{t.preview}</Txt>
        <View style={styles.preview}><Txt role="body">{preview}</Txt></View>
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
      </Tile>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  preview: {
    minHeight: t.minTouch,
    padding: t.space.md,
    borderRadius: t.radius.form,
    borderWidth: t.border.control,
    borderColor: t.colors.controlBorder,
    backgroundColor: t.colors.canvas,
  },
});
