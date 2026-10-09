import { defineStrings } from '../i18n';

/**
 * Copy for the Settings screen: language, AI, the low-battery policy, the AI model
 * install/remove flow, area, privacy and the links to the calm secondary screens.
 * Numbers shown on the screen are read from `settings.get()`; no value here carries a digit.
 */
export const settingsStrings = defineStrings({
  tl: {
    title: 'Mga setting',
    intro: 'Ayusin ang app para sa inyong tahanan.',
    back: 'Bumalik',

    languageSection: 'Wika',
    languageDescription: 'Piliin ang wikang gagamitin sa buong app.',

    aiSection: 'AI',
    aiEnabled: 'Payagan ang AI',
    aiEnabledOn: 'Naka-on',
    aiEnabledOff: 'Naka-off',
    aiDescription: 'Ang buod mula sa gabay ay laging ipinapakita.',

    statusSection: 'Katayuan',
    tierLabel: 'Uri ng telepono',
    tier_full: 'Ganap',
    tier_lite: 'Maliit',
    tier_none: 'Hindi kaya',
    aiLabel: 'AI',
    aiReady: 'Handa',
    batteryLabel: 'Baterya',
    batteryUnknown: 'Hindi pa nababasa ang baterya.',
    batteryCharging: 'Nagcha-charge',
    batterySaver: 'Tipid-baterya',

    lowBatterySection: 'Tipid-baterya',
    lowBatteryMode: 'Tipirin ang baterya',
    lowBatteryModeOn: 'Naka-on',
    lowBatteryModeOff: 'Naka-off',
    lowBatteryModeDescription: 'Buod lang ang ipinapakita kapag naka-on.',
    lowBatteryThreshold: 'Antas ng baterya',
    staleWarningHours: 'Oras bago maging luma ang babala',
    hoursSuffix: 'oras',
    percentSuffix: '%',

    modelSection: 'AI model',
    modelPresent: 'Naka-install',
    modelMissing: 'Wala pa',
    modelMissingHint: 'Piliin ang model file na nasa telepono para i-install.',
    modelRemove: 'Alisin',
    modelRemoveHint: 'Babalik sa buod mula sa gabay kapag walang AI.',
    modelInstall: 'I-install ang AI model',
    modelStop: 'Ihinto',
    modelInstalling: 'Kinokopya ang AI model…',
    modelInstalled: 'Naka-install na ang AI model.',

    areaSection: 'Lokasyon',

    privacySection: 'Pagkapribado',
    privacyNote: 'Nananatili sa telepono ang tahanan, mga litrato at lokasyon.',
    clearHistory: 'Burahin ang kasaysayan',
    clearHistoryConfirm: 'Burahin ang lahat ng kasaysayan ng tanong?',
    clearHistoryDone: 'Nabura na ang kasaysayan.',
    removeAllPhotos: 'Burahin ang lahat ng litrato',
    removeAllPhotosConfirm: 'Burahin ang lahat ng litrato ng miyembro?',
    removeAllPhotosDone: 'Nabura na ang lahat ng litrato.',
    confirm: 'Kumpirmahin',
    cancel: 'Kanselahin',

    moreSection: 'Iba pa',
    about: 'Tungkol',
    evaluation: 'Pagsusuri',
    account: 'Account',
  },
  en: {
    title: 'Settings',
    intro: 'Tune the app for your household.',
    back: 'Back',

    languageSection: 'Language',
    languageDescription: 'Choose the language used across the app.',

    aiSection: 'AI',
    aiEnabled: 'Allow the AI',
    aiEnabledOn: 'On',
    aiEnabledOff: 'Off',
    aiDescription: 'The summary from the guide is always shown.',

    statusSection: 'Status',
    tierLabel: 'Phone type',
    tier_full: 'Full',
    tier_lite: 'Lite',
    tier_none: 'Not supported',
    aiLabel: 'AI',
    aiReady: 'Ready',
    batteryLabel: 'Battery',
    batteryUnknown: 'The battery has not been read yet.',
    batteryCharging: 'Charging',
    batterySaver: 'Battery saver',

    lowBatterySection: 'Battery saver',
    lowBatteryMode: 'Save battery',
    lowBatteryModeOn: 'On',
    lowBatteryModeOff: 'Off',
    lowBatteryModeDescription: 'Only the summary is shown when this is on.',
    lowBatteryThreshold: 'Battery level',
    staleWarningHours: 'Hours before a warning goes stale',
    hoursSuffix: 'hours',
    percentSuffix: '%',

    modelSection: 'AI model',
    modelPresent: 'Installed',
    modelMissing: 'Not yet',
    modelMissingHint: 'Choose the model file that is on the phone to install it.',
    modelRemove: 'Remove',
    modelRemoveHint: 'The app falls back to guide summaries without the AI.',
    modelInstall: 'Install the AI model',
    modelStop: 'Stop',
    modelInstalling: 'Copying the AI model…',
    modelInstalled: 'The AI model is installed.',

    areaSection: 'Location',

    privacySection: 'Privacy',
    privacyNote: 'The household, photos and location stay on this phone.',
    clearHistory: 'Clear history',
    clearHistoryConfirm: 'Clear the whole question history?',
    clearHistoryDone: 'The history was cleared.',
    removeAllPhotos: 'Delete all photos',
    removeAllPhotosConfirm: 'Delete every member photo?',
    removeAllPhotosDone: 'All photos were deleted.',
    confirm: 'Confirm',
    cancel: 'Cancel',

    moreSection: 'More',
    about: 'About',
    evaluation: 'Evaluation',
    account: 'Account',
  },
});
