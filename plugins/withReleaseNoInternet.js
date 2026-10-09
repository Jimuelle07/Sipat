import { withDangerousMod } from '@expo/config-plugins';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <uses-permission
        android:name="android.permission.INTERNET"
        tools:node="remove" />
</manifest>
`;

export default function withReleaseNoInternet(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const androidProjectRoot = modConfig.modRequest.platformProjectRoot;
      const releaseManifestPath = join(
        androidProjectRoot,
        'app',
        'src',
        'release',
        'AndroidManifest.xml',
      );

      mkdirSync(join(androidProjectRoot, 'app', 'src', 'release'), { recursive: true });
      writeFileSync(releaseManifestPath, RELEASE_MANIFEST, 'utf8');

      return modConfig;
    },
  ]);
}
