import { describe, expect, it } from 'vitest';
import type { AnswerEvent, EngineChange, MockEngine, MockScenario } from '../types';
import { createMockEngine } from './index';
import { COPY } from './copy';
import { fixtureHouseholds } from './fixtures/households';

const SCENARIOS: MockScenario[] = [
  'guide_full', 'guide_critical', 'emergency_then_guide', 'refusal', 'live_data', 'medical_dose',
  'plan_center', 'plan_empty', 'ai_rejected', 'low_battery', 'no_model',
];

async function collect(engine: MockEngine, question: string): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const ev of engine.ask.run(question)) events.push(ev);
  return events;
}

async function ready(scenario: MockScenario | null = null): Promise<MockEngine> {
  const engine = createMockEngine({ speed: 'fast' });
  const res = await engine.init();
  if (!res.ok) throw new Error(res.error.message);
  engine.debug.setScenario(scenario);
  return engine;
}

function assertEventOrder(events: AnswerEvent[]): void {
  expect(events.length).toBeGreaterThan(0);
  const types = events.map((e) => e.type);
  expect(types[types.length - 1]).toBe('done');

  if (types.includes('emergency_card')) expect(types[0]).toBe('emergency_card');

  const primary = ['fixed_reply', 'plan_answer', 'refusal', 'summary'];
  expect(types.filter((t) => primary.includes(t)).length).toBe(1);

  const firstAi = types.findIndex((t) => t.startsWith('ai_'));
  if (firstAi >= 0) {
    const summaryAt = types.indexOf('summary');
    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(summaryAt).toBeLessThan(firstAi);
  }

  const terminals = events.filter(
    (e) => e.type === 'ai_final' || e.type === 'ai_rejected' || (e.type === 'ai_status' && e.status === 'skipped'),
  );
  expect(terminals.length).toBeLessThanOrEqual(1);

  const last = events[events.length - 1]!;
  if (last.type === 'done' && last.outcome !== 'cancelled') {
    expect(types[types.length - 2]).toBe('closing');
  }
}

describe('createMockEngine', () => {
  it('keeps the selected language in settings and rejects invalid values', async () => {
    const engine = await ready();
    expect(engine.settings.get().language).toBe('tl');
    expect(engine.settings.update({ language: 'en' }).ok).toBe(true);
    expect(engine.settings.get().language).toBe('en');
    expect(engine.settings.update({ language: 'xx' as never })).toMatchObject({ ok: false, error: { code: 'out_of_range' } });
    expect(engine.copy('closing', 'en')).not.toBe(engine.copy('closing'));
  });

  it('init returns content counts', async () => {
    const engine = createMockEngine({ speed: 'fast' });
    const res = await engine.init();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.passagesCount).toBeGreaterThan(0);
      expect(res.value.sourcesCount).toBeGreaterThan(0);
      expect(res.value.guideDate).toBe('2026-10-09');
    }
  });

  it.each(SCENARIOS)('scenario %s obeys the section 6 order rules', async (scenario) => {
    const engine = await ready(scenario);
    const events = await collect(engine, 'Ano ang dapat gawin ngayon?');
    assertEventOrder(events);
  });

  it('picks live_data by keyword', async () => {
    const engine = await ready(null);
    const events = await collect(engine, 'Nasaan na ang bagyo?');
    const reply = events.find((e) => e.type === 'fixed_reply');
    expect(reply?.type).toBe('fixed_reply');
    if (reply?.type === 'fixed_reply') expect(reply.copyKey).toBe('no_live_data');
  });

  it('gives the emergency card first for lumulubog', async () => {
    const engine = await ready(null);
    const events = await collect(engine, 'lumulubog na ang bahay namin');
    expect(events[0]?.type).toBe('emergency_card');
    if (events[0]?.type === 'emergency_card') {
      expect(events[0].card.hotlines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('cancel ends the stream with done(cancelled) and no closing', async () => {
    const engine = await ready(null);
    const events: AnswerEvent[] = [];
    for await (const ev of engine.ask.run('Ano ang laman ng go bag?')) {
      events.push(ev);
      if (events.length === 1) engine.ask.cancel();
    }
    const last = events[events.length - 1]!;
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.outcome).toBe('cancelled');
    expect(events.some((e) => e.type === 'closing')).toBe(false);
  });

  it('setPhase(after) clears warnings and fires context', async () => {
    const engine = await ready(null);
    const changes: EngineChange[] = [];
    engine.onChange((c) => changes.push(c));
    engine.context.setWarning({ kind: 'tcws', level: 3 });
    engine.context.setPhase('after');
    expect(engine.context.get().warnings).toEqual({});
    expect(changes).toContain('context');
  });

  it('validates members', async () => {
    const engine = await ready(null);
    const long = engine.family.saveMember({
      name: 'x'.repeat(41), relation: 'child', ageGroup: 'adult', needs: [],
    });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.map((e) => e.code)).toContain('too_long');

    const self = engine.family.saveMember({
      name: 'Ikalawa', relation: 'self', ageGroup: 'adult', needs: [],
    });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.errors.map((e) => e.code)).toContain('owner_relation');
  });

  it('cannot remove the main person', async () => {
    const engine = await ready(null);
    const ownerId = engine.profiles.active()!.ownerId;
    const res = engine.family.removeMember(ownerId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('owner_required');
  });

  it('household A checklist shows the infant supplies item', async () => {
    const engine = await ready(null);
    const ids = engine.checklist.view().groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('gobag-infant-supplies');
  });

  it('history never contains a member name', async () => {
    const engine = await ready(null);
    await collect(engine, 'Ano ang laman ng go bag?');
    await collect(engine, 'Magkano ang bigas?');
    const names = fixtureHouseholds().flatMap((p) => p.people.map((m) => m.name));
    const blob = JSON.stringify(engine.history.list());
    for (const name of names) expect(blob).not.toContain(name);
  });

  it("copy('closing') is the closing line", async () => {
    const engine = await ready(null);
    expect(engine.copy('closing')).toBe('Sundin ang utos ng barangay at ng mga awtoridad.');
    expect(engine.copy('closing')).toBe(COPY.closing);
  });

  it('debug.setStatus fires status', async () => {
    const engine = await ready(null);
    const changes: EngineChange[] = [];
    engine.onChange((c) => changes.push(c));
    engine.debug.setStatus({ battery: { level: 10, charging: false, saver: false } });
    expect(engine.status().battery?.level).toBe(10);
    expect(changes).toContain('status');
  });
});
