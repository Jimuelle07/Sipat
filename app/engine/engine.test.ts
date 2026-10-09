import { describe, expect, it } from 'vitest';
import type { Store, UpdateClient } from '../types/index.ts';
import { createEngine } from './engine.ts';
import { createMemoryStore } from './testing.ts';

const fakeUpdates = {
  fetchFeed: async () => ({ ok: false as const, error: { code: 'disabled' as const, message: 'x' } }),
  fetchCenters: async () => ({ ok: false as const, error: { code: 'disabled' as const, message: 'x' } }),
  check: async () => ({ ok: true as const, value: null }),
  download: async () => ({ ok: false as const, error: { code: 'disabled' as const, message: 'x' } }),
} as unknown as UpdateClient;

describe('Engine v2 facade', () => {
  it('resolves every method on the default engine after init with documented result shapes', async () => {
    const engine = createEngine({ store: createMemoryStore() });
    const initialized = await engine.init();
    expect(initialized.ok).toBe(true);
    expect(engine.info().engineApiVersion).toBe(2);
    expect(engine.info().model.sizeBytes).toBeGreaterThan(0);
    expect(() => engine.status()).not.toThrow();
    expect(engine.copy('closing')).toBe('Sundin ang utos ng barangay at ng mga awtoridad.');
    const unsubscribe = engine.onChange(() => undefined);
    unsubscribe();

    expect(engine.profiles.active()).toBeNull();
    const created = engine.profiles.create({ name: 'Bahay namin', owner: { name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [] } });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const profile = created.value;
    expect(engine.profiles.save({ id: profile.id, name: profile.name, petsCount: 0, home: [], plan: { contacts: [] } }).ok).toBe(true);
    expect(engine.family.members()).toHaveLength(1);
    expect(engine.family.pending()).toHaveLength(1);
    const added = engine.family.saveMember({ name: 'Ben', relation: 'spouse', ageGroup: 'adult', needs: [] });
    expect(added.ok).toBe(true);
    if (added.ok) expect(engine.family.removeMember(added.value.id).ok).toBe(true);
    const member = engine.family.members()[0]!;
    expect(engine.family.removeMember(member.id)).toMatchObject({ ok: false, error: { code: 'owner_required' } });
    expect(engine.family.card(member.id)?.member.id).toBe(member.id);
    expect((await engine.family.photos.start({ memberId: member.id }, 'gallery')).ok).toBe(false);
    engine.family.photos.discard('missing');
    expect((await engine.family.photos.save('missing', { x: 0, y: 0, width: 1, height: 1 })).ok).toBe(false);
    expect(engine.family.photos.remove('missing').ok).toBe(false);
    engine.family.photos.removeAll();
    expect((await engine.family.shareCard(member.id, {})).ok).toBe(false);
    expect(engine.family.location.get()).toBeNull();
    expect(engine.family.location.places().length).toBeGreaterThan(0);
    expect(engine.family.location.setArea('missing').ok).toBe(false);
    expect((await engine.family.location.useGps()).ok).toBe(false);
    expect(engine.context.get().phase).toBe('before');
    expect(engine.context.options()).toBeInstanceOf(Array);
    expect(engine.context.cards()).toBeInstanceOf(Array);
    engine.context.setPhase('during');
    expect(engine.context.undoPhase().ok).toBe(true);
    engine.context.setWarning({ kind: 'tcws', level: 1 });
    engine.context.reconfirmWarning('tcws');
    engine.context.clearWarning('tcws');
    expect(engine.checklist.view()).toHaveProperty('progress');
    expect(engine.checklist.tick('missing', true).ok).toBe(false);
    expect(engine.checklist.reset()).toHaveProperty('groups');
    const events = [];
    for await (const event of engine.ask.run('hello')) events.push(event);
    expect(events[events.length - 1]).toMatchObject({ type: 'done' });
    engine.ask.cancel();
    engine.ask.warm();
    expect(engine.guide.topics()).toBeInstanceOf(Array);
    expect(engine.guide.byTopic('go_bag')).toBeInstanceOf(Array);
    expect(engine.guide.passage('missing')).toBeNull();
    expect(engine.guide.sources()).toBeInstanceOf(Array);
    expect(engine.guide.reviewers()).toBeInstanceOf(Array);
    expect(engine.emergency.card()).toHaveProperty('steps');
    expect(engine.plan.hotlines()).toBeInstanceOf(Array);
    expect((await engine.plan.call('+12345678')).ok).toBe(false);
    expect((await engine.plan.call('hotline-911')).ok).toBe(false);
    expect(engine.feed.get()).toMatchObject({ refreshing: false });
    expect((await engine.feed.refresh()).ok).toBe(false);
    expect(engine.evacuation.view()).toMatchObject({ centers: [], barangayCopyKey: 'barangay_decides' });
    expect(engine.account.state()).toEqual({ signedIn: false });
    expect(await engine.account.signUp({ email: 'a@example.com', password: 'password' })).toMatchObject({ ok: false, error: { code: 'demo_only' } });
    expect(await engine.account.signIn({ email: 'a@example.com', password: 'password' })).toMatchObject({ ok: false, error: { code: 'demo_only' } });
    expect(engine.account.signOut()).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
    expect(await engine.account.sendReset('a@example.com')).toMatchObject({ ok: false, error: { code: 'demo_only' } });
    expect(engine.account.setSync(true)).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
    expect((await engine.model.installFromPicker(() => undefined)).ok).toBe(false);
    await engine.model.remove();
    await engine.screen.sosOn();
    await engine.screen.sosOff();
    expect(engine.damage.list()).toEqual([]);
    expect(engine.damage.save({ damageType: 'flood', severity: 'light', affectedMembers: 1 }).ok).toBe(true);
    expect((await engine.damage.addPhoto('missing', 'gallery')).ok).toBe(false);
    expect(engine.damage.removePhoto('missing', 0).ok).toBe(false);
    expect((await engine.damage.send('missing')).ok).toBe(false);
    engine.damage.remove('missing');
    expect(engine.settings.get()).toHaveProperty('lowBatteryMode');
    expect(engine.settings.update({ lowBatteryMode: true }).ok).toBe(true);
    expect(engine.settings.update({ aiEnabled: 'yes' as never })).toMatchObject({ ok: false, error: { code: 'out_of_range' } });
    expect(engine.history.list()).toBeInstanceOf(Array);
    engine.history.clear();
    expect(engine.evaluation.summary()).not.toBeNull();
    expect(engine.packs.installed()).toBeInstanceOf(Array);
    expect((await engine.packs.importFromPicker()).ok).toBe(false);
    expect((await engine.packs.importFile('missing')).ok).toBe(false);
    expect((await engine.packs.apply('missing')).ok).toBe(false);
    expect((await engine.packs.rollback('missing')).ok).toBe(false);
    expect(engine.updates.pending()).toBeNull();
    expect((await engine.updates.check()).ok).toBe(false);
    expect((await engine.updates.download('missing', () => undefined)).ok).toBe(false);
    expect(engine.updates.networkLog()).toEqual([]);
    expect(engine.profiles.remove(profile.id).ok).toBe(true);
  });
});

