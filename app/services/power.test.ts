import { describe, expect, it, vi } from 'vitest';
import type { DeviceTier, Settings } from '../types/common.ts';
import type { BatteryState } from './power.ts';
import {
  DEFAULT_LOW_BATTERY_THRESHOLD,
  FULL_TIER_RAM_BYTES,
  LITE_TIER_RAM_BYTES,
  createPowerPolicy,
  decideAi,
  tierFromRamBytes,
} from './power.ts';

function settings(over: Partial<Settings> = {}): Settings {
  return {
    language: 'tl',
    lowBatteryThreshold: 15,
    aiEnabled: true,
    staleWarningHours: 3,
    autoCheckUpdates: true,
    wifiOnly: true,
    topicReportsOptIn: false,
    damageReportsOptIn: false,
    ...over,
  };
}

function battery(over: Partial<BatteryState> = {}): BatteryState {
  return { level: 80, charging: false, saver: false, ...over };
}

const allowed = { allowed: true };
const denied = (reason: string) => ({ allowed: false, reason });

describe('tierFromRamBytes', () => {
  it('applies the README tier boundaries', () => {
    expect(tierFromRamBytes(null)).toBe('none');
    expect(tierFromRamBytes(0)).toBe('none');
    expect(tierFromRamBytes(LITE_TIER_RAM_BYTES - 1)).toBe('none');
    expect(tierFromRamBytes(LITE_TIER_RAM_BYTES)).toBe('lite');
    expect(tierFromRamBytes(FULL_TIER_RAM_BYTES - 1)).toBe('lite');
    expect(tierFromRamBytes(FULL_TIER_RAM_BYTES)).toBe('full');
  });
});

describe('decideAi precedence', () => {
  it('reports ai_off before every other check', () => {
    const decision = decideAi({
      settings: settings({ aiEnabled: false }),
      battery: battery({ level: 3, saver: true }),
      tier: 'none',
      modelPresent: false,
    });
    expect(decision).toEqual(denied('ai_off'));
  });

  it('reports tier before no_model when both fail', () => {
    expect(decideAi({ settings: settings(), battery: battery(), tier: 'none', modelPresent: false }))
      .toEqual(denied('tier'));
  });

  it('reports no_model when the model file is missing', () => {
    expect(decideAi({ settings: settings(), battery: battery(), tier: 'full', modelPresent: false }))
      .toEqual(denied('no_model'));
  });

  it('reports battery_saver before low_battery', () => {
    expect(decideAi({
      settings: settings(), battery: battery({ level: 5, saver: true }), tier: 'full', modelPresent: true,
    })).toEqual(denied('battery_saver'));
  });

  it('reports low_battery only below the threshold and not charging', () => {
    expect(decideAi({
      settings: settings(), battery: battery({ level: 10 }), tier: 'lite', modelPresent: true,
    })).toEqual(denied('low_battery'));
  });

  it('allows AI when every check passes', () => {
    expect(decideAi({
      settings: settings(), battery: battery({ level: 80 }), tier: 'full', modelPresent: true,
    })).toEqual(allowed);
  });

  it('allows AI when the battery is unknown (null)', () => {
    expect(decideAi({ settings: settings(), battery: null, tier: 'full', modelPresent: true }))
      .toEqual(allowed);
  });
});

describe('decideAi low-battery boundary', () => {
  it('denies below the threshold and allows at the threshold', () => {
    const at = (level: number, over: Partial<Settings> = {}) => decideAi({
      settings: settings(over), battery: battery({ level }), tier: 'full', modelPresent: true,
    });
    expect(at(14)).toEqual(denied('low_battery'));
    expect(at(15)).toEqual(allowed);
    expect(at(14, { lowBatteryThreshold: DEFAULT_LOW_BATTERY_THRESHOLD })).toEqual(denied('low_battery'));
  });

  it('respects a custom threshold', () => {
    const policySettings = settings({ lowBatteryThreshold: 20 });
    const decide = (level: number, charging = false) => decideAi({
      settings: policySettings, battery: battery({ level, charging }), tier: 'lite', modelPresent: true,
    });
    expect(decide(19)).toEqual(denied('low_battery'));
    expect(decide(20)).toEqual(allowed);
  });

  it('allows a low battery while charging', () => {
    expect(decideAi({
      settings: settings(), battery: battery({ level: 5, charging: true }), tier: 'full', modelPresent: true,
    })).toEqual(allowed);
  });
});

describe('createPowerPolicy', () => {
  function harness(options: { tier?: DeviceTier; battery?: BatteryState | null; modelPresent?: boolean } = {}) {
    const current = { battery: options.battery ?? battery() };
    let push: ((b: BatteryState) => void) | null = null;
    const policy = createPowerPolicy({
      getSettings: () => settings(),
      modelPresent: () => options.modelPresent ?? true,
      readBattery: async () => current.battery,
      readTier: async () => options.tier ?? 'full',
      subscribeBattery: (cb) => {
        push = cb;
        return () => {
          push = null;
        };
      },
    });
    return { policy, current, emitBattery: (b: BatteryState) => push?.(b) };
  }

  it('answers aiAllowed, caches battery and tier, and dedupes onChange', async () => {
    const { policy } = harness();
    const listener = vi.fn();
    policy.onChange(listener);

    expect(policy.battery()).toBeNull();
    expect(await policy.aiAllowed()).toEqual(allowed);
    expect(policy.battery()).toEqual(battery());
    expect(await policy.tier()).toBe('full');

    await policy.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(allowed);
  });

  it('notifies listeners only when the decision changes', async () => {
    const { policy, emitBattery } = harness();
    const listener = vi.fn();
    policy.onChange(listener);
    await policy.refresh();
    expect(listener).toHaveBeenCalledTimes(1);

    emitBattery(battery({ level: 10 }));
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    expect(listener).toHaveBeenLastCalledWith(denied('low_battery'));

    emitBattery(battery({ level: 5 }));
    await vi.waitFor(() => expect(policy.battery()).toEqual(battery({ level: 5 })));
    expect(listener).toHaveBeenCalledTimes(2);

    emitBattery(battery({ level: 90 }));
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(3));
    expect(listener).toHaveBeenLastCalledWith(allowed);
  });

  it('stops notifying after unsubscribe', async () => {
    const { policy, emitBattery } = harness();
    const listener = vi.fn();
    const off = policy.onChange(listener);
    await policy.refresh();
    off();
    emitBattery(battery({ level: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('falls back to none/null on Node where the native modules are missing', async () => {
    const policy = createPowerPolicy({ getSettings: () => settings(), modelPresent: () => true });
    expect(policy.battery()).toBeNull();
    expect(await policy.tier()).toBe('none');
    expect(await policy.refresh()).toEqual(denied('tier'));
  });
});
