import type { DeviceTier, Settings } from '../types/common.ts';
import type { AiDecision, PowerPolicy } from '../types/services.ts';

export interface BatteryState {
  /** Percent, 0 to 100 (matches the level unit in EngineStatus.battery). */
  level: number;
  charging: boolean;
  saver: boolean;
}

/** Settings default (docs: "Low-battery mode below 15%"). */
export const DEFAULT_LOW_BATTERY_THRESHOLD = 15;

const GIB = 1024 ** 3;

// README "shared names" device tier table. Proposals to measure on the reference phone.
export const FULL_TIER_RAM_BYTES = Math.round(3.5 * GIB); // >= 3.5 GB reported (sold as 4 GB or more)
export const LITE_TIER_RAM_BYTES = Math.round(2.5 * GIB); // 2.5 to 3.5 GB reported (sold as 3 GB)

/** Maps reported physical RAM (bytes) to a device tier. Unknown RAM falls to `none`. */
export function tierFromRamBytes(totalMemory: number | null): DeviceTier {
  if (totalMemory === null || !Number.isFinite(totalMemory) || totalMemory <= 0) return 'none';
  if (totalMemory >= FULL_TIER_RAM_BYTES) return 'full';
  if (totalMemory >= LITE_TIER_RAM_BYTES) return 'lite';
  return 'none';
}

/**
 * Decides whether on-device AI may run. First failing check wins:
 * ai_off, tier, no_model, battery_saver, low_battery. Unknown battery (null) is allowed.
 */
export function decideAi(input: {
  settings: Settings;
  battery: BatteryState | null;
  tier: DeviceTier;
  modelPresent: boolean;
}): AiDecision {
  const { settings, battery, tier, modelPresent } = input;
  if (!settings.aiEnabled) return { allowed: false, reason: 'ai_off' };
  if (tier === 'none') return { allowed: false, reason: 'tier' };
  if (!modelPresent) return { allowed: false, reason: 'no_model' };
  if (battery !== null) {
    if (battery.saver) return { allowed: false, reason: 'battery_saver' };
    const threshold = Number.isFinite(settings.lowBatteryThreshold)
      ? settings.lowBatteryThreshold
      : DEFAULT_LOW_BATTERY_THRESHOLD;
    if (!battery.charging && battery.level < threshold) {
      return { allowed: false, reason: 'low_battery' };
    }
  }
  return { allowed: true };
}

interface Subscription {
  remove(): void;
}

interface ExpoBattery {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<number>;
  isLowPowerModeEnabledAsync?(): Promise<boolean>;
  addBatteryLevelListener?(cb: (event: { batteryLevel: number }) => void): Subscription;
  addBatteryStateListener?(cb: (event: { batteryState: number }) => void): Subscription;
  addLowPowerModeListener?(cb: (event: { lowPowerMode: boolean }) => void): Subscription;
  BatteryState?: { CHARGING: number; FULL: number; UNPLUGGED: number; UNKNOWN: number };
}

function loadExpoBattery(): ExpoBattery | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Battery = require('expo-battery') as ExpoBattery;
    if (typeof Battery?.getBatteryLevelAsync !== 'function') return null;
    return Battery;
  } catch {
    return null;
  }
}

function loadExpoDevice(): { totalMemory?: number | null } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as { totalMemory?: number | null };
    return Device ?? null;
  } catch {
    return null;
  }
}

/** Reads the current battery as a percent. Returns null when the native module is unavailable. */
export async function defaultReadBattery(): Promise<BatteryState | null> {
  const Battery = loadExpoBattery();
  if (!Battery) return null;
  try {
    const levelRaw = await Battery.getBatteryLevelAsync();
    if (typeof levelRaw !== 'number' || !Number.isFinite(levelRaw) || levelRaw < 0) return null;
    const [state, saver] = await Promise.all([
      Battery.getBatteryStateAsync(),
      typeof Battery.isLowPowerModeEnabledAsync === 'function'
        ? Battery.isLowPowerModeEnabledAsync()
        : Promise.resolve(false),
    ]);
    const charging =
      state === Battery.BatteryState?.CHARGING || state === Battery.BatteryState?.FULL;
    return { level: Math.max(0, Math.min(100, Math.round(levelRaw * 100))), charging, saver: saver === true };
  } catch {
    return null;
  }
}

