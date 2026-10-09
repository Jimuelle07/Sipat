import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import { accountNext, emailValid } from './AccountScreen';
import { accountStrings } from '../strings/account';

describe('accountNext', () => {
  it('moves from sign in to sign up and forgot password', () => {
    expect(accountNext('signIn', 'goSignUp')).toBe('signUp');
    expect(accountNext('signIn', 'goForgot')).toBe('forgot');
  });

  it('returns to sign in from sign up and forgot password', () => {
    expect(accountNext('signUp', 'goSignIn')).toBe('signIn');
    expect(accountNext('forgot', 'goSignIn')).toBe('signIn');
  });

  it('never leaves a known mode', () => {
    for (const mode of ['signIn', 'signUp', 'forgot'] as const) {
      expect(['signIn', 'signUp', 'forgot']).toContain(accountNext(mode, 'goSignIn'));
      expect(['signIn', 'signUp', 'forgot']).toContain(accountNext(mode, 'goSignUp'));
      expect(['signIn', 'signUp', 'forgot']).toContain(accountNext(mode, 'goForgot'));
    }
  });
});

describe('emailValid', () => {
  it('accepts plain email addresses', () => {
    expect(emailValid('ana@example.com')).toBe(true);
  });

  it('rejects empty and malformed addresses', () => {
    expect(emailValid('')).toBe(false);
    expect(emailValid('ana')).toBe(false);
    expect(emailValid('ana@')).toBe(false);
    expect(emailValid('ana example.com')).toBe(false);
  });
});

describe('account strings', () => {
  it('labels the three static modes in both languages', () => {
    expect(accountStrings.tl.signInTitle).toBe('Mag-sign in');
    expect(accountStrings.tl.signUpTitle).toBe('Gumawa ng account');
    expect(accountStrings.tl.forgotTitle).toBe('Nakalimutan ang password');
    expect(accountStrings.en.signIn).toBe('Sign in');
  });

  it('states that nothing is sent in the demo', () => {
    expect(accountStrings.tl.demoNote).toBe('Demo muna: walang backend, walang naipapadala.');
    expect(accountStrings.en.demoNote).toBe('Demo only: no backend, nothing is sent.');
  });
});
