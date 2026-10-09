import type { JSX } from 'react';
import { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Labelled single-line text input on a sunken well, with a focus ring and an alert error row.
 * Used on the household/profile forms (Account, Profile, Photo note fields).
 */
export function Field({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: FieldProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Txt role="label">{label}</Txt>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        maxFontSizeMultiplier={t.type.maxFontSizeMultiplier}
        placeholderTextColor={t.colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.focused, error !== undefined && styles.inputError, style]}
      />
      {error !== undefined ? (
        <View style={styles.errorRow} accessibilityRole="alert">
          <Ionicons
            name="alert-circle"
            size={t.type.roles.bodySmall.fontSize}
            color={t.colors.dangerSurface.ink}
          />
          <Txt role="bodySmall" color={t.colors.dangerSurface.ink} style={styles.errorText}>{error}</Txt>
        </View>
      ) : hint !== undefined ? (
        <Txt role="bodySmall" tone="muted">{hint}</Txt>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: {
    gap: t.space.xs,
  },
  input: {
    minHeight: t.minTouch,
    backgroundColor: t.colors.surfaceSunken,
    borderColor: t.colors.controlBorder,
    borderWidth: t.border.control,
    borderRadius: t.radius.form,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.sm,
    color: t.colors.text,
    fontSize: t.type.roles.body.fontSize,
    lineHeight: t.type.roles.body.lineHeight,
    letterSpacing: t.type.roles.body.letterSpacing,
    fontWeight: t.type.roles.body.fontWeight,
  },
  focused: {
    borderColor: t.colors.focus,
  },
  inputError: {
    borderColor: t.colors.danger.fill,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
  },
  errorText: {
    flexShrink: 1,
  },
})