/** Reads the device tier from reported RAM. Web/Node (no expo-device) resolves to `none`. */
export async function defaultReadTier(): Promise<DeviceTier> {
  const Device = loadExpoDevice();
  if (!Device) return 'none';
  const total = Device.totalMemory;
  if (typeof total !== 'number' || !Number.isFinite(total)) return 'none';
  return tierFromRamBytes(total);
}

/** Subscribes to battery level, charging state and battery-saver changes. Returns an unsubscribe. */
export function defaultSubscribeBattery(cb: (b: BatteryState) => void): () => void {
  const Battery = loadExpoBattery();
  if (!Battery) return () => {};
  try {
    const push = (): void => {
      void defaultReadBattery().then((b) => {
        if (b !== null) cb(b);
      });
    };
    const subs: Subscription[] = [];
    if (typeof Battery.addBatteryLevelListener === 'function')
      subs.push(Battery.addBatteryLevelListener(push));
    if (typeof Battery.addBatteryStateListener === 'function')
      subs.push(Battery.addBatteryStateListener(push));
    if (typeof Battery.addLowPowerModeListener === 'function')
      subs.push(Battery.addLowPowerModeListener(push));
    return () => {
      for (const sub of subs) {
        try {
          sub.remove();
        } catch {
          /* listener already gone */
        }
      }
    };
  } catch {
    return () => {};
  }
}

export interface PowerPolicyDeps {
  getSettings: () => Settings;
  modelPresent: () => boolean;
  readBattery?: () => Promise<BatteryState | null>;
  readTier?: () => Promise<DeviceTier>;
  subscribeBattery?: (cb: (b: BatteryState) => void) => () => void;
}

export type PowerPolicyService = PowerPolicy & {
  battery(): BatteryState | null;
  tier(): Promise<DeviceTier>;
  refresh(): Promise<AiDecision>;
};

function sameDecision(a: AiDecision, b: AiDecision): boolean {
  if (a.allowed && b.allowed) return true;
  if (!a.allowed && !b.allowed) return a.reason === b.reason;
  return false;
}

export function createPowerPolicy(deps: PowerPolicyDeps): PowerPolicyService {
  const getSettings = deps.getSettings;
  const modelPresent = deps.modelPresent;
  const readBattery = deps.readBattery ?? defaultReadBattery;
  const readTier = deps.readTier ?? defaultReadTier;
  const subscribeBattery = deps.subscribeBattery ?? defaultSubscribeBattery;

  const listeners = new Set<(d: AiDecision) => void>();
  let lastDecision: AiDecision | null = null;
  let cachedBattery: BatteryState | null = null;
  let cachedTier: DeviceTier | null = null;

  function emit(decision: AiDecision): void {
    if (lastDecision !== null && sameDecision(lastDecision, decision)) return;
    lastDecision = decision;
    for (const listener of [...listeners]) listener(decision);
  }

  function evaluate(battery: BatteryState | null, tier: DeviceTier): AiDecision {
    return decideAi({ settings: getSettings(), battery, tier, modelPresent: modelPresent() });
  }

  async function refresh(): Promise<AiDecision> {
    const battery = await readBattery().catch((): BatteryState | null => null);
    cachedBattery = battery;
    cachedTier = await readTier().catch((): DeviceTier => 'none');
    const decision = evaluate(battery, cachedTier);
    emit(decision);
    return decision;
  }

  async function recompute(battery: BatteryState): Promise<AiDecision> {
    cachedBattery = battery;
    const tier = cachedTier ?? (await readTier().catch((): DeviceTier => 'none'));
    cachedTier = tier;
    const decision = evaluate(battery, tier);
    emit(decision);
    return decision;
  }

  async function tier(): Promise<DeviceTier> {
    if (cachedTier !== null) return cachedTier;
    cachedTier = await readTier().catch((): DeviceTier => 'none');
    return cachedTier;
  }

  subscribeBattery((b) => {
    void recompute(b);
  });

  return {
    aiAllowed: () => refresh(),
    onChange(listener: (d: AiDecision) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    battery: () => cachedBattery,
    tier,
    refresh,
  };
}
