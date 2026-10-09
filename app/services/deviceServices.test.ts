import { describe, expect, it, vi } from 'vitest';
import type { ExpoLocationModule } from './location.ts';
import { LOCATION_TIMEOUT_MS, createLocationService } from './location.ts';
import type { ExpoBrightnessModule, ExpoKeepAwakeModule } from './screen.ts';
import { SOS_KEEP_AWAKE_TAG, createScreenService } from './screen.ts';

// The expo native modules cannot be loaded in Node, so the services expose the same optional
// dependency seam as `power.ts`: production requires the module lazily, tests inject a stub.

interface LocationStub {
  granted: boolean;
  services: boolean;
  accuracy: number | null;
  positionFails: boolean;
  positionNever: boolean;
  permissionCalls: number;
  positionCalls: number;
  module: ExpoLocationModule;
}

function locationStub(over: Partial<LocationStub> = {}): LocationStub {
  const stub: LocationStub = {
    granted: true,
    services: true,
    accuracy: 25,
    positionFails: false,
    positionNever: false,
    permissionCalls: 0,
    positionCalls: 0,
    module: {},
    ...over,
  };
  stub.module = {
    requestForegroundPermissionsAsync: async () => {
      stub.permissionCalls += 1;
      return { granted: stub.granted };
    },
    hasServicesEnabledAsync: async () => stub.services,
    getCurrentPositionAsync: async () => {
      stub.positionCalls += 1;
      if (stub.positionFails) throw new Error('no fix');
      if (stub.positionNever) return await new Promise<never>(() => {});
      return {
        coords: { latitude: 14.5995, longitude: 120.9842, accuracy: stub.accuracy },
        timestamp: Date.parse('2026-10-10T08:00:00+08:00'),
      };
    },
    Accuracy: { Low: 2 },
  };
  return stub;
}

interface ScreenStub {
  keepAwake: { activate: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn> };
  brightness: { getBrightness: ReturnType<typeof vi.fn>; setBrightness: ReturnType<typeof vi.fn> };
  screen: ReturnType<typeof createScreenService>;
}

function screenStub(): ScreenStub {
  const keepAwake = { activate: vi.fn(async () => {}), deactivate: vi.fn(async () => {}) };
  const brightness = { getBrightness: vi.fn(async () => 0.4), setBrightness: vi.fn(async () => {}) };
  const keepAwakeModule: ExpoKeepAwakeModule = {
    activateKeepAwakeAsync: keepAwake.activate,
    deactivateKeepAwake: keepAwake.deactivate,
  };
  const brightnessModule: ExpoBrightnessModule = {
    getBrightnessAsync: brightness.getBrightness,
    setBrightnessAsync: brightness.setBrightness,
  };
  const screen = createScreenService({
    loadKeepAwake: () => keepAwakeModule,
    loadBrightness: () => brightnessModule,
  });
  return { keepAwake, brightness, screen };
}

describe('createLocationService', () => {
  it('returns one coarse reading when permission is granted', async () => {
    const stub = locationStub();
    const service = createLocationService({ loadModule: () => stub.module });
    expect(await service.readOnce()).toEqual({
      ok: true,
      value: { lat: 14.5995, lon: 120.9842, accuracyM: 25, at: '2026-10-10T08:00:00+08:00' },
    });
    expect(stub.permissionCalls).toBe(1);
    expect(stub.positionCalls).toBe(1);
  });

  it('maps a denied permission to permission_denied and never asks for a fix', async () => {
    const stub = locationStub({ granted: false });
    const service = createLocationService({ loadModule: () => stub.module });
    expect(await service.readOnce()).toMatchObject({ ok: false, error: { code: 'permission_denied' } });
    expect(stub.positionCalls).toBe(0);
  });

  it('maps location services off to services_off', async () => {
    const stub = locationStub({ services: false });
    const service = createLocationService({ loadModule: () => stub.module });
    expect(await service.readOnce()).toMatchObject({ ok: false, error: { code: 'services_off' } });
    expect(stub.positionCalls).toBe(0);
  });

  it('maps a missing native module to unavailable', async () => {
    const service = createLocationService({ loadModule: () => null });
    expect(await service.readOnce()).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('maps a failed fix to unavailable', async () => {
    const stub = locationStub({ positionFails: true });
    const service = createLocationService({ loadModule: () => stub.module });
    expect(await service.readOnce()).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('gives unavailable when the fix does not arrive in time', async () => {
    const stub = locationStub({ positionNever: true });
    const service = createLocationService({ loadModule: () => stub.module });
    vi.useFakeTimers();
    try {
      const pending = service.readOnce();
      await vi.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'unavailable' } });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createScreenService', () => {
  it('sosOn boosts this window to full brightness and holds a wake lock', async () => {
    const { screen, brightness, keepAwake } = screenStub();
    await screen.sosOn();
    expect(brightness.getBrightness).toHaveBeenCalledTimes(1);
    expect(brightness.setBrightness).toHaveBeenLastCalledWith(1);
    expect(keepAwake.activate).toHaveBeenCalledWith(SOS_KEEP_AWAKE_TAG);
  });

  it('sosOff restores the previous brightness and releases the wake lock', async () => {
    const { screen, brightness, keepAwake } = screenStub();
    await screen.sosOn();
    await screen.sosOff();
    expect(brightness.setBrightness).toHaveBeenLastCalledWith(0.4);
    expect(keepAwake.deactivate).toHaveBeenCalledWith(SOS_KEEP_AWAKE_TAG);
  });

  it('remembers the original brightness across repeated sosOn calls', async () => {
    const { screen, brightness } = screenStub();
    await screen.sosOn();
    await screen.sosOn();
    expect(brightness.getBrightness).toHaveBeenCalledTimes(1);
  });

  it('never throws when the brightness module fails', async () => {
    const { screen, brightness } = screenStub();
    brightness.getBrightness.mockRejectedValue(new Error('no brightness'));
    brightness.setBrightness.mockRejectedValue(new Error('no brightness'));
    await expect(screen.sosOn()).resolves.toBeUndefined();
    await expect(screen.sosOff()).resolves.toBeUndefined();
  });

  it('never throws when the keep-awake module fails', async () => {
    const { screen, keepAwake } = screenStub();
    keepAwake.activate.mockRejectedValue(new Error('no wake lock'));
    keepAwake.deactivate.mockRejectedValue(new Error('no wake lock'));
    await expect(screen.sosOn()).resolves.toBeUndefined();
    await expect(screen.sosOff()).resolves.toBeUndefined();
  });

  it('never throws when the native modules are missing', async () => {
    const screen = createScreenService({ loadKeepAwake: () => null, loadBrightness: () => null });
    await expect(screen.sosOn()).resolves.toBeUndefined();
    await expect(screen.sosOff()).resolves.toBeUndefined();
  });
});
