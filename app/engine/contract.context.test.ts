import { afterEach, describe, expect, it } from 'vitest';
import type { AnswerEvent, Engine, EngineChange } from '../types/index.ts';
import { PHASE_GROUPS } from '../core/checklist.ts';
import { ENGINES, type EngineUnderTest } from './contractHarness.ts';

// Contract tests for context, checklist, settings and status, written from
// docs/api-layer.md sections 3.2, 3.5, 3.6, 3.7, 4 (phase types) and 5
// (decidePhase, buildChecklist). The same cases run against the mock and the real
// engine through the shared harness, using only Engine and ContractControls.

async function collect(engine: Engine, question: string): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of engine.ask.run(question)) events.push(event);
  return events;
}

describe.each(ENGINES)('$name', (factory) => {
  let current: EngineUnderTest | null = null;

  afterEach(() => {
    current?.ctl.dispose();
    current = null;
  });

  async function create(): Promise<EngineUnderTest> {
    current = await factory.create();
    return current;
  }

  describe('phase switching from warnings', () => {
    it('setWarning in before switches to during with phaseSource warning and a lastSwitch', async () => {
      const { engine } = await create();
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));
      expect(engine.context.get().phase).toBe('before');

      const ctx = engine.context.setWarning({ kind: 'tcws', level: 2 });

      expect(ctx.phase).toBe('during');
      expect(ctx.phaseSource).toBe('warning');
      expect(ctx.lastSwitch?.from).toBe('before');
      expect(ctx.lastSwitch?.to).toBe('during');
      expect(ctx.warnings.tcws?.level).toBe(2);
      expect(changes).toContain('phase');
      expect(changes).toContain('context');
    });

    it('undoPhase suppresses the warning so re-init and the next ask do not switch again; a different warning does', async () => {
      const { engine, ctl } = await create();
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      expect(engine.context.get().phase).toBe('during');

      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      if (undone.ok) {
        expect(undone.value.phase).toBe('before');
        expect(undone.value.warnings.tcws?.level).toBe(2);
      }
      expect(engine.context.get().phase).toBe('before');
      expect(engine.context.get().suppressed).toContain('warning:tcws-2');

      // init() re-runs the phase decision on the stored inputs
      const reinit = await engine.init();
      expect(reinit.ok).toBe(true);
      expect(engine.context.get().phase).toBe('before');

      // the next question also runs decidePhase
      const question = ctl.scenario('guide_full');
      await collect(engine, question);
      expect(engine.context.get().phase).toBe('before');

      // the same warning (same kind and level) stays suppressed
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      expect(engine.context.get().phase).toBe('before');

      // another level is a new input and switches again
      engine.context.setWarning({ kind: 'tcws', level: 3 });
      expect(engine.context.get().phase).toBe('during');
    });

    it('setPhase before while a warning is active suppresses it; clearing and setting it again is new', async () => {
      const { engine } = await create();
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

    it('clearWarning removes the warning, drops its suppression and re-runs the phase decision', async () => {
      const { engine } = await create();
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      engine.context.undoPhase();
      expect(engine.context.get().phase).toBe('before');

      const cleared = engine.context.clearWarning('tcws');
      expect(cleared.warnings.tcws).toBeUndefined();
      expect(cleared.phase).toBe('before');

      // the same warning is now a fresh input
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      expect(engine.context.get().phase).toBe('during');
    });

    it('setPhase after clears the warnings and undoPhase restores them', async () => {
      const { engine } = await create();
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      engine.context.setWarning({ kind: 'gale' });
      expect(Object.keys(engine.context.get().warnings).length).toBeGreaterThan(0);
      expect(engine.context.get().phase).toBe('during');

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

    it('onChange fires phase on every phase change and context on warning changes', async () => {
      const { engine } = await create();
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));

      engine.context.setWarning({ kind: 'tcws', level: 2 });
      expect(changes).toContain('phase');
      expect(changes).toContain('context');

      changes.length = 0;
      engine.context.reconfirmWarning('tcws');
      expect(changes).toContain('context');
      expect(changes).not.toContain('phase');

      changes.length = 0;
      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      expect(changes).toContain('phase');

      changes.length = 0;
      engine.context.clearWarning('tcws');
      expect(changes).toContain('context');
    });
  });

  describe('ask phase cues', () => {
    it('a strong storm-is-here cue switches to during with phase_change(switched) and can be undone', async () => {
      const { engine, ctl } = await create();
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));
      expect(engine.context.get().phase).toBe('before');

      const question = ctl.scenario('phase_cue_during');
      const events = await collect(engine, question);

      const change = events.find((event) => event.type === 'phase_change');
      expect(change).toBeDefined();
      if (change?.type === 'phase_change') {
        expect(change.kind).toBe('switched');
        expect(change.from).toBe('before');
        expect(change.to).toBe('during');
        expect(change.source).toBe('ask');
      }
      expect(engine.context.get().phase).toBe('during');
      expect(changes).toContain('phase');

      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      expect(engine.context.get().phase).toBe('before');
    });

    it('a weak cue with no accepted hint does not switch the phase', async () => {
      // The harness has no control for a weak cue paired with a matching phase_hint
      // or for an unbacked hint; this covers the negative direction only.
      const { engine, ctl } = await create();
      ctl.scenario('guide_full');
      await collect(engine, 'weak during cue paano maghanda?');
      expect(engine.context.get().phase).toBe('before');
      expect(engine.context.get().recommended?.phase ?? 'before').not.toBe('during');
    });

    it('a humupa-na cue only recommends after and never switches the phase', async () => {
      const { engine, ctl } = await create();
      expect(engine.context.get().phase).toBe('before');

      const question = ctl.scenario('phase_cue_after');
      const events = await collect(engine, question);

      const change = events.find((event) => event.type === 'phase_change');
      expect(change).toBeDefined();
      if (change?.type === 'phase_change') {
        expect(change.kind).toBe('recommended');
        expect(change.to).toBe('after');
      }
      expect(engine.context.get().phase).toBe('before');
      expect(engine.context.get().recommended?.phase).toBe('after');
    });

    it('when inputs disagree the more cautious phase wins', async () => {
      const { engine, ctl } = await create();
      engine.context.setWarning({ kind: 'tcws', level: 2 });
      expect(engine.context.get().phase).toBe('during');

      const question = ctl.scenario('phase_cue_after');
      await collect(engine, question);
      expect(engine.context.get().phase).toBe('during');
    });
  });

  describe('feed-driven phase decisions', () => {
    it('with placeholder bands a bulletin never switches the phase on distance', async () => {
      const { engine, ctl } = await create();
      expect(engine.context.get().phase).toBe('before');
      await ctl.setFeed('fresh');
      expect(engine.context.get().phase).toBe('before');
    });

    it('a signal raised for the household area switches to during', async () => {
      const { engine, ctl } = await create();
      await ctl.setFeed('signal_here');
      expect(engine.context.get().phase).toBe('during');
      expect(engine.context.get().lastSwitch?.source).toBe('bulletin');

      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      expect(engine.context.get().phase).toBe('before');
    });

    it('a bagyo inside near switches to during; the same bulletin after an undo does not', async () => {
      const { engine, ctl } = await create();
      await ctl.setFeed('near');
      expect(engine.context.get().phase).toBe('during');
      expect(engine.context.get().lastSwitch?.source).toBe('bulletin');

      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      expect(engine.context.get().phase).toBe('before');

      await ctl.setFeed('near');
      expect(engine.context.get().phase).toBe('before');
    });

    it('a track entering approach switches after to before; the same after an undo does not', async () => {
      const { engine, ctl } = await create();
      engine.context.setPhase('after');
      await ctl.setFeed('track_approach');
      expect(engine.context.get().phase).toBe('before');

      const undone = engine.context.undoPhase();
      expect(undone.ok).toBe(true);
      expect(engine.context.get().phase).toBe('after');

      await ctl.setFeed('track_approach');
      expect(engine.context.get().phase).toBe('after');
    });

    it('a final bulletin only recommends after and never switches to it', async () => {
      const { engine, ctl } = await create();
      await ctl.setFeed('left');
      expect(engine.context.get().phase).not.toBe('after');
      expect(engine.context.get().recommended?.phase).toBe('after');
    });

    it.each(['off', 'empty', 'stale'] as const)('%s feeds never switch the phase', async (feed) => {
      const { engine, ctl } = await create();
      expect(engine.context.get().phase).toBe('before');
      await ctl.setFeed(feed);
      expect(engine.context.get().phase).toBe('before');
    });
  });

  describe('warning cards', () => {
    it('cards report hoursSinceSet and stale from the clock and staleWarningHours; reconfirmWarning resets both', async () => {
      const { engine, ctl } = await create();
      engine.context.setWarning({ kind: 'tcws', level: 2 });

      const fresh = engine.context.cards().find((card) => card.kind === 'tcws');
      expect(fresh).toBeDefined();
      expect(fresh?.hoursSinceSet).toBe(0);
      expect(fresh?.stale).toBe(false);
      expect(typeof fresh?.setAt).toBe('string');

      const staleWarningHours = engine.settings.get().staleWarningHours;
      ctl.advance(staleWarningHours * 3_600_000);

      const aged = engine.context.cards().find((card) => card.kind === 'tcws');
      expect(aged?.hoursSinceSet).toBe(staleWarningHours);
      expect(aged?.stale).toBe(true);

      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));
      const returned = engine.context.reconfirmWarning('tcws');
      expect(returned.warnings.tcws?.level).toBe(2);

      const reset = engine.context.cards().find((card) => card.kind === 'tcws');
      expect(reset?.hoursSinceSet).toBe(0);
      expect(reset?.stale).toBe(false);
      expect(changes).toContain('context');
      expect(changes).not.toContain('phase');
    });
  });

  describe('checklist order', () => {
    it('barangay_order puts evacuate right after now and fills now from evacuate items first; clearing restores', async () => {
      const { engine } = await create();
      engine.context.setWarning({ kind: 'barangay_order' });
      // Keep the warning active but hold the phase manual, so the ordering shows on its own.
      engine.context.setPhase('before');

      const active = engine.checklist.view();
      expect(active.phase).toBe('before');
      expect(active.groups[0]?.id).toBe('now');
      expect(active.groups[1]?.id).toBe('evacuate');
      const nowActive = active.groups.find((group) => group.id === 'now');
      expect(nowActive?.items[0]?.id.startsWith('evacuate-')).toBe(true);

      engine.context.clearWarning('barangay_order');
      expect(engine.context.get().warnings.barangay_order).toBeUndefined();

      const restored = engine.checklist.view();
      expect(restored.phase).toBe('before');
      expect(restored.groups.slice(0, PHASE_GROUPS.before.length).map((group) => group.id)).toEqual(PHASE_GROUPS.before);
      expect(restored.groups[1]?.id).toBe('go_bag');
    });
  });

  describe('settings and status', () => {
    it('lowBatteryMode makes status().ai low_battery whatever the battery', async () => {
      const { engine, ctl } = await create();
      ctl.setBattery({ level: 100, charging: true, saver: false });

      const updated = engine.settings.update({ lowBatteryMode: true });
      expect(updated.ok).toBe(true);
      expect(engine.status().ai).toEqual({ allowed: false, reason: 'low_battery' });
    });
  });

  describe('Result shapes', () => {
    it('undoPhase returns nothing_to_undo with the documented error shape', async () => {
      const { engine } = await create();

      const res = engine.context.undoPhase();

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('nothing_to_undo');
        expect(typeof res.error.message).toBe('string');
        expect(res).not.toHaveProperty('value');
      }
    });

    it('a successful Result carries { ok: true, value }', async () => {
      const { engine } = await create();

      const res = engine.checklist.tick('now-listen-radio', true);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.progress.total).toBeGreaterThan(0);
        expect(res).not.toHaveProperty('error');
      }
    });

    it('a failing Result carries { ok: false, error }', async () => {
      const { engine } = await create();

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
});
