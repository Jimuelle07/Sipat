import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { accountStrings } from '../strings/account';
import { useT } from '../i18n';
import { Button, Card, Field, Screen } from '../components';
import { colors, font, minTouch, space } from '../theme';

export type AccountMode = 'signIn' | 'signUp' | 'forgot';

/** Pure mode transitions, exported for tests. */
export function accountNext(mode: AccountMode, action: 'goSignUp' | 'goForgot' | 'goSignIn'): AccountMode {
  if (action === 'goSignIn') return 'signIn';
  if (mode === 'signIn') return action === 'goSignUp' ? 'signUp' : 'forgot';
  return 'signIn';
}

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
  const [mode, setMode] = useState<AccountMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () => {
    const problem = validate(mode, email, password, confirm, t);
    if (problem) { setError(problem); setNotice(null); return; }
    setError(null);
    setNotice(mode === 'forgot' ? t.resetSent : t.demoNote);
    setPassword(''); setConfirm('');
  };

  const switchMode = (next: AccountMode) => { setMode(next); setError(null); setNotice(null); };

  return (
    <Screen title={t.title}>
      <Card title={mode === 'signIn' ? t.signInTitle : mode === 'signUp' ? t.signUpTitle : t.forgotTitle}>
        <Field label={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        {mode !== 'forgot' ? (
          <Field label={t.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signUp' ? 'new-password' : 'password'} />
        ) : null}
        {mode === 'signUp' ? (
          <Field label={t.confirmPassword} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
        <Button label={mode === 'signIn' ? t.signIn : mode === 'signUp' ? t.signUp : t.sendReset} onPress={submit} icon={mode === 'forgot' ? 'mail-outline' : 'log-in-outline'} />
        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <Pressable accessibilityRole="link" onPress={() => switchMode('signUp')} style={styles.linkButton}><Text style={styles.link}>{t.noAccount}</Text></Pressable>
              <Pressable accessibilityRole="link" onPress={() => switchMode('forgot')} style={styles.linkButton}><Text style={styles.link}>{t.forgotLink}</Text></Pressable>
            </>
          ) : null}
          {mode === 'signUp' ? (
            <Pressable accessibilityRole="link" onPress={() => switchMode('signIn')} style={styles.linkButton}><Text style={styles.link}>{t.haveAccount}</Text></Pressable>
          ) : null}
          {mode === 'forgot' ? (
            <Pressable accessibilityRole="link" onPress={() => switchMode('signIn')} style={styles.linkButton}><Text style={styles.link}>{t.backToSignIn}</Text></Pressable>
          ) : null}
        </View>
      </Card>
      <Card><Text style={styles.muted}>{t.offlineNote}</Text></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: font.sm },
  notice: { color: colors.accent, fontSize: font.sm },
  muted: { color: colors.muted, fontSize: font.sm },
  links: { gap: space.xs, marginTop: space.sm },
  linkButton: { minHeight: minTouch, justifyContent: 'center' },
  link: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
});
