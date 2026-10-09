import type { JSX } from 'react';
import { useState } from 'react';
import { useEngine, useEngineChange } from '../context/useEngine';
import { hotlineStrings } from '../strings/hotlines';
import { useT } from '../i18n';
import { EmptyState, HotlineRow, InlineError, Screen, SectionHeader, Tile, Txt } from '../components';

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
    </Screen>
  );
}
