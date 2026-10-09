import { defineStrings } from '../i18n';

/** Every place the engine or a screen can surface an error code. */
export type ErrorSource =
  | 'init' | 'ai' | 'model_state' | 'verifier' | 'validation' | 'photo' | 'face_detection'
  | 'location' | 'undo' | 'checklist' | 'settings' | 'plan' | 'family' | 'profiles_remove'
  | 'share' | 'feed' | 'updates' | 'packs' | 'model_install' | 'account' | 'damage';

const FATAL = 'May problema sa app. Isara at buksan muli.';
const VERIFIER_NOTE = 'Hindi ipinakita ang sagot ng AI dahil hindi ito tugma sa gabay.';
const NUMBER_CHECK = 'Tingnan muli ang numero.';
const APP_TOO_OLD = 'I-update muna ang app.';
const NO_SPACE = 'Hindi na-save. Tingnan kung may espasyo pa ang phone.';
const RETRY = 'Hindi nagawa. Subukan muli.';
const SERVER = 'Hindi maabot ang server. Subukan muli mamaya.';
const OFFLINE = 'Walang internet.';
const PACKS_AUTH = 'Hindi galing sa Bagyo Buddy ang file na ito. Hindi ito ii-install.';
const PACKS_DAMAGED = 'Sira ang file. Humingi ng bagong kopya.';
const FEED_AUTH = 'Hindi ma-verify ang balita. Ipinapakita ang huling na-download.';

const VERIFIER_NOTE_EN = 'The AI answer was not shown because it did not match the guide.';
const NUMBER_CHECK_EN = 'Check the number again.';
const APP_TOO_OLD_EN = 'Update the app first.';
const NO_SPACE_EN = 'It was not saved. Check if the phone still has space.';
const RETRY_EN = 'It did not work. Try again.';
const SERVER_EN = 'The server cannot be reached. Try again later.';
const OFFLINE_EN = 'No internet.';
const PACKS_AUTH_EN = 'This file did not come from Bagyo Buddy. It will not be installed.';
const PACKS_DAMAGED_EN = 'The file is damaged. Ask for a new copy.';
const FEED_AUTH_EN = 'The news could not be verified. Showing the last download.';

/**
 * Contracts where the code is recorded but the UI shows nothing. Kept separate
 * from the table so `errorMessage` can return `null` for them.
 */
export const SILENT: ReadonlySet<string> = new Set([
  'model_state.absent',
  'model_state.unloaded',
  'model_state.ready',
  'face_detection.one_face',
  'undo.nothing_to_undo',
  'checklist.unknown_item',
  'share.cancelled',
  'feed.off',
  'feed.rollback',
  'updates.cancelled',
  'model_install.cancelled',
  'account.not_signed_in',
]);

