import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeedCache, PowerPolicy, Result, UpdateClient } from '../types/index.ts';
import type { LocationReadError } from '../services/location.ts';
import type { ContentFileName } from '../types/content.ts';
import { createEngine } from './engine.ts';
import { createMemoryStore } from './testing.ts';
import {
  FIXTURE_CHECKLIST, FIXTURE_HOTLINES, FIXTURE_INTENTS, FIXTURE_PASSAGES, FIXTURE_PHASE_RULES,
  FIXTURE_PLACES, FIXTURE_SOURCES, FIXTURE_WARNINGS,
} from './fixtures/content.ts';
import { FIXTURE_BULLETIN, FIXTURE_CENTERS } from './fixtures/feed.ts';

// The pinned host comes from expo-constants on a phone; tests flip it per case.
const host = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../services/updateConfig.ts', () => ({ updateHost: () => host.value }));
afterEach(() => { host.value = null; });

const NOW = new Date('2026-10-10T08:00:00+08:00');
const envelope = <T>(items: T[]) => ({
  schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', items,
});
const content: Partial<Record<ContentFileName, unknown>> = {
  'guide.tl.json': envelope(FIXTURE_PASSAGES),
  'checklist.json': envelope(FIXTURE_CHECKLIST),
  'warnings.json': envelope(FIXTURE_WARNINGS),
  'synonyms.json': envelope([]),
  'intents.json': { schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', rules: FIXTURE_INTENTS },
  'sources.json': envelope(FIXTURE_SOURCES),
  'hotlines.json': envelope(FIXTURE_HOTLINES.map((hotline) => ({ ...hotline, number: '000' }))),
  'phase_rules.json': { schema_version: 1, content_version: 1, generated_at: '2026-10-10T08:00:00+08:00', rules: FIXTURE_PHASE_RULES },
  'places.json': FIXTURE_PLACES,
  'evacuation_centers.json': envelope(FIXTURE_CENTERS),
};
const power: PowerPolicy = {
  tier: async () => 'none',
  aiAllowed: async () => ({ allowed: false, reason: 'no_model' }),
  onChange: () => () => undefined,
} as unknown as PowerPolicy;
const feedCache: FeedCache = {
  sequence: 1, issuedAt: '2026-10-10T07:00:00+08:00', serverStale: false,
  bulletins: [{ ...FIXTURE_BULLETIN, issuedAt: '2026-10-10T07:00:00+08:00', fetchedAt: '2026-10-10T07:30:00+08:00' }],
  fetchedAt: '2026-10-10T07:30:00+08:00', checkedAt: '2026-10-10T07:30:00+08:00',
};
const disabled = { ok: false as const, error: { code: 'disabled' as const, message: 'disabled' } };
function fakeUpdates(fetchFeed: UpdateClient['fetchFeed']): UpdateClient & { centersCalls: string[] } {
  const centersCalls: string[] = [];
  return {
    centersCalls,
    fetchFeed,
    fetchCenters: async (province) => { centersCalls.push(province); return { ok: true, value: 'unchanged' }; },
    check: async () => disabled,
    download: async () => disabled,
  };
}
const engineWith = (overrides: Parameters<typeof createEngine>[0] = {}) =>
  createEngine({ store: createMemoryStore(), now: () => NOW, content, power, ...overrides });
const owner = { name: 'Ana', relation: 'self' as const, ageGroup: 'adult' as const, needs: [] };

describe('real engine, MVP stretch wiring', () => {
  it('is offline with no host: online false, feed refresh and update calls disabled', async () => {
    const engine = engineWith();
    expect((await engine.init()).ok).toBe(true);
    expect(engine.info().online).toBe(false);
    expect(await engine.feed.refresh()).toMatchObject({ ok: false, error: { code: 'disabled' } });
    expect(await engine.updates.check()).toMatchObject({ ok: false, error: { code: 'disabled' } });
  });

  it('init on a build with a host starts one feed fetch and does not await it', async () => {
    host.value = 'https://cdn.test';
    let calls = 0;
    // The lib target is pre-ES2024 (no Promise.withResolvers): a never-settling fetch.
    const updates = fakeUpdates(() => { calls += 1; return new Promise<never>(() => undefined); });
    const engine = engineWith({ updates });
    expect((await engine.init()).ok).toBe(true);
    expect(engine.info().online).toBe(true);
    expect(calls).toBe(1);
  });

  it('init on a build without a host makes no request', async () => {
    let calls = 0;
    const updates = fakeUpdates(async () => { calls += 1; return { ok: true, value: 'unchanged' }; });
    const engine = engineWith({ updates });
    expect((await engine.init()).ok).toBe(true);
    expect(engine.info().online).toBe(false);
    expect(calls).toBe(0);
  });

  it('pull to refresh caches the feed, emits feed and asks for centers with only the province code', async () => {
    const updates = fakeUpdates(async () => ({ ok: true, value: feedCache }));
    const engine = engineWith({ updates });
    await engine.init();
    engine.profiles.create({ name: 'Bahay', owner });
    expect(engine.family.location.setArea('SAMPLE-BRGY-1').ok).toBe(true);
    const changes: string[] = [];
    engine.onChange((change) => changes.push(change));
    const result = await engine.feed.refresh();
    expect(result.ok).toBe(true);
    expect(engine.feed.get().latest?.bulletin.id).toBe(FIXTURE_BULLETIN.id);
    expect(changes).toContain('feed');
    expect(updates.centersCalls).toEqual(['SAMPLE-PROVINCE-1']);
  });

  it('evacuation view ranks reviewed centers nearest first once a location is set', async () => {
    const engine = engineWith();
    await engine.init();
    engine.profiles.create({ name: 'Bahay', owner });
    expect(engine.evacuation.view()).toMatchObject({ centers: [], needsLocation: true });
    engine.family.location.setArea('SAMPLE-BRGY-1');
    const view = engine.evacuation.view();
    expect(view.needsLocation).toBe(false);
    expect(view.centers.map((ranked) => ranked.center.id)).toEqual(['center-sample-1', 'center-sample-2', 'center-sample-3']);
    expect(view.centersFirst).toBe(false); // the fixture threshold is a placeholder
  });

  it('useGps stores the nearest barangay and maps reading errors', async () => {
    let reading: Result<{ lat: number; lon: number; accuracyM: number; at: string }, LocationReadError> = {
      ok: true, value: { lat: 14.021, lon: 122.021, accuracyM: 30, at: '2026-10-10T08:00:00+08:00' },
    };
    const engine = engineWith({ location: { readOnce: async () => reading } });
    await engine.init();
    engine.profiles.create({ name: 'Bahay', owner });
    const located = await engine.family.location.useGps();
    expect(located).toMatchObject({ ok: true, value: { psgc: 'SAMPLE-BRGY-2', coords: { accuracyM: 30 } } });
    reading = { ok: false, error: { code: 'permission_denied', message: 'denied' } };
    expect(await engine.family.location.useGps()).toMatchObject({ ok: false, error: { code: 'permission_denied' } });
    expect(engine.family.location.get()?.psgc).toBe('SAMPLE-BRGY-2');
  });

  it('evaluation summary is the bundled Node report', async () => {
    const engine = engineWith();
    await engine.init();
    expect(engine.evaluation.summary()?.phase.casesTotal).toBeGreaterThan(0);
  });
});
