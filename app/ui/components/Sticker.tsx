import type { JSX } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type StickerKind = 'coin' | 'check' | 'burst' | 'ring' | 'pill';

export interface StickerProps {
  kind: StickerKind;
  color: string;
  size?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Decorative cut-out in the design-v2 sticker language: flat fill, carbon outline, slight tilt.
 * Purely ornamental, hidden from screen readers.
 */
export function Sticker({ kind, color, size = 56, rotate = 0, style }: StickerProps): JSX.Element {
  const t = useTheme();
  const carbon = t.colors.ink;
  const frame: ViewStyle = {
    width: kind === 'pill' ? size * 1.9 : size,
    height: size,
    transform: [{ rotate: `${rotate}deg` }],
  };

  if (kind === 'ring') {
    return (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[frame, styles.ring, { borderColor: color, borderRadius: size / 2, borderWidth: size * 0.26 }, style]}
      />
    );
  }

  const radius = kind === 'coin' ? size / 2 : kind === 'burst' ? size * 0.3 : size / 2;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[frame, styles.base, { backgroundColor: color, borderColor: carbon, borderRadius: radius, borderWidth: t.border.control, boxShadow: t.shadow.sticker }, style]}
    >
      {kind === 'check' ? <Ionicons name="checkmark" size={size * 0.6} color={carbon} /> : null}
      {kind === 'coin' ? <View style={[styles.coinInner, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, borderColor: carbon }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  ring: { position: 'absolute' },
  coinInner: { borderWidth: 2 },
});
