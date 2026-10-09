import { defineStrings } from '../i18n';

/**
 * Labels for every warning a household can pick, plus the small chips the
 * warnings card shows. Sourced from content/warnings.json ids.
 */
export const warningLabels = defineStrings({
  tl: {
    'tcws-1': 'Signal No. {level}',
    'tcws-2': 'Signal No. {level}',
    'tcws-3': 'Signal No. {level}',
    'tcws-4': 'Signal No. {level}',
    'tcws-5': 'Signal No. {level}',
    'rainfall-yellow': 'Rainfall: Dilaw',
    'rainfall-orange': 'Rainfall: Kahel',
    'rainfall-red': 'Rainfall: Pula',
    'surge-yellow': 'Storm surge: Dilaw',
    'surge-orange': 'Storm surge: Kahel',
    'surge-red': 'Storm surge: Pula',
    gale: 'Gale warning',
    'barangay-order': 'Utos ng barangay na lumikas',
    level_yellow: 'Dilaw',
    level_orange: 'Kahel',
    level_red: 'Pula',
    ageHours: '{hours} oras na',
    stalePrompt: 'Ganito pa rin ba?',
    reconfirm: 'Pareho pa rin',
    clear: 'Alisin',
    pickerTitle: 'Ano ang narinig mo?',
  },
  en: {
    'tcws-1': 'Signal No. {level}',
    'tcws-2': 'Signal No. {level}',
    'tcws-3': 'Signal No. {level}',
    'tcws-4': 'Signal No. {level}',
    'tcws-5': 'Signal No. {level}',
    'rainfall-yellow': 'Rainfall: Yellow',
    'rainfall-orange': 'Rainfall: Orange',
    'rainfall-red': 'Rainfall: Red',
    'surge-yellow': 'Storm surge: Yellow',
    'surge-orange': 'Storm surge: Orange',
    'surge-red': 'Storm surge: Red',
    gale: 'Gale warning',
    'barangay-order': 'Barangay evacuation order',
    level_yellow: 'Yellow',
    level_orange: 'Orange',
    level_red: 'Red',
    ageHours: '{hours} h ago',
    stalePrompt: 'Still the same?',
    reconfirm: 'Still the same',
    clear: 'Clear',
    pickerTitle: 'What did you hear?',
  },
});

/** Color-level names used when a warning only needs the color word. */
export const levelNames = defineStrings({
  tl: { yellow: 'Dilaw', orange: 'Kahel', red: 'Pula' },
  en: { yellow: 'Yellow', orange: 'Orange', red: 'Red' },
});
