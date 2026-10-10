import type { FaceBox, FaceDetection, Result } from '../types/index.ts';
import type { CropRect, PhotoService, PickedPhoto } from '../types/index.ts';
import { createWebPhotoService } from './photosWeb.ts';

/** Square side of the stored member photo, in pixels. */
export const PHOTO_SIZE = 512;
/** JPEG compression for the stored photo (drops EXIF, including location). */
export const PHOTO_QUALITY = 0.85;
/** App-private directory under the document directory. */
export const PHOTO_DIR = 'photos';
/** ML Kit face boxes are capped at 15, left to right. */
const MAX_FACES = 15;

type PickError = 'permission_denied' | 'no_camera' | 'unreadable';

const ok = <T>(value: T): Result<T, PickError> => ({ ok: true, value });
const err = (code: PickError, message: string = code): Result<never, PickError> => ({
  ok: false,
  error: { code, message },
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Converts a normalized crop rectangle to integer source pixels, clamped to the image. */
export function cropToPixels(crop: CropRect, width: number, height: number): {
  originX: number; originY: number; width: number; height: number;
} {
  const originX = Math.round(clamp01(crop.x) * width);
  const originY = Math.round(clamp01(crop.y) * height);
  const cropWidth = Math.max(1, Math.min(width - originX, Math.round(clamp01(crop.width) * width)));
  const cropHeight = Math.max(1, Math.min(height - originY, Math.round(clamp01(crop.height) * height)));
  return { originX, originY, width: cropWidth, height: cropHeight };
}

/** Maps raw ML Kit frames (pixels) to normalized boxes, left to right. */
export function normalizeFaces(
  faces: { frame?: { left: number; top: number; width: number; height: number } }[],
  size: { width: number; height: number },
): FaceBox[] {
  if (size.width <= 0 || size.height <= 0) return [];
  const boxes: FaceBox[] = [];
  for (const face of faces) {
    const frame = face?.frame;
    if (!frame) continue;
    boxes.push({
      x: clamp01(frame.left / size.width),
      y: clamp01(frame.top / size.height),
      width: clamp01(frame.width / size.width),
      height: clamp01(frame.height / size.height),
    });
  }
  boxes.sort((a, b) => a.x - b.x);
  return boxes.slice(0, MAX_FACES);
}

function safeName(memberId: string): string {
  return memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

const PICK_OPTIONS = { mediaTypes: ['images'] as const, quality: 1, exif: false, allowsEditing: false };

function toPicked(result: {
  canceled?: boolean; assets?: { uri: string; width?: number; height?: number }[] | null;
}): Result<PickedPhoto | null, PickError> {
  if (result?.canceled) return ok(null);
  const asset = result?.assets?.[0];
  if (!asset) return err('unreadable', 'No photo was returned');
  return ok({ uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 });
}

/**
 * Production PhotoService: expo-image-picker, ML Kit face detection and expo-image-manipulator on
 * phones; the browser camera and canvas on web (desktop and phone browsers), see photosWeb.ts.
 */
export function createPhotoService(): PhotoService {
  // React Native has no `document`; a browser does.
  if (typeof document !== 'undefined') {
    return createWebPhotoService({ size: PHOTO_SIZE, quality: PHOTO_QUALITY, toPixels: cropToPixels });
  }
  const imageSize = async (uri: string): Promise<{ width: number; height: number }> => {
    const { ImageManipulator } = require('expo-image-manipulator') as {
      ImageManipulator: { manipulate: (source: string) => { renderAsync: () => Promise<{ width: number; height: number }> } };
    };
    const ref = await ImageManipulator.manipulate(uri).renderAsync();
    return { width: ref.width, height: ref.height };
  };

  return {
    async pick(source) {
      let picker: {
        requestCameraPermissionsAsync: () => Promise<{ granted?: boolean }>;
        launchCameraAsync: (options: object) => Promise<{ canceled?: boolean; assets?: { uri: string; width?: number; height?: number }[] | null }>;
        launchImageLibraryAsync: (options: object) => Promise<{ canceled?: boolean; assets?: { uri: string; width?: number; height?: number }[] | null }>;
      };
      try {
        picker = require('expo-image-picker');
      } catch {
        return err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo picker is unavailable');
      }
      try {
        if (source === 'camera') {
          const permission = await picker.requestCameraPermissionsAsync();
          if (!permission?.granted) return err('permission_denied', 'Camera permission was not granted');
          return toPicked(await picker.launchCameraAsync(PICK_OPTIONS));
        }
        return toPicked(await picker.launchImageLibraryAsync(PICK_OPTIONS));
      } catch {
        return err(source === 'camera' ? 'no_camera' : 'unreadable', 'Photo could not be opened');
      }
    },

    async detect(uri) {
      let module: { default?: { detect?: (u: string, o: object) => Promise<unknown[]> }; detect?: (u: string, o: object) => Promise<unknown[]> };
      try {
        module = require('@react-native-ml-kit/face-detection');
      } catch {
        return { detection: 'unavailable', faces: [] };
      }
      try {
        const api = module?.default ?? module;
        const detectFaces = api?.detect;
        if (typeof detectFaces !== 'function') return { detection: 'unavailable', faces: [] };
        const raw = await detectFaces(uri, {
          performanceMode: 'fast',
          landmarkMode: 'none',
          contourMode: 'none',
          classificationMode: 'none',
          trackingEnabled: false,
        });
        if (!Array.isArray(raw)) return { detection: 'unavailable', faces: [] };
        const size = await imageSize(uri);
        const faces = normalizeFaces(raw as { frame?: { left: number; top: number; width: number; height: number } }[], size);
        const detection: FaceDetection = faces.length === 0 ? 'no_face' : faces.length === 1 ? 'one_face' : 'many_faces';
        return { detection, faces };
      } catch {
        return { detection: 'unavailable', faces: [] };
      }
    },

    async saveCrop(uri, crop, memberId) {
      let manipulator: {
        ImageManipulator: {
          manipulate: (source: string) => {
            crop: (rect: { originX: number; originY: number; width: number; height: number }) => {
              resize: (size: { width: number; height: number }) => {
                renderAsync: () => Promise<{ saveAsync: (options: object) => Promise<{ uri: string }> }>;
              };
            };
            renderAsync: () => Promise<{ width: number; height: number }>;
          };
        };
        SaveFormat: { JPEG: string };
      };
      let fs: {
        Directory: new (...uris: unknown[]) => { exists: boolean; create: () => void; uri: string };
        File: new (...uris: unknown[]) => { exists: boolean; delete: () => void; move: (destination: unknown) => Promise<void>; size: number; uri: string };
        Paths: { document: unknown };
      };
      try {
        manipulator = require('expo-image-manipulator');
        fs = require('expo-file-system');
      } catch {
        return { ok: false, error: { code: 'io', message: 'Photo storage is unavailable' } };
      }
      try {
        const original = await manipulator.ImageManipulator.manipulate(uri).renderAsync();
        if (!original.width || !original.height) throw new Error('unknown image size');
        const rect = cropToPixels(crop, original.width, original.height);
        const rendered = await manipulator.ImageManipulator.manipulate(uri)
          .crop(rect)
          .resize({ width: PHOTO_SIZE, height: PHOTO_SIZE })
          .renderAsync();
        const saved = await rendered.saveAsync({ format: manipulator.SaveFormat.JPEG, compress: PHOTO_QUALITY });

        const directory = new fs.Directory(fs.Paths.document, PHOTO_DIR);
        if (!directory.exists) directory.create();
        const destination = new fs.File(directory, `${safeName(memberId)}-${Date.now()}.jpg`);
        await new fs.File(saved.uri).move(destination);
        const bytes = destination.size;

        try {
          const preview = new fs.File(uri);
          if (preview.exists) preview.delete();
        } catch {
          /* the temp source may already be gone */
        }
        return { ok: true, value: { uri: destination.uri, bytes } };
      } catch {
        return { ok: false, error: { code: 'io', message: 'Photo could not be saved' } };
      }
    },

    async remove(photoUri) {
      try {
        const { File } = require('expo-file-system') as {
          File: new (uri: string) => { exists: boolean; delete: () => void };
        };
        const file = new File(photoUri);
        if (file.exists) file.delete();
      } catch {
        /* idempotent: missing file or native module is not an error */
      }
    },
  };
}
