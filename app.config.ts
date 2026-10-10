import type { ExpoConfig } from 'expo/config';
import withReleaseNoInternet from './plugins/withReleaseNoInternet.js';
import withSecureScreen from './plugins/withSecureScreen.js';

const config: ExpoConfig = {
  name: 'Bagyo Buddy',
  slug: 'bagyo-buddy',
  version: '0.1.0',
  platforms: ['android', 'web'],
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/agi-sipat-logo.png',
  web: { favicon: './assets/agi-sipat-logo.png' },
  updates: {
    enabled: false,
  },
  android: {
    // shortcut: the logo is not padded for the adaptive safe zone, so launchers may crop its edges; export a padded foreground if that matters.
    adaptiveIcon: { foregroundImage: './assets/agi-sipat-logo.png', backgroundColor: '#62788F' },
    package: 'ph.bagyobuddy.app',
    // Camera only for member photos, asked when the user taps "Kunan ng litrato". Coarse location only.
    permissions: ['android.permission.CAMERA'],
    // The system photo picker and the document picker (SAF) need no storage permission.
    // Location is coarse only: the one-shot reading never runs in the background (AGENTS rule 6).
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
  },
  plugins: [
    'expo-status-bar',
    'llama.rn',
    'expo-sharing',
    'react-native-quick-crypto',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Kailangan ng camera para makunan ng litrato ang bawat kasapi ng pamilya.',
        photosPermission: 'Pumili ng litrato ng kasapi ng pamilya mula sa gallery.',
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Gagamitin ang lokasyon ng telepono para mahanap ang pinakamalapit na evacuation center. Isang beses lang ito kukunin.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    withReleaseNoInternet,
    withSecureScreen,
  ],
};

export default config;
