import type { CopyKey, UiLanguage } from '../types/common.ts';

export const COPY: Record<CopyKey, string> = {
  closing: 'Sundin ang utos ng barangay at ng mga awtoridad.',
  refusal: 'Wala ito sa gabay.',
  source_link: 'Saan galing ito?',
  no_live_data: 'Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay.',
  stale_warning: 'Makinig muli sa radyo. Baka nagbago na ang signal.',
  medical_dose: 'Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor.',
  phase_before: 'Bago ang bagyo',
  phase_during: 'Habang may bagyo',
  phase_after: 'Pagkatapos ng bagyo',
  phase_switched: 'Lumipat sa {phase}.',
  bulletin_age: 'Inilabas ng PAGASA: {issuedAt}. Na-download: {fetchedAt}. Makinig pa rin sa radyo.',
  barangay_decides: 'Ang barangay ang magsasabi kung kailan lilikas.',
  photo_consent: 'Siguraduhing pumayag ang tao bago kunan ng litrato.',
  photo_required: 'Kailangan ang litrato ng mukha para makilala kung sakaling mawalay. Puwedeng mamaya na.',
  photo_pending: 'Kulang pa ang litrato ni {name}.',
  location_button: 'Gamitin ang lokasyon ng telepono',
  aid_notice: 'Gabay sa paghahanda ang Sipat. Hindi ito serbisyong pang-emergency at hindi ito forecast.',
};

export const COPY_EN: Record<CopyKey, string> = {
  closing: 'Follow the orders of the barangay and the authorities.',
  refusal: 'This is not in the guide.',
  source_link: 'Where did this come from?',
  no_live_data: 'The app has no live storm updates. Listen to PAGASA on the radio or ask your barangay.',
  stale_warning: 'Listen to the radio again. The signal may have changed.',
  medical_dose: 'The app does not provide medicine doses. Ask at the Health Center or consult a doctor.',
  phase_before: 'Before the storm',
  phase_during: 'During the storm',
  phase_after: 'After the storm',
  phase_switched: 'Switched to {phase}.',
  bulletin_age: 'Issued by PAGASA: {issuedAt}. Downloaded: {fetchedAt}. Keep listening to the radio.',
  barangay_decides: 'The barangay will say when to evacuate.',
  photo_consent: 'Make sure the person agrees before taking their photo.',
  photo_required: 'A face photo is needed in case you get separated. You can add it later.',
  photo_pending: '{name} still needs a photo.',
  location_button: 'Use phone location',
  aid_notice: 'Sipat is a preparedness guide. It is not an emergency service or a forecast.',
};

export function copyText(
  key: CopyKey,
  opts: { lang?: UiLanguage; vars?: Record<string, string> } = {},
): string {
  const text = (opts.lang === 'en' ? COPY_EN : COPY)[key];
  return text.replace(/\{([^{}]+)\}/g, (slot, name: string) => opts.vars?.[name] ?? slot);
}
