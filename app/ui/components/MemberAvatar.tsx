import type { JSX } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface MemberAvatarProps {
  photoUri?: string;
  initials: string;
  /** dp square diameter. */
  size: number;
  pending?: boolean;
  pendingLabel: string;
}

/**
 * Round household member photo with an initials fallback; while a photo is pending it
 * shows a dashed camera ring instead (member list, Profile and Photo screens).
 */
export function MemberAvatar({ photoUri, initials, size, pending = false, pendingLabel }: MemberAvatarProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const label = pending ? pendingLabel : initials;

  return (
    <View
      style={[styles.base, circle, pending ? styles.pending : styles.filled]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {pending ? (
        <Ionicons name="camera" size={size * 0.42} color={t.colors.textMuted} />
      ) : photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Txt
          role="label"
          color={t.colors.selected.ink}
          style={{ fontSize: size * 0.4, lineHeight: size * 0.46 }}
        >
          {initials}
        </Txt>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  filled: { backgroundColor: t.colors.selected.fill, borderWidth: t.border.hairline, borderColor: t.colors.hairline },
  pending: {
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.border.emphasis,
    borderStyle: 'dashed',
    borderColor: t.colors.controlBorder,
  },
})
