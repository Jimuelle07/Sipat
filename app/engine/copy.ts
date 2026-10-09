import type { CopyKey } from '../types';
import { CLOSING_TL } from '../core/verify';

/** The fixed Tagalog safety copy from docs/api-layer.md section 2, verbatim. */
export const COPY: Record<CopyKey, string> = {
  closing: CLOSING_TL,
  refusal: 'Wala ito sa gabay.',
  source_link: 'Saan galing ito?',
  no_live_data:
    'Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay.',
  stale_warning: 'Makinig muli sa radyo. Baka nagbago na ang signal.',
  medical_dose:
    'Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor.',
};

// English display translations; pending content review. The Tagalog COPY stays authoritative.
export const COPY_EN: Record<CopyKey, string> = {
  closing: 'Follow the orders of the barangay and the authorities.',
  refusal: 'This is not in the guide.',
  source_link: 'Where did this come from?',
  no_live_data:
    'The app has no live storm updates. Listen to PAGASA on the radio or ask your barangay.',
  stale_warning: 'Listen to the radio again. The signal may have changed.',
  medical_dose:
    'The app does not provide medicine doses. Ask at the Health Center or consult a doctor.',
};
