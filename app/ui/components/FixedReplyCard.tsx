import type { JSX } from 'react';
import { Tile } from './Tile';
import { Txt } from './Txt';

/**
 * Fixed, pre-vetted reply card in the Ask stream (Ask screen) for the live-data and
 * medical-dose routes. The text is final and rendered exactly as passed.
 */
export function FixedReplyCard({ text }: { text: string }): JSX.Element {
  return (
    <Tile>
      <Txt role="body" tone="text">{text}</Txt>
    </Tile>
  );
}
