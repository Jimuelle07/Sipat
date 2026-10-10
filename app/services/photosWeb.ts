// Browser PhotoService (desktop and phone browsers). The native service needs expo-file-system and
// ML Kit, which do not run on web, so this one captures from the live camera with getUserMedia,
// crops on a canvas and keeps the JPEG as a data URL inside the locally stored profile. Canvas
// re-encoding drops EXIF (including location); nothing is uploaded. Face detection is unavailable,
// so the member crops by hand, as on a phone without ML Kit.
import type { CropRect, PhotoService, PickedPhoto, Result } from '../types/index.ts';

type PickError = 'permission_denied' | 'no_camera' | 'unreadable';
type Facing = 'user' | 'environment';
type CropToPixels = (crop: CropRect, width: number, height: number) => { originX: number; originY: number; width: number; height: number };

const ok = <T>(value: T): Result<T, PickError> => ({ ok: true, value });
const err = (code: PickError, message: string): Result<never, PickError> => ({ ok: false, error: { code, message } });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be read'));
    image.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable file')));
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable file'));
    reader.readAsDataURL(file);
  });
}

/** Opens the system file chooser; with `capture` a phone browser goes straight to its camera app. */
function chooseFile(capture?: Facing): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', capture);
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

async function fileToPhoto(file: File | null): Promise<Result<PickedPhoto | null, PickError>> {
  if (!file) return ok(null);
  try {
    const uri = await readAsDataUrl(file);
    const image = await loadImage(uri);
    return ok({ uri, width: image.naturalWidth, height: image.naturalHeight });
  } catch {
    return err('unreadable', 'Photo could not be read');
  }
}

function button(label: string, style: Partial<CSSStyleDeclaration>, inner = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', label);
  element.title = label;
  element.innerHTML = inner;
  Object.assign(element.style, {
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.16)', color: '#fff', borderRadius: '999px', width: '52px', height: '52px',
    font: '600 15px system-ui, sans-serif',
  }, style);
  return element;
}

const CLOSE_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const FLIP_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11a4 4 0 0 1 4 4v1"/><path d="M16 4l3 3-3 3"/><path d="M20 17H9a4 4 0 0 1-4-4v-1"/><path d="M8 20l-3-3 3-3"/></svg>';

/**
 * Full-screen live camera: a mirrored selfie preview with a round face guide, a shutter, close and
 * (when the device has more than one camera) a front/back switch. Resolves with a JPEG data URL of
 * the full frame, or null when closed. Escape closes it.
 */
async function captureFromCamera(labels: CameraLabels): Promise<Result<PickedPhoto | null, PickError>> {
  const media = navigator.mediaDevices;
  let facing: Facing = 'user';
  const open = (mode: Facing) => media.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });

  let stream: MediaStream;
  try {
    stream = await open(facing);
  } catch (cause) {
    const name = cause instanceof DOMException ? cause.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return err('permission_denied', 'Camera permission was not granted');
    return err('no_camera', 'No camera was found');
  }
  const cameras = (await media.enumerateDevices().catch(() => [])).filter((device) => device.kind === 'videoinput').length;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', labels.title);
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', background: '#05070d',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    });

    const stage = document.createElement('div');
    Object.assign(stage.style, { position: 'relative', width: 'min(100vw, 100vh - 140px)', aspectRatio: '1', overflow: 'hidden' });
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'cover' });
    const guide = document.createElement('div');
    Object.assign(guide.style, {
      position: 'absolute', left: '50%', top: '50%', width: '62%', aspectRatio: '1', transform: 'translate(-50%, -50%)',
      borderRadius: '50%', border: '3px solid rgba(255,255,255,0.85)', boxShadow: '0 0 0 9999px rgba(5,7,13,0.45)', pointerEvents: 'none',
    });
    stage.append(video, guide);

    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'min(100vw, 420px)', padding: '20px 28px', boxSizing: 'border-box' });
    const close = button(labels.close, {}, CLOSE_ICON);
    const shutter = button(labels.shutter, { width: '76px', height: '76px', background: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.35)' });
    const flip = button(labels.flip, { visibility: cameras > 1 ? 'visible' : 'hidden' }, FLIP_ICON);
    bar.append(close, shutter, flip);
    overlay.append(stage, bar);

    const attach = (next: MediaStream) => {
      stream = next;
      video.srcObject = next;
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    };
    const stop = () => stream.getTracks().forEach((track) => track.stop());
    const finish = (value: Result<PickedPhoto | null, PickError>) => {
      stop();
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(ok(null)); };

    close.addEventListener('click', () => finish(ok(null)));
    flip.addEventListener('click', () => {
      const nextFacing: Facing = facing === 'user' ? 'environment' : 'user';
      stop();
      open(nextFacing)
        .then((next) => { facing = nextFacing; attach(next); })
        .catch(() => open(facing).then(attach).catch(() => finish(err('no_camera', 'Camera stopped'))));
    });
    shutter.addEventListener('click', () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) { finish(err('unreadable', 'Canvas is unavailable')); return; }
      // Save what the user saw: the selfie preview is mirrored, so mirror the capture too.
      if (facing === 'user') { context.translate(width, 0); context.scale(-1, 1); }
      context.drawImage(video, 0, 0, width, height);
      finish(ok({ uri: canvas.toDataURL('image/jpeg', 0.92), width, height }));
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    attach(stream);
    shutter.focus();
  });
}

export interface CameraLabels { title: string; shutter: string; close: string; flip: string }

const CAMERA_LABELS: CameraLabels = {
  title: 'Kamera · Camera',
  shutter: 'Kunan ng litrato · Take photo',
  close: 'Isara · Close',
  flip: 'Palitan ang kamera · Switch camera',
};

export function createWebPhotoService({ size, quality, toPixels }: { size: number; quality: number; toPixels: CropToPixels }): PhotoService {
  return {
    async pick(source) {
      if (source === 'gallery') return fileToPhoto(await chooseFile());
      // Live camera needs a secure page (https or localhost). On plain http, e.g. a phone opening the
      // laptop's LAN address, the file input with `capture` still opens the phone's camera app.
      if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        const captured = await captureFromCamera(CAMERA_LABELS);
        if (captured.ok || captured.error.code === 'permission_denied') return captured;
      }
      return fileToPhoto(await chooseFile('user'));
    },

    async detect() {
      return { detection: 'unavailable', faces: [] };
    },

    async saveCrop(uri, crop) {
      try {
        const image = await loadImage(uri);
        const rect = toPixels(crop, image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        context.drawImage(image, rect.originX, rect.originY, rect.width, rect.height, 0, 0, size, size);
        const saved = canvas.toDataURL('image/jpeg', quality);
        return { ok: true, value: { uri: saved, bytes: Math.round(((saved.length - saved.indexOf(',') - 1) * 3) / 4) } };
      } catch {
        return { ok: false, error: { code: 'io', message: 'Photo could not be saved' } };
      }
    },

    // Photos live inside the stored profile as data URLs; dropping the reference removes them.
    async remove() {},
  };
}
