import type { Result, ShareService, ShareableView } from '../types/index.ts';

const ok = <T>(value: T): Result<T, 'cancelled' | 'failed'> => ({ ok: true, value });
const err = (code: 'cancelled' | 'failed', message: string = code): Result<never, 'cancelled' | 'failed'> => ({
  ok: false,
  error: { code, message },
});

/**
 * Production ShareService: captures the rendered card view to a PNG in the app cache with
 * react-native-view-shot, opens the Android share sheet with expo-sharing, then deletes the temp PNG.
 * expo-sharing reports no result for a dismissed sheet, so only a native error maps to 'failed'.
 */
export function createShareService(): ShareService {
  return {
    async shareMemberCard(cardView: ShareableView) {
      let captureRef: (view: unknown, options: object) => Promise<string>;
      let sharing: {
        isAvailableAsync: () => Promise<boolean>;
        shareAsync: (url: string, options?: object) => Promise<void>;
      };
      let File: new (uri: string) => { exists: boolean; delete: () => void };
      try {
        const viewShot = require('react-native-view-shot') as {
          captureRef?: (view: unknown, options: object) => Promise<string>;
          default?: { captureRef?: (view: unknown, options: object) => Promise<string> };
        };
        const captured = viewShot.captureRef ?? viewShot.default?.captureRef;
        if (typeof captured !== 'function') throw new Error('view-shot is unavailable');
        captureRef = captured;
        sharing = require('expo-sharing');
        File = (require('expo-file-system') as { File: new (uri: string) => { exists: boolean; delete: () => void } }).File;
      } catch {
        return err('failed', 'Sharing is unavailable');
      }

      let uri: string | null = null;
      try {
        uri = await captureRef(cardView, { format: 'png', result: 'tmpfile', quality: 1 });
        const available = await sharing.isAvailableAsync();
        if (!available) return err('failed', 'Sharing is not available on this device');
        await sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
        return ok(undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/cancel|dismiss/i.test(message)) return err('cancelled', 'Share was dismissed');
        return err('failed', 'Share failed');
      } finally {
        if (uri) {
          try {
            const file = new File(uri);
            if (file.exists) file.delete();
          } catch {
            /* the cache file may already be gone */
          }
        }
      }
    },
  };
}
