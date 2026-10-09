import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Tile } from './Tile';
import { Txt } from './Txt';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export interface BulletinLine {
  label: string;
  value: string;
}

/**
 * Verbatim PAGASA bulletin card shown in the Ask stream and on Home during the online stretch.
 * Every line is data rendered as-is; the caption is the caller's age text and, when the card
 * is stale, a danger row sits on top. Bulletin text never comes from the model.
 */
export function BulletinCard({ title, lines, ageText, staleText, sourceLabel, onSource }: {
  title: string;
  lines: BulletinLine[];
  ageText: string;
  staleText?: string;
  sourceLabel: string;
  onSource: () => void;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      {staleText !== undefined ? (
        <View style={[styles.staleRow, { backgroundColor: t.colors.dangerSurface.fill }]}>
          <Ionicons
            name="alert-circle"
            size={t.type.roles.bodySmall.fontSize}
            color={t.colors.dangerSurface.ink}
          />
          <Txt role="bodySmall" color={t.colors.dangerSurface.ink} style={styles.staleText}>
            {staleText}
          </Txt>
        </View>
      ) : null}
      <Tile title={title}>
        <View style={styles.lines}>
          {lines.map((line, index) => (
            <View key={`${index}-${line.label}`} style={styles.line}>
              <Txt role="bodySmall" tone="muted">{line.label}</Txt>
              <Txt role="body" tone="text" style={styles.lineValue}>{line.value}</Txt>
            </View>
          ))}
        </View>
        <Txt role="caption" tone="muted">{ageText}</Txt>
        <Button
          label={sourceLabel}
          icon="document-text-outline"
          variant="text"
          onPress={onSource}
        />
      </Tile>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.xs,
  },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    padding: t.space.md,
    borderRadius: t.radius.menu,
  },
  staleText: {
    flex: 1,
  },
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
})
