import type { JSX, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export const MASCOT_SLOT_TEST_ID = 'mascot-slot';

export interface MascotSlotProps {
  /** Future mascot art; while absent the slot stays invisible. */
  children?: ReactNode;
  accessibilityLabel?: string;
}

/**
 * Reserved square of `theme.mascot.size` for the Bagyo Buddy mascot. Empty until the art
 * exists: it renders a transparent, non-announced placeholder so layout is stable now and the
 * art drops in later. Used in the Home hero and header per the active phase.
 */
export function MascotSlot({ children, accessibilityLabel }: MascotSlotProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const filled = children !== undefined && children !== null;

  return (
    <View
      testID={MASCOT_SLOT_TEST_ID}
      style={styles.slot}
      accessible={filled}
      accessibilityRole={filled ? 'image' : undefined}
      accessibilityLabel={filled ? accessibilityLabel : undefined}
      accessibilityElementsHidden={!filled}
      importantForAccessibility={filled ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  slot: {
    width: t.mascot.size,
    height: t.mascot.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
