import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export interface PlanLine {
  label: string;
  value: string;
}

export interface PlanCall {
  id: string;
  label: string;
}

/**
 * Family-plan answer card in the Ask stream (Ask screen). Lists the plan lines, or an empty
 * state with a "fill this in" action, and exposes call buttons for the plan's contacts.
 */
export function PlanAnswerCard({ title, lines, calls, onCall, empty = false, emptyText, fillLabel, onFill }: {
  title: string;
  lines: PlanLine[];
  calls?: PlanCall[];
  onCall: (id: string) => void;
  empty?: boolean;
  emptyText?: string;
  fillLabel?: string;
  onFill?: () => void;
}): JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <Tile title={title}>
      {empty ? (
        <View style={styles.empty}>
          {emptyText !== undefined ? <Txt role="body" tone="muted">{emptyText}</Txt> : null}
          {fillLabel !== undefined && onFill !== undefined ? (
            <Button label={fillLabel} icon="add" variant="outline" onPress={onFill} />
          ) : null}
        </View>
      ) : (
        <View style={styles.lines}>
          {lines.map((line, index) => (
            <View key={`${index}-${line.label}`} style={styles.line}>
              <Txt role="bodySmall" tone="muted">{line.label}</Txt>
              <Txt role="body" tone="text" style={styles.lineValue}>{line.value}</Txt>
            </View>
          ))}
        </View>
      )}
      {calls !== undefined && calls.length > 0 ? (
        <View style={styles.calls}>
          {calls.map((call) => (
            <Button
              key={call.id}
              label={call.label}
              icon="call"
              variant="tonal"
              onPress={() => onCall(call.id)}
            />
          ))}
        </View>
      ) : null}
    </Tile>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  lines: {
    gap: t.space.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: t.space.lg,
    paddingVertical: t.space.xs,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  lineValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  calls: {
    gap: t.space.md,
  },
  empty: {
    alignItems: 'flex-start',
    gap: t.space.md,
  },
})
