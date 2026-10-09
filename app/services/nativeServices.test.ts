import { describe, expect, it } from 'vitest';
import { createFilePicker } from './files.ts';
import { createPhotoService } from './photos.ts';
import { createShareService } from './share.ts';

// The native modules are absent in the Node test environment, so every method must resolve to its
// documented error code and never throw (docs/api-layer.md section 7).
describe('production photo service without native modules', () => {
  const photos = createPhotoService();

  it('pick returns the documented error for each source', async () => {
    expect(await photos.pick('camera')).toMatchObject({ ok: false, error: { code: 'no_camera' } });
    expect(await photos.pick('gallery')).toMatchObject({ ok: false, error: { code: 'unreadable' } });
  });

  it('detect returns unavailable with no faces', async () => {
    expect(await photos.detect('file:///missing.jpg')).toEqual({ detection: 'unavailable', faces: [] });
  });

  it('saveCrop returns io', async () => {
    const crop = { x: 0, y: 0, width: 1, height: 1 };
    expect(await photos.saveCrop('file:///missing.jpg', crop, 'member-1')).toMatchObject({
      ok: false,
      error: { code: 'io' },
    });
  });

  it('remove is idempotent and never throws', async () => {
    await expect(photos.remove('file:///missing.jpg')).resolves.toBeUndefined();
  });
});

describe('production share service without native modules', () => {
  it('shareMemberCard returns failed', async () => {
    expect(await createShareService().shareMemberCard({ current: null })).toMatchObject({
      ok: false,
      error: { code: 'failed' },
    });
  });
});

describe('production file picker without native modules', () => {
  it('pick returns io for both kinds', async () => {
    const picker = createFilePicker();
    expect(await picker.pick('model')).toMatchObject({ ok: false, error: { code: 'io' } });
    expect(await picker.pick('pack')).toMatchObject({ ok: false, error: { code: 'io' } });
  });
});
