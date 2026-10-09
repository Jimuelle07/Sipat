import type { ExpoConfig } from 'expo/config';
import withReleaseNoInternet from './plugins/withReleaseNoInternet.js';

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
  },
  plugins: ['expo-status-bar', 'llama.rn', withReleaseNoInternet],
};

export default config;
