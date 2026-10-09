import type { FilePicker, PickedFile, Result } from '../types/index.ts';

const ok = <T>(value: T): Result<T, 'io'> => ({ ok: true, value });
const err = (message: string = 'io'): Result<never, 'io'> => ({ ok: false, error: { code: 'io', message } });

/**
 * Production FilePicker: expo-document-picker. 'model' does not copy the 0.81 GB file to the cache
 * (ModelManager.install streams from the URI); 'pack' copies the small .bagyopack.
 */
export function createFilePicker(): FilePicker {
  return {
    async pick(kind) {
      let picker: {
        getDocumentAsync: (options: object) => Promise<{
          canceled?: boolean;
          assets?: { uri: string; name: string; size?: number }[] | null;
        }>;
      };
      try {
        picker = require('expo-document-picker');
      } catch {
        return err('Document picker is unavailable');
      }
      try {
        const result = await picker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: kind === 'pack',
          multiple: false,
        });
        if (result?.canceled) return ok(null);
        const asset = result?.assets?.[0];
        if (!asset) return ok(null);
        const picked: PickedFile = { uri: asset.uri, name: asset.name, size: asset.size ?? 0 };
        return ok(picked);
      } catch {
        return err('Could not open the document picker');
      }
    },
  };
}
