import type { TopicGroup } from '../../engine';
import { defineStrings } from '../i18n';

/** Copy used only by the Hotlines screen. Fixed safety copy comes from engine.copy(). */
export const hotlineStrings = defineStrings({
  tl: {
    title: 'Hotline',
    hotlines: 'Mga hotline',
    noHotlines: 'Walang nakatalang hotline.',
    call: 'Tumawag',
    noDialer: 'Hindi mabuksan ang dialer sa phone na ito.',
    actionFailed: 'Hindi natuloy ang aksyon. Subukan muli.',
  },
  en: {
    title: 'Hotlines',
    hotlines: 'Hotlines',
    noHotlines: 'No hotline is listed.',
    call: 'Call',
    noDialer: 'The dialer cannot open on this phone.',
    actionFailed: 'The action did not go through. Try again.',
  },
});

const TOPIC_LABELS: Record<TopicGroup, string> = {
  signals: 'Mga signal',
  go_bag: 'Go bag',
  home_prep: 'Paghahanda sa bahay',
  evacuation: 'Paglikas',
  flood: 'Baha',
  surge: 'Storm surge',
  landslide: 'Pagguho ng lupa',
  infant: 'Sanggol',
  senior: 'Nakatatanda',
  pregnancy: 'Pagbubuntis',
  disability: 'May kapansanan',
  pets: 'Alagang hayop',
  water_food: 'Tubig at pagkain',
  electrical: 'Kuryente',
  generator_fire: 'Generator at sunog',
  gas_safety: 'LPG at gas',
  cleanup: 'Paglilinis',
  health_after_flood: 'Kalusugan pagkatapos ng baha',
  first_aid: 'Pangunang lunas',
  psychosocial: 'Kalusugang pangkaisipan',
  damage_report: 'Pag-uulat ng pinsala',
  assistance: 'Tulong at ayuda',
  out_of_guide: 'Wala sa gabay',
};

export function topicLabel(topic: TopicGroup): string {
  return TOPIC_LABELS[topic];
}
