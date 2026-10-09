import type { JSX, ReactNode } from 'react';
import { Children, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export interface OptionGridProps {
  columns: number;
  children: ReactNode;
}

/**
 * Lays children out in fixed-width rows measured from the available width, so cells keep an even
 * gutter and a short last row never stretches. Nothing renders until the width is known (the first
 * onLayout pass). Used by Home's warning picker under WarningOption.
 */
export function OptionGrid({ columns, children }: OptionGridProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const gap = t.space.sm;
  const cellWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 0;
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  const onLayout = (event: LayoutChangeEvent): void => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.grid} onLayout={onLayout}>
      {width > 0
        ? rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((cell, cellIndex) => (
              <View key={`cell-${rowIndex}-${cellIndex}`} style={[styles.cell, { width: cellWidth }]}>
                {cell}
              </View>
            ))}
          </View>
        ))
        : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  grid: {
    gap: t.space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: t.space.sm,
  },
  cell: {
    alignSelf: 'stretch',
  },
});
