import type { ScreenService } from '../types/services.ts';

/** Tag for the SOS wake lock, so we release only our own lock. */
export const SOS_KEEP_AWAKE_TAG = 'sipat-sos';

export interface ExpoKeepAwakeModule {
  activateKeepAwakeAsync?: (tag?: string) => Promise<void>;
  deactivateKeepAwake?: (tag?: string) => Promise<void>;
}

export interface ExpoBrightnessModule {
  getBrightnessAsync?: () => Promise<number>;
  setBrightnessAsync?: (value: number) => Promise<void>;
}

export interface ScreenServiceDeps {
  /** Test seams; production requires the native modules lazily. */
  loadKeepAwake?: () => ExpoKeepAwakeModule | null;
  loadBrightness?: () => ExpoBrightnessModule | null;
}

/** Requires the modules lazily so this file still imports in Node. */
function loadExpoKeepAwake(): ExpoKeepAwakeModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-keep-awake') as ExpoKeepAwakeModule) ?? null;
  } catch {
    return null;
  }
}

function loadExpoBrightness(): ExpoBrightnessModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-brightness') as ExpoBrightnessModule) ?? null;
  } catch {
    return null;
  }
}

/**
 * Production ScreenService. Keeps the screen awake and boosts only this window's
 * brightness during an SOS; restores and releases on `sosOff`. Both methods never throw.
 */
export function createScreenService(deps: ScreenServiceDeps = {}): ScreenService {
  const loadKeepAwake = deps.loadKeepAwake ?? loadExpoKeepAwake;
  const loadBrightness = deps.loadBrightness ?? loadExpoBrightness;
  let previousBrightness: number | null = null;

  return {
    async sosOn() {
      try {
        const KeepAwake = loadKeepAwake();
        if (typeof KeepAwake?.activateKeepAwakeAsync === 'function') {
          await KeepAwake.activateKeepAwakeAsync(SOS_KEEP_AWAKE_TAG);
        }
      } catch {
        /* never throw */
      }
      try {
        const Brightness = loadBrightness();
        if (
          typeof Brightness?.getBrightnessAsync === 'function' &&
          typeof Brightness.setBrightnessAsync === 'function'
        ) {
          if (previousBrightness === null) {
            const current = await Brightness.getBrightnessAsync();
            if (typeof current === 'number' && Number.isFinite(current)) previousBrightness = current;
          }
          await Brightness.setBrightnessAsync(1);
        }
      } catch {
        /* never throw */
      }
    },

    async sosOff() {
      try {
        const Brightness = loadBrightness();
        if (previousBrightness !== null && typeof Brightness?.setBrightnessAsync === 'function') {
          const restore = previousBrightness;
          previousBrightness = null;
          await Brightness.setBrightnessAsync(restore);
        }
      } catch {
        /* never throw */
      }
      try {
        const KeepAwake = loadKeepAwake();
        if (typeof KeepAwake?.deactivateKeepAwake === 'function') {
          await KeepAwake.deactivateKeepAwake(SOS_KEEP_AWAKE_TAG);
        }
      } catch {
        /* never throw */
      }
    },
  };
}
