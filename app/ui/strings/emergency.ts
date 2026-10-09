import { defineStrings } from '../i18n';

/** Copy used only by the Emergency card screen. Fixed safety copy comes from engine.copy(). */
export const emergencyStrings = defineStrings({
  tl: {
    back: 'Bumalik',
    callTo: 'Tumawag sa {name}',
    sourceTitle: 'Pinagmulan',
  },
  en: {
    back: 'Back',
    callTo: 'Call {name}',
    sourceTitle: 'Source',
  },
});