export const errorStrings = defineStrings({
  tl: {
    generic: 'May hindi gumana. Subukan muli.',

    'init.content_invalid': FATAL,
    'init.storage_failed': FATAL,

    'ai.low_battery': 'Naka-off ang AI para makatipid sa baterya.',
    'ai.battery_saver': 'Naka-on ang battery saver, kaya buod lang ang ipinapakita.',
    'ai.ai_off': 'Naka-off ang AI sa Settings.',
    'ai.tier': 'Hindi kaya ng phone na ito ang AI. Buod mula sa gabay ang ipinapakita.',
    'ai.no_model': 'Wala pang AI model sa phone na ito.',

    'model_state.loading': 'Inihahanda ang AI…',
    'model_state.generating': 'Sumusulat ng sagot…',
    'model_state.error': 'Hindi gumana ang AI. Buod lang muna.',

    'verifier.schema': VERIFIER_NOTE,
    'verifier.not_in_guide': VERIFIER_NOTE,
    'verifier.bad_citation': VERIFIER_NOTE,
    'verifier.unknown_number': VERIFIER_NOTE,
    'verifier.phone_number': VERIFIER_NOTE,
    'verifier.too_long': VERIFIER_NOTE,
    'verifier.wrong_language': VERIFIER_NOTE,

    'validation.name_required': 'Lagyan ng pangalan.',
    'validation.too_long': 'Masyadong mahaba.',
    'validation.pets_range': 'Ilagay ang tamang bilang ng alaga.',
    'validation.phone_invalid': NUMBER_CHECK,
    'validation.too_many_members': 'Naabot na ang pinakamaraming miyembro.',
    'validation.owner_relation': 'Isa lang ang puwedeng maging pangunahing tao.',
    'validation.too_many_contacts': 'Naabot na ang pinakamaraming contact.',
    'validation.contact_phone_invalid': NUMBER_CHECK,

    'photo.permission_denied': "Walang pahintulot sa camera. Puwedeng pumili sa gallery, o pindutin ang 'Mamaya na'.",
    'photo.no_camera': "Walang camera ang phone na ito. Pumili sa gallery, o pindutin ang 'Mamaya na'.",
    'photo.unreadable': 'Hindi mabuksan ang litrato. Pumili ng iba.',
    'photo.draft_expired': 'Nag-expire na ang litrato. Kunan muli.',
    'photo.io': 'Hindi na-save ang litrato. Tingnan kung may espasyo pa ang phone.',

    'face_detection.no_face': 'Walang nakitang mukha. I-crop ang mukha nang mano-mano.',
    'face_detection.many_faces': 'Maraming mukha. I-crop ang tamang tao.',
    'face_detection.unavailable': 'I-crop ang mukha nang mano-mano.',
    'face_detection.confirm': 'Siya ba ito?',

    'location.permission_denied': 'Walang pahintulot sa lokasyon. Pumili na lang ng barangay sa listahan.',
    'location.services_off': 'Naka-off ang location ng phone. Buksan ito, o pumili ng barangay sa listahan.',
    'location.unavailable': 'Hindi makuha ang lokasyon ngayon. Pumili ng barangay sa listahan.',
    'location.unknown_place': 'Wala sa listahan ang lugar na ito. Pumili muli.',

    'settings.out_of_range': 'Wala sa pinapayagang saklaw.',

    'family.owner_required': 'Hindi puwedeng burahin ang pangunahing tao.',

    'plan.no_dialer': 'Hindi makatawag mula sa phone na ito.',

    'share.failed': RETRY,

    'feed.empty': 'Wala pang balita mula sa PAGASA na naka-save.',
    'feed.disabled': 'Naka-off ang balita sa Settings.',
    'feed.offline': 'Walang internet. Ipinapakita ang huling na-download.',
    'feed.http': SERVER,
    'feed.unknown_key': FEED_AUTH,
    'feed.bad_signature': FEED_AUTH,
    'feed.key_expired': FEED_AUTH,
    'feed.app_too_old': APP_TOO_OLD,

    'updates.offline': OFFLINE,
    'updates.http': SERVER,
    'updates.not_allowed': 'Wi-Fi lang ang nakatakda para sa update. Kumonekta sa Wi-Fi o baguhin ito sa Settings.',
    'updates.unknown_key': PACKS_AUTH,
    'updates.bad_signature': PACKS_AUTH,
    'updates.key_expired': PACKS_AUTH,
    'updates.app_too_old': APP_TOO_OLD,
    'updates.hash_mismatch': PACKS_DAMAGED,
    'updates.schema': PACKS_DAMAGED,
    'updates.failed': RETRY,

    'packs.bad_archive': 'Hindi mabasa ang file.',
    'packs.unknown_key': PACKS_AUTH,
    'packs.bad_signature': PACKS_AUTH,
    'packs.key_expired': PACKS_AUTH,
    'packs.app_too_old': APP_TOO_OLD,
    'packs.rollback': 'Mas luma ang file na ito kaysa sa nasa phone.',
    'packs.hash_mismatch': PACKS_DAMAGED,
    'packs.schema': PACKS_DAMAGED,
    'packs.io': NO_SPACE,
    'packs.nothing_to_roll_back': 'Walang naunang bersyon.',

    'model_install.tier': 'Hindi kaya ng phone na ito ang AI. Gagana pa rin ang app gamit ang buod mula sa gabay.',
    'model_install.no_space': 'Kulang ang espasyo sa phone para sa AI model.',
    'model_install.wrong_file': 'Hindi ito ang tamang AI model file.',
    'model_install.hash_mismatch': 'Hindi ito ang tamang AI model file.',
    'model_install.io': NO_SPACE,
    'model_install.failed': RETRY,

    'account.demo_only': 'Demo pa lang ito. Gumagana ang app kahit walang account.',
    'account.invalid_email': 'Tingnan muli ang email.',
    'account.weak_password': 'Masyadong mahina ang password.',
    'account.offline': OFFLINE,
    'account.http': SERVER,

    'damage.io': NO_SPACE,
    'damage.invalid': 'Kulang o mali ang laman ng ulat.',
    'damage.too_many_photos': 'Naabot na ang pinakamaraming litrato.',
    'damage.not_opted_in': 'Buksan muna ang pagpapadala ng ulat sa Settings.',
    'damage.offline': 'Walang internet. Naka-save ang ulat; ipadala ulit kapag may signal.',
    'damage.http': SERVER,
  },
  en: {
    generic: 'Something went wrong. Try again.',

    'init.content_invalid': 'Something is wrong with the app. Close it and open it again.',
    'init.storage_failed': 'Something is wrong with the app. Close it and open it again.',

    'ai.low_battery': 'AI is off to save battery.',
    'ai.battery_saver': 'Battery saver is on, so only the summary is shown.',
    'ai.ai_off': 'AI is off in Settings.',
    'ai.tier': 'This phone cannot run the AI. The summary from the guide is shown.',
    'ai.no_model': 'There is no AI model on this phone yet.',

    'model_state.loading': 'Preparing the AI…',
    'model_state.generating': 'Writing an answer…',
    'model_state.error': 'The AI did not work. Just the summary for now.',

    'verifier.schema': VERIFIER_NOTE_EN,
    'verifier.not_in_guide': VERIFIER_NOTE_EN,
    'verifier.bad_citation': VERIFIER_NOTE_EN,
    'verifier.unknown_number': VERIFIER_NOTE_EN,
    'verifier.phone_number': VERIFIER_NOTE_EN,
    'verifier.too_long': VERIFIER_NOTE_EN,
    'verifier.wrong_language': VERIFIER_NOTE_EN,

    'validation.name_required': 'Add a name.',
    'validation.too_long': 'It is too long.',
    'validation.pets_range': 'Enter a valid number of pets.',
    'validation.phone_invalid': NUMBER_CHECK_EN,
    'validation.too_many_members': 'The household has reached the member limit.',
    'validation.owner_relation': 'Only one person can be the main person.',
    'validation.too_many_contacts': 'You have reached the contact limit.',
    'validation.contact_phone_invalid': NUMBER_CHECK_EN,

    'photo.permission_denied': "No camera permission. You can choose from the gallery, or tap 'Later'.",
    'photo.no_camera': "This phone has no camera. Choose from the gallery, or tap 'Later'.",
    'photo.unreadable': 'The photo could not be opened. Choose another one.',
    'photo.draft_expired': 'The photo has expired. Take it again.',
    'photo.io': 'The photo was not saved. Check if the phone still has space.',

    'face_detection.no_face': 'No face was found. Crop the face by hand.',
    'face_detection.many_faces': 'There are many faces. Crop the right person.',
    'face_detection.unavailable': 'Crop the face by hand.',
    'face_detection.confirm': 'Is this the right person?',

    'location.permission_denied': 'No location permission. Just choose a barangay from the list.',
    'location.services_off': 'Location is off on this phone. Turn it on, or choose a barangay from the list.',
    'location.unavailable': 'The location cannot be read right now. Choose a barangay from the list.',
    'location.unknown_place': 'This place is not in the list. Choose again.',

    'settings.out_of_range': 'It is outside the allowed range.',

    'family.owner_required': 'The main person cannot be removed.',

    'plan.no_dialer': 'This phone cannot make a call.',

    'share.failed': RETRY_EN,

    'feed.empty': 'There is no saved PAGASA news yet.',
    'feed.disabled': 'News is off in Settings.',
    'feed.offline': 'No internet. Showing the last download.',
    'feed.http': SERVER_EN,
    'feed.unknown_key': FEED_AUTH_EN,
    'feed.bad_signature': FEED_AUTH_EN,
    'feed.key_expired': FEED_AUTH_EN,
    'feed.app_too_old': APP_TOO_OLD_EN,

    'updates.offline': OFFLINE_EN,
    'updates.http': SERVER_EN,
    'updates.not_allowed': 'Updates are set to Wi-Fi only. Connect to Wi-Fi or change this in Settings.',
    'updates.unknown_key': PACKS_AUTH_EN,
    'updates.bad_signature': PACKS_AUTH_EN,
    'updates.key_expired': PACKS_AUTH_EN,
    'updates.app_too_old': APP_TOO_OLD_EN,
    'updates.hash_mismatch': PACKS_DAMAGED_EN,
    'updates.schema': PACKS_DAMAGED_EN,
    'updates.failed': RETRY_EN,

    'packs.bad_archive': 'The file cannot be read.',
    'packs.unknown_key': PACKS_AUTH_EN,
    'packs.bad_signature': PACKS_AUTH_EN,
    'packs.key_expired': PACKS_AUTH_EN,
    'packs.app_too_old': APP_TOO_OLD_EN,
    'packs.rollback': 'This file is older than the one on the phone.',
    'packs.hash_mismatch': PACKS_DAMAGED_EN,
    'packs.schema': PACKS_DAMAGED_EN,
    'packs.io': NO_SPACE_EN,
    'packs.nothing_to_roll_back': 'There is no earlier version.',

    'model_install.tier': 'This phone cannot run the AI. The app still works with summaries from the guide.',
    'model_install.no_space': 'There is not enough space on the phone for the AI model.',
    'model_install.wrong_file': 'This is not the right AI model file.',
    'model_install.hash_mismatch': 'This is not the right AI model file.',
    'model_install.io': NO_SPACE_EN,
    'model_install.failed': RETRY_EN,

    'account.demo_only': 'This is demo only. The app works even without an account.',
    'account.invalid_email': 'Check the email again.',
    'account.weak_password': 'The password is too weak.',
    'account.offline': OFFLINE_EN,
    'account.http': SERVER_EN,

    'damage.io': NO_SPACE_EN,
    'damage.invalid': 'The report is incomplete or incorrect.',
    'damage.too_many_photos': 'You have reached the photo limit.',
    'damage.not_opted_in': 'Turn on report sending in Settings first.',
    'damage.offline': 'No internet. The report is saved; send it again when there is signal.',
    'damage.http': SERVER_EN,
  },
});

export function genericMessage(lang: 'tl' | 'en'): string {
  return errorStrings[lang].generic;
}

/**
 * Looks up the copy for an error code. Returns the message, `null` when the
 * contract says the UI shows nothing, or the generic message otherwise.
 */
export function errorMessage(lang: 'tl' | 'en', source: ErrorSource, code: string): string | null {
  const key = `${source}.${code}`;
  if (SILENT.has(key)) return null;
  const table: Record<string, string> = errorStrings[lang];
  return table[key] ?? genericMessage(lang);
}
