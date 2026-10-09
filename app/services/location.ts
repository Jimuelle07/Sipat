import type { LatLon, Result } from '../types/index.ts';
import type { LocationService } from '../types/services.ts';
import { toManilaIso } from '../core/time.ts';

export type LocationReadError = 'permission_denied' | 'services_off' | 'unavailable';

/** One-shot fix timeout (proposal in docs/api-layer.md section 7). */
export const LOCATION_TIMEOUT_MS = 20_000;

export interface ExpoLocationModule {
  requestForegroundPermissionsAsync?: () => Promise<{ granted?: boolean }>;
  hasServicesEnabledAsync?: () => Promise<boolean>;
  getCurrentPositionAsync?: (options?: { accuracy?: number }) => Promise<{
    coords: { latitude: number; longitude: number; accuracy: number | null };
    timestamp: number;
  }>;
  Accuracy?: { Low: number };
}

export interface LocationServiceDeps {
  /** Test seam; production requires the native module lazily. */
  loadModule?: () => ExpoLocationModule | null;
  timeoutMs?: number;
}

/** Requires the module lazily so this file still imports in Node. */
function loadExpoLocation(): ExpoLocationModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as ExpoLocationModule;
    if (typeof Location?.requestForegroundPermissionsAsync !== 'function') return null;
    return Location;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

type Reading = LatLon & { accuracyM: number; at: string };

const ok = (value: Reading): Result<Reading, LocationReadError> => ({ ok: true, value });

const err = (code: LocationReadError): Result<Reading, LocationReadError> =>
  ({ ok: false, error: { code, message: code } });

/**
 * Production LocationService. One foreground permission request, then one coarse fix.
 * Never watches, never runs in the background and never leaves the phone.
 */
export function createLocationService(deps: LocationServiceDeps = {}): LocationService {
  const loadModule = deps.loadModule ?? loadExpoLocation;
  const timeoutMs = deps.timeoutMs ?? LOCATION_TIMEOUT_MS;

  return {
    async readOnce() {
      const Location = loadModule();
      if (!Location) return err('unavailable');
      try {
        const permission = await Location.requestForegroundPermissionsAsync?.();
        if (!permission?.granted) return err('permission_denied');

        if (typeof Location.hasServicesEnabledAsync === 'function') {
          const enabled = await Location.hasServicesEnabledAsync();
          if (enabled === false) return err('services_off');
        }

        const getCurrentPositionAsync = Location.getCurrentPositionAsync;
        if (typeof getCurrentPositionAsync !== 'function') return err('unavailable');
        const position = await withTimeout(
          getCurrentPositionAsync({ accuracy: Location.Accuracy?.Low }),
          timeoutMs,
        );

        const lat = position?.coords?.latitude;
        const lon = position?.coords?.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          return err('unavailable');
        }
        const rawAccuracy = position.coords.accuracy;
        const accuracyM = typeof rawAccuracy === 'number' && Number.isFinite(rawAccuracy) ? rawAccuracy : 0;
        const at = Number.isFinite(position.timestamp)
          ? toManilaIso(new Date(position.timestamp))
          : toManilaIso(new Date());

        return ok({ lat, lon, accuracyM, at });
      } catch {
        return err('unavailable');
      }
    },
  };
}
