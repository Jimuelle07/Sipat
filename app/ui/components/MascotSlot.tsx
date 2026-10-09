import type { JSX, ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import beforeArt from '../../../assets/character/before.png';
import duringArt from '../../../assets/character/during.png';
import afterArt from '../../../assets/character/after.png';
import { useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';

export const MASCOT_SLOT_TEST_ID = 'mascot-slot';

export interface MascotSlotProps {
  /** Optional art that replaces the phase mascot. */
  children?: ReactNode;
  accessibilityLabel?: string;
  /** Overrides the theme size (hero poster). */
  size?: number;
}

/**
 * Phase mascot sized by the theme, with an optional custom illustration.
 */
export function MascotSlot({ children, accessibilityLabel, size }: MascotSlotProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles((th: Theme) => makeStyles(th, size ?? th.mascot.size));
  const copy = useT(commonStrings);
  const source = t.phase === 'before' ? beforeArt : t.phase === 'during' ? duringArt : afterArt;
  const label = t.phase === 'before' ? copy.mascot_before : t.phase === 'during' ? copy.mascot_during : copy.mascot_after;

  return (
    <View
      testID={MASCOT_SLOT_TEST_ID}
      style={styles.slot}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {children ?? (
        <>
          {t.scheme === 'dark' && size === undefined ? <View style={styles.darkBackdrop} /> : null}
          <Image source={source} resizeMode="contain" resizeMethod="resize" style={styles.art} />
        </>
      )}
    </View>
  );
}

const makeStyles = (t: Theme, box: number) => StyleSheet.create({
  slot: {
    width: box,
    height: box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkBackdrop: {
    position: 'absolute',
    width: box,
    height: box,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  art: {
    width: box * 0.75,
    height: box,
  },
});
