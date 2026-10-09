import { defineStrings } from '../i18n';

/** Copy used only by the Emergency card screen. Fixed safety copy comes from engine.copy(). */
export const emergencyStrings = defineStrings({
  tl: {
    back: 'Bumalik',
    stepsTitle: 'Mga hakbang',
    callTo: 'Tumawag sa {name}',
    call: 'Tumawag',
    sourceTitle: 'Pinagmulan',
  },
  en: {
    back: 'Back',
    stepsTitle: 'Steps',
    callTo: 'Call {name}',
    call: 'Call',
    sourceTitle: 'Source',
  },
});