describe('Engine v2 robustness', () => {
  it('location.places() with no parent returns provinces and region-level cities (NCR), never regions', async () => {
    const engine = createEngine({ store: createMemoryStore() });
    await engine.init();
    const top = engine.family.location.places();
    expect(top.some((place) => place.level === 'province')).toBe(true);
    expect(top.some((place) => place.level === 'city')).toBe(true);
    expect(top.every((place) => place.level !== 'region' && place.level !== 'barangay')).toBe(true);
  });

  it('a throwing onChange listener breaks neither the mutation nor the other listeners', async () => {
    const engine = createEngine({ store: createMemoryStore() });
    await engine.init();
    const seen: string[] = [];
    engine.onChange(() => { throw new Error('listener boom'); });
    engine.onChange((change) => { seen.push(change); });

    const created = engine.profiles.create({
      name: 'Bahay namin', owner: { name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [] },
    });
    expect(created.ok).toBe(true);
    expect(seen).toContain('profiles');
  });

  it('a malformed cached feed degrades to null without throwing', async () => {
    const store = createMemoryStore({ feed: { bulletins: null } } as never);
    const engine = createEngine({ store, updates: fakeUpdates });
    await engine.init();

    expect(() => engine.feed.get()).not.toThrow();
    expect(engine.feed.get().latest).toBeNull();
    expect(() => engine.evacuation.view()).not.toThrow();
    expect(engine.evacuation.view().bulletin).toBeNull();
    expect(engine.evacuation.view().storm).toBeNull();
  });

  it('init() reports storage_failed when the store cannot write', async () => {
    const base = createMemoryStore();
    const store = {
      get: (key: string) => base.get(key as never),
      set: (key: string, value: unknown) => {
        if (key === 'profiles') throw new Error('store full');
        base.set(key as never, value as never);
      },
      delete: (key: string) => base.delete(key as never),
    } as unknown as Store;
    const engine = createEngine({ store });

    const result = await engine.init();

    expect(result).toMatchObject({ ok: false, error: { code: 'storage_failed' } });
  });

  it('a store write failure inside a mutation never throws and returns the documented io code', async () => {
    const base = createMemoryStore();
    let failWrites = false;
    const store = {
      get: (key: string) => base.get(key as never),
      set: (key: string, value: unknown) => {
        if (failWrites) throw new Error('store full');
        base.set(key as never, value as never);
      },
      delete: (key: string) => base.delete(key as never),
    } as unknown as Store;
    const engine = createEngine({ store });
    await engine.init();
    engine.profiles.create({
      name: 'Bahay namin', owner: { name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [] },
    });

    failWrites = true;

    expect(() => engine.checklist.tick('now-listen-radio', true)).not.toThrow();
    expect(() => engine.settings.update({ lowBatteryMode: true })).not.toThrow();
    expect(engine.damage.save({ damageType: 'flood', severity: 'light', affectedMembers: 1 }))
      .toMatchObject({ ok: false, error: { code: 'io' } });
  });
});
