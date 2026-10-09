import { withMainActivity } from '@expo/config-plugins';

/**
 * Adds Android FLAG_SECURE to the main activity in release builds only.
 * Like streaming apps (e.g. Netflix), screenshots, screen recording and the
 * recents preview are blacked out, so member photos cannot be captured.
 * Debug builds stay open so the mirrored hackathon demo keeps working.
 */
export default function withSecureScreen(config) {
  return withMainActivity(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const packageMatch = contents.match(/package\s+([\w.]+);/);
    const packageName = packageMatch ? packageMatch[1] : 'app';

    if (!contents.includes('BuildConfig')) {
      contents = contents.replace(
        /(package\s+[\w.]+;)/,
        `$1\n\nimport ${packageName}.BuildConfig;`,
      );
    }

    if (!contents.includes('FLAG_SECURE')) {
      contents = contents.replace(
        /(super\.onCreate\([^)]*\);)/,
        `$1\n    if (!BuildConfig.DEBUG) {\n      getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);\n    }`,
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}
