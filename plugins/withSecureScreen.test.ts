import { describe, expect, it } from 'vitest';
import withSecureScreen from './withSecureScreen.js';

const MAIN_ACTIVITY = `package ph.bagyobuddy.app;

import android.os.Bundle;
import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme);
    super.onCreate(null);
  }
}
`;

describe('withSecureScreen', () => {
  it('adds a debug-gated FLAG_SECURE to the main activity', async () => {
    const config = withSecureScreen({ name: 'test', slug: 'test' });
    const mainActivityMod = config.mods?.android?.mainActivity;

    expect(mainActivityMod).toBeTypeOf('function');
    if (!mainActivityMod) throw new Error('Expected the Android mainActivity mod');

    const result = await mainActivityMod({
      ...config,
      modResults: { language: 'java', contents: MAIN_ACTIVITY },
    } as never);

    const contents = result.modResults.contents as string;

    expect(contents).toContain('import ph.bagyobuddy.app.BuildConfig;');
    expect(contents).toContain('android.view.WindowManager.LayoutParams.FLAG_SECURE');
    expect(contents).toContain('if (!BuildConfig.DEBUG)');
  });

  it('does not duplicate the flag when the plugin runs twice', async () => {
    const config = withSecureScreen(withSecureScreen({ name: 'test', slug: 'test' }));
    const mainActivityMod = config.mods?.android?.mainActivity;
    if (!mainActivityMod) throw new Error('Expected the Android mainActivity mod');

    const result = await mainActivityMod({
      ...config,
      modResults: { language: 'java', contents: MAIN_ACTIVITY },
    } as never);

    const contents = result.modResults.contents as string;
    expect(contents.split('FLAG_SECURE').length - 1).toBe(1);
  });
});
