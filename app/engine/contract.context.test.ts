import { describe, expect, it } from 'vitest';
import type { EngineChange, MockEngine } from '../types/index.ts';
import { PHASE_GROUPS } from '../core/checklist.ts';
import { createMockEngine } from './mock.ts';

// Red contract tests for context, checklist, settings and status, written from
// docs/api-layer.md sections 3.2, 3.6, 3.7, 4 (phase types) and 5 (buildChecklist).
// The version-2 mock is being written in parallel; these fail until it lands.

async function ready(): Promise<MockEngine> {
  const engine = createMockEngine({ speed: 'fast' });
  const res = await engine.init();
  if (!res.ok) throw new Error(res.error.message);
  return engine;
}

describe('mock context: phase switching', () => {
  it('setWarning in before switches to during with phaseSource warning and fires phase', async () => {
    const engine = await ready();
    const changes: EngineChange[] = [];
    engine.onChange((c) => changes.push(c));

    const ctx = engine.context.setWarning({ kind: 'tcws', level: 2 });

    expect(ctx.phase).toBe('during');
    expect(ctx.phaseSource).toBe('warning');
    expect(ctx.lastSwitch).toBeDefined();
    expect(ctx.lastSwitch?.from).toBe('before');
    expect(ctx.lastSwitch?.to).toBe('during');
    expect(ctx.warnings.tcws?.level).toBe(2);
    expect(changes).toContain('phase');
  });

  it('undoPhase reverts and suppresses that warning; a different warning switches again', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 2 });
    expect(engine.context.get().phase).toBe('during');

    const undone = engine.context.undoPhase();
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.value.phase).toBe('before');
      expect(undone.value.warnings.tcws?.level).toBe(2);
    }

    // The same warning (same kind and level) must not switch the phase again.
    engine.context.setWarning({ kind: 'tcws', level: 2 });
    expect(engine.context.get().phase).toBe('before');

    // Another level is a new input and switches again.
    engine.context.setWarning({ kind: 'tcws', level: 3 });
    expect(engine.context.get().phase).toBe('during');
  });

  it('setPhase before while a warning is active suppresses it; clearing and setting again is new', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 3 });
    expect(engine.context.get().phase).toBe('during');

    engine.context.setPhase('before');
    expect(engine.context.get().phase).toBe('before');
    expect(engine.context.get().warnings.tcws?.level).toBe(3);

    engine.context.setWarning({ kind: 'tcws', level: 3 });
    expect(engine.context.get().phase).toBe('before');

    engine.context.clearWarning('tcws');
    engine.context.setWarning({ kind: 'tcws', level: 3 });
    expect(engine.context.get().phase).toBe('during');
  });

  it('setPhase after clears warnings and undoPhase restores them', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 2 });
    engine.context.setWarning({ kind: 'gale' });
    expect(Object.keys(engine.context.get().warnings).length).toBeGreaterThan(0);

    engine.context.setPhase('after');
    expect(engine.context.get().phase).toBe('after');
    expect(engine.context.get().warnings).toEqual({});

    const undone = engine.context.undoPhase();
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.value.phase).toBe('during');
      expect(undone.value.warnings.tcws?.level).toBe(2);
      expect(undone.value.warnings.gale).toBeDefined();
    }
  });

  it('never switches to after automatically', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 2 });
    expect(engine.context.get().phase).toBe('during');

    engine.debug.setFeed('left');
    await engine.feed.refresh();
    expect(engine.context.get().phase).not.toBe('after');
  });
});

describe('mock context: warning cards', () => {
  it('cards() reports a fresh warning as not stale; reconfirmWarning keeps it and is not a new input', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 2 });

    const card = engine.context.cards().find((c) => c.kind === 'tcws');
    expect(card).toBeDefined();
    expect(card?.hoursSinceSet).toBe(0);
    expect(card?.stale).toBe(false);
    expect(typeof card?.setAt).toBe('string');

    const switchAt = engine.context.get().lastSwitch?.at;
    const returned = engine.context.reconfirmWarning('tcws');
    expect(returned.warnings.tcws?.level).toBe(2);
    expect(engine.context.get().lastSwitch?.at).toBe(switchAt);

    const after = engine.context.cards().find((c) => c.kind === 'tcws');
    expect(after?.hoursSinceSet).toBe(0);
    expect(after?.stale).toBe(false);
  });
});

