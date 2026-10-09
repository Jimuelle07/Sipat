import { describe, expect, it, vi } from 'vitest';
import type { AiDecision, ModelManager } from '../types';
import { createMemoryStore } from '../services/store';
import { createEngine, type EngineDeps } from './engine';

function fakeModel(): ModelManager {
  return {
    state: () => 'absent', tier: async () => 'none', warm: async () => ({ ok: false, error: { code: 'no_model', message: 'missing' } }),
    generate: async () => ({ ok: false, error: { code: 'no_model', message: 'missing' } }),
    stop: async () => undefined, unload: async () => undefined, onStateChange: () => () => undefined,
  };
}

function deniedPower(decision: AiDecision = { allowed: false, reason: 'low_battery' }): NonNullable<EngineDeps['power']> {
  return { aiAllowed: vi.fn(async () => decision), onChange: () => () => undefined };
}

async function ready(deps: EngineDeps = {}) {
  const engine = createEngine(deps);
  const result = await engine.init();
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return engine;
}

describe('createEngine', () => {
  it('persists the selected language and rejects invalid language values', async () => {
    const store = createMemoryStore();
    const first = await ready({ store, model: fakeModel(), power: deniedPower() });
    expect(first.settings.get().language).toBe('tl');
    expect(first.settings.update({ language: 'en' }).ok).toBe(true);
    const second = await ready({ store, model: fakeModel(), power: deniedPower() });
    expect(second.settings.get().language).toBe('en');
    expect(second.settings.update({ language: 'xx' as never })).toMatchObject({ ok: false, error: { code: 'out_of_range' } });
    expect(second.copy('closing', 'en')).not.toBe(second.copy('closing'));
  });

  it('loads bundled content and returns its details', async () => {
    const engine = await ready({ store: createMemoryStore(), model: fakeModel(), power: deniedPower() });
    expect(engine.info().passagesCount).toBeGreaterThan(0);
    expect(engine.info().sourcesCount).toBeGreaterThan(0);
  });

  it('persists a created household across engine instances sharing a store', async () => {
    const store = createMemoryStore();
    const first = await ready({ store, model: fakeModel(), power: deniedPower() });
    const result = first.profiles.create({ name: 'Bahay namin', owner: { name: 'May pangalan', relation: 'self', ageGroup: 'adult', needs: [] } });
    expect(result.ok).toBe(true);
    const second = await ready({ store, model: fakeModel(), power: deniedPower() });
    expect(second.profiles.active()?.name).toBe('Bahay namin');
    expect(second.family.members()[0]?.name).toBe('May pangalan');
  });

  it('re-derives member tags on add and remove, and clears warnings after the storm', async () => {
    const engine = await ready({ store: createMemoryStore(), model: fakeModel(), power: deniedPower() });
    engine.profiles.create({ name: 'Bahay', owner: { name: 'May', relation: 'self', ageGroup: 'adult', needs: [] } });
    const added = engine.family.saveMember({ name: 'Lola', relation: 'parent', ageGroup: 'senior', needs: ['maintenance_meds'] });
    expect(added.ok).toBe(true);
    expect(engine.profiles.active()?.members).toEqual(['senior', 'maintenance_meds']);
    if (added.ok) engine.family.removeMember(added.value.id);
    expect(engine.profiles.active()?.members).toEqual([]);
    engine.context.setWarning({ kind: 'tcws', level: 1 });
    expect(Object.keys(engine.context.setPhase('after').warnings)).toEqual([]);
  });

  it('persists checklist ticks by household', async () => {
    const store = createMemoryStore();
    const engine = await ready({ store, model: fakeModel(), power: deniedPower() });
    engine.profiles.create({ name: 'Bahay', owner: { name: 'May', relation: 'self', ageGroup: 'adult', needs: [] } });
    const item = engine.checklist.view().groups[0]?.items[0];
    expect(item).toBeDefined();
    const tick = engine.checklist.tick(item!.id, true);
    expect(tick.ok).toBe(true);
    const reloaded = await ready({ store, model: fakeModel(), power: deniedPower() });
    expect(reloaded.checklist.view().groups.flatMap((group) => group.items).find((entry) => entry.id === item!.id)?.ticked).toBe(true);
  });

  it('ends refusal and summary responses with closing, and skips AI at low battery', async () => {
    const engine = await ready({ store: createMemoryStore(), model: fakeModel(), power: deniedPower() });
    engine.profiles.create({ name: 'Bahay', owner: { name: 'May', relation: 'self', ageGroup: 'adult', needs: [] } });
    const collect = async (question: string) => { const events = []; for await (const event of engine.ask.run(question)) events.push(event); return events; };
    const refusal = await collect('Magkano ang presyo ng bigas?');
    expect(refusal.map((event) => event.type).slice(-2)).toEqual(['closing', 'done']);
    const summary = await collect('Ano ang ilalagay sa go bag?');
    expect(summary.map((event) => event.type)).toContain('summary');
    expect(summary).toContainEqual(expect.objectContaining({ type: 'ai_status', status: 'skipped', reason: 'low_battery' }));
    expect(summary.map((event) => event.type).slice(-2)).toEqual(['closing', 'done']);
  });

  it('keeps personal member names out of household SMS previews', async () => {
    const engine = await ready({ store: createMemoryStore(), model: fakeModel(), power: deniedPower() });
    engine.profiles.create({ name: 'Bahay namin', owner: { name: 'Private Member Name', relation: 'self', ageGroup: 'adult', needs: [] } });
    const preview = engine.plan.textPreview('safe', {});
    expect(preview).toContain('Bahay namin');
    expect(preview).not.toContain('Private Member Name');
    expect(engine.exports.householdSms('safe')).toBe(preview);
  });
});

