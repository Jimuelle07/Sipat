import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEngine } from './engine.ts';
import { createMemoryStore } from './testing.ts';
import { DEMO_BARANGAY_PSGC } from './demoSeed.ts';

afterEach(() => { vi.unstubAllEnvs(); });

describe('demo seed', () => {
  it('stays off unless EXPO_PUBLIC_DEMO_SEED is 1', async () => {
    const engine = createEngine({ store: createMemoryStore() });
    expect((await engine.init()).ok).toBe(true);
    expect(engine.profiles.active()).toBeNull();
    expect(engine.feed.get().status).toBe('off');
  });

  it('seeds a household, a fresh demo feed and ranked centers on first launch', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_SEED', '1');
    const engine = createEngine({ store: createMemoryStore() });
    expect((await engine.init()).ok).toBe(true);

    expect(engine.family.members()).toHaveLength(5);
    expect(engine.family.location.get()?.psgc).toBe(DEMO_BARANGAY_PSGC);
    expect(engine.feed.get().status).toBe('fresh');
    const view = engine.evacuation.view();
    expect(view.storm?.signalHere).toBe(2);
    expect(view.centers.map((ranked) => ranked.distanceKm)).toEqual([...view.centers.map((ranked) => ranked.distanceKm)].sort((a, b) => a - b));
    expect(view.centers.length).toBeGreaterThan(0);
    expect(engine.checklist.view().progress.done).toBeGreaterThan(0);
    expect(engine.info().online).toBe(false);

    const refreshed = await engine.feed.refresh();
    expect(refreshed.ok).toBe(true);
    expect(engine.updates.networkLog()).toEqual([]);
  });

  it('seeds only an empty store, so demo edits survive a restart', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_SEED', '1');
    const store = createMemoryStore();
    const first = createEngine({ store });
    await first.init();
    const profile = first.profiles.active()!;
    expect(first.profiles.save({ ...profile, name: 'Binago' }).ok).toBe(true);

    const restarted = createEngine({ store });
    await restarted.init();
    expect(restarted.profiles.active()?.name).toBe('Binago');
  });
});
