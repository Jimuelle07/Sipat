import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { accountStrings } from '../strings/account';
import { useT } from '../i18n';
import { AppBanners } from '../context/AppChrome';
import type { RootNavigation } from '../navigation/types';
import { Button, Field, InlineError, Screen, Tile, Txt } from '../components';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';

type AccountMode = 'signIn' | 'signUp' | 'forgot';

export function emailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validate(mode: AccountMode, email: string, password: string, confirm: string, t: Record<keyof typeof accountStrings.tl, string>): string | null {
  if (mode === 'forgot') return emailValid(email) ? null : t.emailInvalid;
  if (!emailValid(email)) return t.emailInvalid;
  if (password.length < 8) return t.passwordShort;
  if (mode === 'signUp' && password !== confirm) return t.passwordMismatch;
  return null;
}

/**
 * Static sign-up, login and forgot-password forms (D9). MVP only:
 * the forms render and validate lightly, store nothing and make no
 * request, so the app stays fully usable without logging in.
 */
export function AccountScreen(): JSX.Element {
  const t = useT(accountStrings);
  const nav = useNavigation<RootNavigation>();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<AccountMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = (): void => {
    const problem = validate(mode, email, password, confirm, t);
    if (problem) { setError(problem); setNotice(null); return; }
    setError(null);
    setNotice(t.demoNote);
    setPassword(''); setConfirm('');
  };

  const switchMode = (next: AccountMode): void => { setMode(next); setError(null); setNotice(null); };

  return (
    <Screen
      title={t.title}
      back={{ label: t.back, onPress: () => nav.goBack() }}
      banner={<AppBanners />}
    >
      <Tile title={mode === 'signIn' ? t.signInTitle : mode === 'signUp' ? t.signUpTitle : t.forgotTitle}>
        <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        {mode !== 'forgot' ? (
          <Field label={t.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signUp' ? 'new-password' : 'password'} />
        ) : null}
        {mode === 'signUp' ? (
          <Field label={t.confirmPassword} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        ) : null}
        {error ? <InlineError message={error} /> : null}
        {notice ? <Txt role="bodySmall" tone="accent" accessibilityRole="alert">{notice}</Txt> : null}
        <Button label={mode === 'signIn' ? t.signIn : mode === 'signUp' ? t.signUp : t.sendReset} onPress={submit} icon={mode === 'forgot' ? 'mail-outline' : 'log-in-outline'} />
        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <Pressable accessibilityRole="link" accessibilityLabel={t.noAccount} onPress={() => switchMode('signUp')} style={styles.linkButton}>
                <Txt role="body" tone="brand">{t.noAccount}</Txt>
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel={t.forgotLink} onPress={() => switchMode('forgot')} style={styles.linkButton}>
                <Txt role="body" tone="brand">{t.forgotLink}</Txt>
              </Pressable>
            </>
          ) : null}
          {mode === 'signUp' ? (
            <Pressable accessibilityRole="link" accessibilityLabel={t.haveAccount} onPress={() => switchMode('signIn')} style={styles.linkButton}>
              <Txt role="body" tone="brand">{t.haveAccount}</Txt>
            </Pressable>
          ) : null}
          {mode === 'forgot' ? (
            <Pressable accessibilityRole="link" accessibilityLabel={t.backToSignIn} onPress={() => switchMode('signIn')} style={styles.linkButton}>
              <Txt role="body" tone="brand">{t.backToSignIn}</Txt>
            </Pressable>
          ) : null}
        </View>
      </Tile>
      <Tile><Txt role="bodySmall" tone="muted">{t.offlineNote}</Txt></Tile>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  links: { gap: t.space.xs, marginTop: t.space.sm },
  linkButton: { minHeight: t.minTouch, justifyContent: 'center' },
});