describe('mock checklist ordering', () => {
  it('barangay_order leads now with evacuate items; clearing restores', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'barangay_order' });

    const active = engine.checklist.view();
    expect(active.phase).toBe('during');
    expect(active.groups[0]?.id).toBe('now');
    expect(active.groups[1]?.id).toBe('evacuate');
    const nowActive = active.groups.find((g) => g.id === 'now');
    expect(nowActive?.items[0]?.id.startsWith('evacuate-')).toBe(true);

    engine.context.clearWarning('barangay_order');
    expect(engine.context.get().warnings.barangay_order).toBeUndefined();
    const restored = engine.checklist.view();
    const nowRestored = restored.groups.find((g) => g.id === 'now');
    expect(restored.groups.map((group) => group.id).slice(0, PHASE_GROUPS.during.length)).toEqual(PHASE_GROUPS.during);
    expect(nowRestored?.items[0]?.id.startsWith('evacuate-')).toBe(true);
  });
});

describe('mock debug.setFeed phase effects', () => {
  it('near switches to during immediately', async () => {
    const engine = await ready();
    engine.context.setPhase('before');
    engine.debug.setFeed('near');
    expect(engine.context.get().phase).toBe('during');
    expect(engine.feed.get().status).toBe('fresh');
  });

  it('signal_here switches to during', async () => {
    const engine = await ready();
    engine.context.setPhase('before');
    engine.debug.setFeed('signal_here');
    expect(engine.context.get().phase).toBe('during');
  });

  it('track_approach switches after to before', async () => {
    const engine = await ready();
    engine.context.setPhase('after');
    engine.debug.setFeed('track_approach');
    expect(engine.context.get().phase).toBe('before');
  });

  it.each(['stale', 'off', 'empty'] as const)('%s never switches the phase', async (feed) => {
    const engine = await ready();
    engine.context.setPhase('before');
    engine.debug.setFeed(feed);
    expect(engine.context.get().phase).toBe('before');
  });

  it('feed errors fail the next refresh and preserve the cached feed', async () => {
    const engine = await ready();
    const cached = engine.feed.get();
    engine.debug.setFeed('offline');

    expect(engine.feed.get()).toEqual(cached);
    const failed = await engine.feed.refresh();
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('offline');
    expect(engine.feed.get()).toEqual(cached);
    expect((await engine.feed.refresh()).ok).toBe(true);
  });
});

describe('mock settings and status', () => {
  it('debug.setStatus fires onChange(status)', async () => {
    const engine = await ready();
    const changes: EngineChange[] = [];
    engine.onChange((c) => changes.push(c));

    engine.debug.setStatus({ battery: { level: 10, charging: false, saver: false } });

    expect(engine.status().battery?.level).toBe(10);
    expect(changes).toContain('status');
  });

  it('lowBatteryMode forces status().ai to low_battery whatever the battery', async () => {
    const engine = await ready();
    engine.debug.setStatus({ battery: { level: 100, charging: true, saver: false } });

    const res = engine.settings.update({ lowBatteryMode: true });
    expect(res.ok).toBe(true);
    expect(engine.status().ai).toEqual({ allowed: false, reason: 'low_battery' });
  });

  it('debug.reset restores the fixtures', async () => {
    const engine = await ready();
    engine.context.setWarning({ kind: 'tcws', level: 3 });
    engine.settings.update({ lowBatteryMode: true });

    engine.debug.reset();

    expect(engine.context.get().phase).toBe('before');
    expect(engine.context.get().warnings).toEqual({});
    expect(engine.settings.get().lowBatteryMode).toBe(false);
  });
});

describe('mock contract: Result shapes', () => {
  it('undoPhase returns nothing_to_undo with the documented error shape', async () => {
    const engine = await ready();

    const res = engine.context.undoPhase();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('nothing_to_undo');
      expect(typeof res.error.message).toBe('string');
      expect(res).not.toHaveProperty('value');
    }
  });

  it('a successful Result carries { ok: true, value }', async () => {
    const engine = await ready();

    const res = engine.checklist.tick('now-listen-radio', true);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.progress.total).toBeGreaterThan(0);
      expect(res).not.toHaveProperty('error');
    }
  });

  it('a failing Result carries { ok: false, error }', async () => {
    const engine = await ready();

    const unknown = engine.checklist.tick('hindi-totoong-item', true);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.code).toBe('unknown_item');
      expect(unknown).not.toHaveProperty('value');
    }

    const outOfRange = engine.settings.update({ lowBatteryThreshold: 100 });
    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) expect(outOfRange.error.code).toBe('out_of_range');
  });
});
