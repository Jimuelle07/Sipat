import { defineStrings } from '../i18n';

/**
 * Copy for the Account screen. In the MVP the sign-up, login and
 * forgot-password forms are static: they render, validate lightly and
 * show a demo notice, and nothing leaves the phone (no backend).
 */
export const accountStrings = defineStrings({
  tl: {
    title: 'Account',
    signInTitle: 'Mag-sign in',
    signUpTitle: 'Gumawa ng account',
    forgotTitle: 'Nakalimutan ang password',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Ulitin ang password',
    signIn: 'Mag-sign in',
    signUp: 'Gumawa ng account',
    sendReset: 'Ipadala ang link',
    noAccount: 'Wala pang account? Gumawa.',
    haveAccount: 'May account na? Mag-sign in.',
    forgotLink: 'Nakalimutan ang password?',
    backToSignIn: 'Bumalik sa sign in',
    demoNote: 'Demo muna: walang backend, walang naipapadala.',
    offlineNote: 'Ang tahanan ay nananatili sa telepono kahit walang account.',
    emailInvalid: 'Hindi wastong email.',
    passwordShort: 'Kailangan ng hindi bababa sa 8 karakter.',
    passwordMismatch: 'Hindi magkatugma ang mga password.',
    resetSent: 'Kung may account ang email na ito, may matatanggap na link.',
  },
  en: {
    title: 'Account',
    signInTitle: 'Sign in',
    signUpTitle: 'Create an account',
    forgotTitle: 'Forgot password',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Repeat password',
    signIn: 'Sign in',
    signUp: 'Create account',
    sendReset: 'Send link',
    noAccount: 'No account yet? Create one.',
    haveAccount: 'Have an account? Sign in.',
    forgotLink: 'Forgot password?',
    backToSignIn: 'Back to sign in',
    demoNote: 'Demo only: no backend, nothing is sent.',
    offlineNote: 'The household stays on this phone even without an account.',
    emailInvalid: 'Invalid email.',
    passwordShort: 'At least 8 characters.',
    passwordMismatch: 'Passwords do not match.',
    resetSent: 'If this email has an account, a link will be sent.',
  },
});
