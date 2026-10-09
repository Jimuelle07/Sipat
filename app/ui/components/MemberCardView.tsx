import type { JSX, ReactNode } from 'react';
import { forwardRef, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';
import { Tag } from './Tag';

export interface MemberCardLine {
  label: string;
  value: string;
}

export interface MemberCardViewProps {
  heading: string;
  name: string;
  photoUri?: string;
  note?: string;
  lines: MemberCardLine[];
  footer?: ReactNode;
  /** Called when the photo cannot be decoded (fixture URIs, missing files). */
  onError?: () => void;
}

/**
 * The "Hinahanap" full-screen member card, captured as an image when a family shares it
 * (share card screen). High contrast in every theme; the ref points at the captured root View.
 * A photo that cannot load falls back to the avatar glyph.
 */
export const MemberCardView = forwardRef<View, MemberCardViewProps>(function MemberCardView(
  { heading, name, photoUri, note, lines, footer, onError },
  ref,
): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUri]);
  const showPhoto = photoUri !== undefined && photoUri.length > 0 && !failed;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={styles.header}>
        <Tag label={heading} tone={t.colors.danger} />
      </View>
      <View style={styles.photoFrame}>
        {showPhoto ? (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" onError={() => { setFailed(true); onError?.(); }} />
        ) : (
          <Ionicons name="person" size={t.minTouch} color={t.colors.textMuted} />
        )}
      </View>
      <Txt role="display" tone="text" align="center" adjustsFontSizeToFit numberOfLines={2}>{name}</Txt>
      {note ? <Txt role="body" tone="muted" align="center">{note}</Txt> : null}
      <View style={styles.lines}>
        {lines.map((line, index) => (
          <View key={index} style={styles.line}>
            <Txt role="bodySmall" tone="muted">{line.label}</Txt>
            <Txt role="lead" tone="text" style={styles.lineValue} numberOfLines={2}>{line.value}</Txt>
          </View>
        ))}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
});

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.panel,
    borderWidth: t.border.hairline,
    borderColor: t.colors.hairline,
    padding: t.space.tile,
    gap: t.space.lg,
  },
  header: { alignItems: 'center' },
  photoFrame: {
    width: '60%',
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: t.radius.media,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  lines: { gap: t.space.sm },
  line: {
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  lineValue: { flexShrink: 1 },
  footer: { alignItems: 'center' },
})
