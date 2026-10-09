import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import withReleaseNoInternet, { RELEASE_MANIFEST } from './withReleaseNoInternet.js';

describe('withReleaseNoInternet', () => {
  it('writes a release-only manifest overlay that removes INTERNET', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bagyo-release-manifest-'));

    try {
      const config = withReleaseNoInternet({ name: 'test', slug: 'test' });
      const dangerousMod = config.mods?.android?.dangerous;

      expect(dangerousMod).toBeTypeOf('function');
      if (!dangerousMod) throw new Error('Expected the Android dangerous mod');

      await dangerousMod({
        ...config,
        modRequest: { platformProjectRoot: root },
      } as never);

      const overlayPath = join(root, 'app', 'src', 'release', 'AndroidManifest.xml');
      const overlay = readFileSync(overlayPath, 'utf8');

      expect(overlay).toBe(RELEASE_MANIFEST);
      expect(overlay).toContain('xmlns:tools="http://schemas.android.com/tools"');
      expect(overlay).toContain('android.permission.INTERNET');
      expect(overlay).toContain('tools:node="remove"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
