import type { JSX } from 'react';
import { useEffect, useState } from 'react';
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
  /** Screen-reader name for the avatar; falls back to the initials when omitted. */
  label?: string;
  /** Called when the photo cannot be decoded (fixture URIs, missing files). */
  onError?: () => void;
}

/**
 * Round household member photo with an initials fallback; while a photo is pending it
 * shows a dashed camera ring instead (member list, Profile and Photo screens). A photo
 * that cannot load falls back to the initials on a sunken circle.
 */
export function MemberAvatar({ photoUri, initials, size, pending = false, pendingLabel, label, onError }: MemberAvatarProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUri]);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const showPhoto = !pending && photoUri !== undefined && photoUri.length > 0 && !failed;
  const a11yLabel = pending ? pendingLabel : label !== undefined && label.length > 0 ? label : initials;

  return (
    <View
      style={[styles.base, circle, pending ? styles.pending : showPhoto ? styles.filled : styles.sunken]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
    >
      {pending ? (
        <Ionicons name="camera" size={size * 0.42} color={t.colors.textMuted} />
      ) : showPhoto ? (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => { setFailed(true); onError?.(); }}
        />
      ) : (
        <Txt
          role="label"
          color={t.colors.textMuted}
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
  sunken: { backgroundColor: t.colors.surfaceSunken, borderWidth: t.border.hairline, borderColor: t.colors.hairline },
  pending: {
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.border.emphasis,
    borderStyle: 'dashed',
    borderColor: t.colors.controlBorder,
  },
})
