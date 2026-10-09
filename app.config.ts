import type { ExpoConfig } from 'expo/config';
import withReleaseNoInternet from './plugins/withReleaseNoInternet.js';
import withSecureScreen from './plugins/withSecureScreen.js';

const config: ExpoConfig = {
  name: 'Bagyo Buddy',
  slug: 'bagyo-buddy',
  version: '0.1.0',
  platforms: ['android', 'web'],
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  updates: {
    enabled: false,
  },
  android: {
    package: 'ph.bagyobuddy.app',
    // Camera only for member photos, asked when the user taps "Kunan ng litrato". No location in the MVP core.
    permissions: ['android.permission.CAMERA'],
    // The system photo picker and the document picker (SAF) need no storage permission.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
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
    withReleaseNoInternet,
    withSecureScreen,
  ],
};

export default config;
