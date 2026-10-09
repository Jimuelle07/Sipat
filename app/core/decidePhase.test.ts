import { describe, expect, it } from 'vitest';
import type {
  Bulletin,
  Context,
  Phase,
  PhaseCue,
  PhaseDecision,
  PhaseInputs,
  PhaseRules,
  StormFix,
  StormMeasure,
} from '../types/index.ts';
import { decidePhase } from './decidePhase.ts';

const NOW = '2026-10-10T08:00:00+08:00';

// Test-only band offsets are derived from this fixture distance; no official band value appears here.
const NOW_KM = 100;

function fix(distanceKm: number): StormFix {
  return { at: NOW, distanceKm, bearingDeg: 0, direction: 'N' };
}

function pos(): { lat: number; lon: number; at: string } {
  return { lat: 0, lon: 0, at: NOW };
}

function bulletin(overrides: Partial<Bulletin> = {}): Bulletin {
  return {
    id: 'bulletin-1',
    stormId: 'storm-1',
    source: { agency: 'PAGASA', title: 'SAMPLE – hindi totoong bulletin', url: 'https://example.invalid/b1' },
    issuedAt: NOW,
    scrapedAt: NOW,
    fetchedAt: NOW,
    storm: { name: 'Bagyong SAMPLE', category: 'TS' },
    position: { ...pos(), text: 'SAMPLE' },
    forecast: [],
    signalAreas: [],
    final: false,
    text: 'SAMPLE – hindi totoong bulletin',
    ...overrides,
  };
}

function measure(overrides: Partial<StormMeasure> = {}): StormMeasure {
  return {
    bulletinId: 'bulletin-1',
    from: 'area',
    now: fix(NOW_KM),
    forecast: [],
    closestKm: NOW_KM,
    signalHere: null,
    ...overrides,
  };
}

function context(overrides: Partial<Context> = {}): Context {
  return {
    phase: 'before',
    phaseSource: 'manual',
    reason: { source: 'manual', text: '' },
    changedAt: NOW,
    recommended: null,
    suppressed: [],
    warnings: {},
    ...overrides,
  };
}

function placeholderRules(): PhaseRules {
  return {
    warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
    bands: {
      near: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
      approach: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
    },
    evacuation_threshold: {
      category_min: null, tcws_min: null,
      placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null,
    },
  };
}

function bandRules(nearKm: number, approachKm: number): PhaseRules {
  const base = placeholderRules();
  return {
    ...base,
    bands: {
      near: {
        max_km: nearKm, placeholder: false,
        source_id: 'test-source', reviewed_by: 'test-reviewer', reviewed_at: '2026-01-01',
      },
      approach: {
        max_km: approachKm, placeholder: false,
        source_id: 'test-source', reviewed_by: 'test-reviewer', reviewed_at: '2026-01-01',
      },
    },
  };
}

function cue(phase: Phase, strong: boolean): PhaseCue {
  return { phase, strong, matched: ['test'] };
}

function decide(o: Partial<PhaseInputs> & Pick<PhaseInputs, 'context'>): PhaseDecision {
  return decidePhase({
    context: o.context,
    ask: o.ask,
    storm: o.storm,
    rules: o.rules ?? placeholderRules(),
    now: o.now ?? NOW,
  });
}

describe('decidePhase: collecting candidates', () => {
  it('returns no candidates and no change when there are no inputs', () => {
    const r = decide({ context: context() });
    expect(r.candidates).toEqual([]);
    expect(r.hint).toBe('none');
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('before');
    expect(r.state.phaseSource).toBe('manual');
    expect(r.state.changedAt).toBe(NOW);
    expect(r.state.recommended).toBeNull();
  });

  it('turns an active warning into a warning candidate that switches to during', () => {
    const r = decide({ context: context({ warnings: { tcws: { level: 3, setAt: NOW } } }) });
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({
      key: 'warning:tcws-3', phase: 'during', source: 'warning', effect: 'switch',
    });
    expect(r.switched).toEqual({
      from: 'before', to: 'during', source: 'warning', input: 'warning:tcws-3', at: NOW,
    });
    expect(r.state.phase).toBe('during');
    expect(r.state.phaseSource).toBe('warning');
    expect(r.state.changedAt).toBe(NOW);
    expect(r.state.reason.source).toBe('warning');
    expect(r.state.lastSwitch).toEqual(r.switched);
    expect(r.state.undo).toMatchObject({ phase: 'before', phaseSource: 'manual', cause: 'warning:tcws-3' });
    expect(r.state.undo?.warnings).toEqual({ tcws: { level: 3, setAt: NOW } });
  });

  it('derives the warning key from the kind and level', () => {
    const r = decide({
      context: context({ warnings: { rainfall: { level: 'orange', setAt: NOW }, gale: { setAt: NOW } } }),
    });
    expect(r.candidates.map((c) => c.key).sort()).toEqual(['warning:gale', 'warning:rainfall-orange']);
    expect(r.candidates.every((c) => c.phase === 'during' && c.source === 'warning' && c.effect === 'switch')).toBe(true);
  });

  it('ignores a suppressed input', () => {
    const r = decide({
      context: context({ warnings: { tcws: { level: 3, setAt: NOW } }, suppressed: ['warning:tcws-3'] }),
    });
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('before');
  });

  it('a different warning of the same kind still switches', () => {
    const r = decide({
      context: context({ warnings: { tcws: { level: 4, setAt: NOW } }, suppressed: ['warning:tcws-3'] }),
    });
    expect(r.candidates.map((c) => c.key)).toEqual(['warning:tcws-4']);
    expect(r.switched?.to).toBe('during');
    expect(r.switched?.source).toBe('warning');
  });
});

describe('decidePhase: phase cues', () => {
  it('a strong during cue switches the phase', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: cue('during', true), hint: null } });
    expect(r.candidates[0]).toMatchObject({ key: 'ask:q1', phase: 'during', source: 'ask', effect: 'switch' });
    expect(r.switched).toMatchObject({ from: 'before', to: 'during', source: 'ask', input: 'ask:q1' });
  });

  it('a strong before cue recommends but never switches', () => {
    const r = decide({ context: context({ phase: 'during' }), ask: { questionId: 'q1', cue: cue('before', true), hint: null } });
    expect(r.candidates[0]).toMatchObject({ key: 'ask:q1', phase: 'before', source: 'ask', effect: 'recommend' });
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('during');
    expect(r.state.recommended?.phase).toBe('before');
  });

  it('a strong after cue only recommends after', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: cue('after', true), hint: null } });
    expect(r.candidates[0]).toMatchObject({ key: 'ask:q1', phase: 'after', effect: 'recommend' });
    expect(r.switched).toBeNull();
    expect(r.state.recommended?.phase).toBe('after');
  });

  it('a weak cue with no hint is ignored', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: cue('during', false), hint: null } });
    expect(r.candidates).toEqual([]);
    expect(r.hint).toBe('none');
    expect(r.switched).toBeNull();
  });

  it('a weak during cue switches when a matching hint backs it', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: cue('during', false), hint: 'during' } });
    expect(r.candidates[0]).toMatchObject({ key: 'ask:q1', phase: 'during', effect: 'switch' });
    expect(r.hint).toBe('accepted');
    expect(r.switched?.to).toBe('during');
  });

  it('a weak before cue recommends when a matching hint backs it', () => {
    const r = decide({ context: context({ phase: 'during' }), ask: { questionId: 'q1', cue: cue('before', false), hint: 'before' } });
    expect(r.candidates[0]).toMatchObject({ key: 'ask:q1', phase: 'before', effect: 'recommend' });
    expect(r.hint).toBe('accepted');
  });
});

describe('decidePhase: the phase_hint', () => {
  it('is accepted when an active warning backs it, and adds no candidate of its own', () => {
    const r = decide({ context: context({ warnings: { tcws: { level: 3, setAt: NOW } } }), ask: { questionId: 'q1', cue: null, hint: 'during' } });
    expect(r.hint).toBe('accepted');
    expect(r.candidates.map((c) => c.key)).toEqual(['warning:tcws-3']);
  });

  it('is accepted when a final bulletin backs after', () => {
    const b = bulletin({ final: true });
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: null, hint: 'after' }, storm: { bulletin: b, measure: measure() } });
    expect(r.hint).toBe('accepted');
    expect(r.state.recommended?.phase).toBe('after');
  });

  it('is accepted when a bulletin signal area backs during', () => {
    const b = bulletin();
    const r = decide({
      context: context(),
      ask: { questionId: 'q1', cue: null, hint: 'during' },
      storm: { bulletin: b, measure: measure({ signalHere: 2 }) },
    });
    expect(r.hint).toBe('accepted');
    expect(r.switched?.to).toBe('during');
  });

  it('is accepted when a track candidate backs before', () => {
    const b = bulletin({ forecast: [pos()] });
    const r = decide({
      context: context({ phase: 'after' }),
      ask: { questionId: 'q1', cue: null, hint: 'before' },
      storm: { bulletin: b, measure: measure({ forecast: [fix(NOW_KM - 20)], closestKm: NOW_KM - 20 }) },
      rules: bandRules(NOW_KM - 1, NOW_KM),
    });
    expect(r.hint).toBe('accepted');
  });

  it('is dropped when nothing backs it', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: null, hint: 'during' } });
    expect(r.hint).toBe('dropped');
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
  });

  it('is dropped when the cue names a different phase', () => {
    const r = decide({ context: context(), ask: { questionId: 'q1', cue: cue('before', true), hint: 'during' } });
    expect(r.hint).toBe('dropped');
    expect(r.candidates.map((c) => c.phase)).toEqual(['before']);
  });
});

describe('decidePhase: pick the most cautious', () => {
  it('during wins over before', () => {
    const r = decide({
      context: context({ warnings: { gale: { setAt: NOW } } }),
      ask: { questionId: 'q1', cue: cue('before', true), hint: null },
    });
    expect(r.state.phase).toBe('during');
    expect(r.switched?.to).toBe('during');
    expect(r.state.recommended?.phase).toBe('during');
  });

  it('before wins over after', () => {
    const b = bulletin({ final: true });
    const r = decide({
      context: context(),
      ask: { questionId: 'q1', cue: cue('before', true), hint: null },
      storm: { bulletin: b, measure: measure() },
    });
    expect(r.state.recommended?.phase).toBe('before');
    expect(r.switched).toBeNull();
  });

  it('ties go to the source order: warning over bulletin', () => {
    const b = bulletin();
    const r = decide({
      context: context({ warnings: { tcws: { level: 2, setAt: NOW } } }),
      storm: { bulletin: b, measure: measure({ signalHere: 3 }) },
    });
    expect(r.state.phase).toBe('during');
    expect(r.switched?.source).toBe('warning');
    expect(r.switched?.input).toBe('warning:tcws-2');
    expect(r.state.recommended?.reason.source).toBe('warning');
  });

  it('resolves a same-source tie deterministically', () => {
    const run = () => decide({ context: context({ warnings: { tcws: { level: 2, setAt: NOW }, gale: { setAt: NOW } } }) });
    const first = run();
    const second = run();
    expect(first.candidates).toHaveLength(2);
    expect(first.switched).toEqual(second.switched);
    expect(first.candidates.map((c) => c.key)).toContain(first.switched?.input);
  });
});

describe('decidePhase: switches only toward caution', () => {
  it('switches from after to during on a warning', () => {
    const r = decide({ context: context({ phase: 'after', warnings: { tcws: { level: 1, setAt: NOW } } }) });
    expect(r.switched).toMatchObject({ from: 'after', to: 'during', source: 'warning' });
    expect(r.state.phase).toBe('during');
  });

  it('never switches to after: a final bulletin only recommends it', () => {
    const b = bulletin({ final: true });
    const r = decide({ context: context({ phase: 'during' }), storm: { bulletin: b, measure: measure() } });
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('during');
    expect(r.state.recommended?.phase).toBe('after');
  });

  it('does not de-escalate from during to before', () => {
    const r = decide({ context: context({ phase: 'during' }), ask: { questionId: 'q1', cue: cue('before', true), hint: null } });
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('during');
  });

  it('the track rule switches after to before', () => {
    const b = bulletin({ forecast: [pos()] });
    const r = decide({
      context: context({ phase: 'after' }),
      storm: { bulletin: b, measure: measure({ forecast: [fix(NOW_KM - 20)], closestKm: NOW_KM - 20 }) },
      rules: bandRules(NOW_KM - 1, NOW_KM),
    });
    expect(r.candidates.some((c) => c.key === 'storm:storm-1' && c.phase === 'before' && c.effect === 'switch')).toBe(true);
    expect(r.switched).toMatchObject({ from: 'after', to: 'before', source: 'bulletin', input: 'storm:storm-1' });
  });

  it('the same track after an undo does not switch (suppressed storm key)', () => {
    const b = bulletin({ forecast: [pos()] });
    const r = decide({
      context: context({ phase: 'after', suppressed: ['storm:storm-1'] }),
      storm: { bulletin: b, measure: measure({ forecast: [fix(NOW_KM - 20)], closestKm: NOW_KM - 20 }) },
      rules: bandRules(NOW_KM - 1, NOW_KM),
    });
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('after');
    expect(r.state.suppressed).toEqual(['storm:storm-1']);
  });

  it('the track rule does not fire outside after', () => {
    const b = bulletin({ forecast: [pos()] });
    const r = decide({
      context: context({ phase: 'before' }),
      storm: { bulletin: b, measure: measure({ forecast: [fix(NOW_KM - 20)], closestKm: NOW_KM - 20 }) },
      rules: bandRules(NOW_KM - 1, NOW_KM),
    });
    expect(r.switched).toBeNull();
    expect(r.state.phase).toBe('before');
  });
});

describe('decidePhase: recommendation', () => {
  it('recommends after from a final bulletin', () => {
    const b = bulletin({ final: true });
    const r = decide({ context: context(), storm: { bulletin: b, measure: measure() } });
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ key: 'bulletin:bulletin-1', phase: 'after', source: 'bulletin', effect: 'recommend' });
    expect(r.switched).toBeNull();
    expect(r.state.recommended?.phase).toBe('after');
    expect(r.state.recommended?.reason.source).toBe('bulletin');
  });

  it('does not recommend after while a during candidate remains', () => {
    const b = bulletin({ final: true });
    const r = decide({ context: context({ warnings: { gale: { setAt: NOW } } }), storm: { bulletin: b, measure: measure() } });
    expect(r.state.recommended?.phase).toBe('during');
    expect(r.state.phase).toBe('during');
  });

  it('recommends the most cautious candidate of any effect', () => {
    const b = bulletin({ final: true });
    const r = decide({
      context: context(),
      ask: { questionId: 'q1', cue: cue('before', true), hint: null },
      storm: { bulletin: b, measure: measure() },
    });
    expect(r.state.recommended?.phase).toBe('before');
  });
});

describe('decidePhase: distance bands', () => {
  it('placeholder bands ignore distance entirely', () => {
    const b = bulletin({ forecast: [pos()] });
    const r = decide({
      context: context(),
      storm: { bulletin: b, measure: measure({ now: fix(1), forecast: [fix(1)], closestKm: 1 }) },
    });
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
  });

  it('a signal area for the household still switches during with placeholder bands', () => {
    const b = bulletin();
    const r = decide({ context: context(), storm: { bulletin: b, measure: measure({ signalHere: 3 }) } });
    expect(r.candidates).toEqual([
      expect.objectContaining({ key: 'bulletin:bulletin-1', phase: 'during', source: 'bulletin', effect: 'switch' }),
    ]);
    expect(r.switched?.to).toBe('during');
  });

  it('a bagyo inside the near band switches during', () => {
    const b = bulletin();
    const r = decide({
      context: context(),
      storm: { bulletin: b, measure: measure({ now: fix(NOW_KM), forecast: [], closestKm: NOW_KM }) },
      rules: bandRules(NOW_KM + 1, NOW_KM + 2),
    });
    expect(r.candidates.some((c) => c.key === 'bulletin:bulletin-1' && c.phase === 'during')).toBe(true);
    expect(r.switched?.to).toBe('during');
  });

  it('does nothing when the bagyo is outside both bands', () => {
    const b = bulletin();
    const r = decide({
      context: context({ phase: 'after' }),
      storm: { bulletin: b, measure: measure({ now: fix(NOW_KM), forecast: [fix(NOW_KM)], closestKm: NOW_KM }) },
      rules: bandRules(NOW_KM - 2, NOW_KM - 1),
    });
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
  });
});

describe('decidePhase: prune suppression', () => {
  it('drops a warning key once the warning is gone', () => {
    const r = decide({ context: context({ suppressed: ['warning:tcws-3'] }) });
    expect(r.state.suppressed).toEqual([]);
  });

  it('always drops ask keys', () => {
    const r = decide({ context: context({ suppressed: ['ask:q0'] }) });
    expect(r.state.suppressed).toEqual([]);
  });

  it('drops bulletin and storm keys that are no longer cached', () => {
    const r = decide({ context: context({ suppressed: ['bulletin:bulletin-1', 'storm:storm-1'] }) });
    expect(r.state.suppressed).toEqual([]);
  });

  it('keeps suppression for inputs that are still present', () => {
    const b = bulletin();
    const r = decide({
      context: context({
        warnings: { tcws: { level: 3, setAt: NOW } },
        suppressed: ['warning:tcws-3', 'bulletin:bulletin-1', 'storm:storm-1', 'ask:q0'],
      }),
      storm: { bulletin: b, measure: measure() },
    });
    expect(r.state.suppressed.slice().sort()).toEqual(['bulletin:bulletin-1', 'storm:storm-1', 'warning:tcws-3']);
    expect(r.candidates).toEqual([]);
    expect(r.switched).toBeNull();
  });

  it('re-setting a cleared warning switches again because the key was pruned', () => {
    const cleared = decide({ context: context({ suppressed: ['warning:tcws-3'] }) });
    expect(cleared.state.suppressed).toEqual([]);
    const again = decide({
      context: context({ ...cleared.state, warnings: { tcws: { level: 3, setAt: NOW } } }),
    });
    expect(again.switched?.to).toBe('during');
    expect(again.switched?.input).toBe('warning:tcws-3');
  });

  it('a new bulletin id is not suppressed by an old one', () => {
    const b2 = bulletin({ id: 'bulletin-2', stormId: 'storm-2' });
    const r = decide({
      context: context({ phase: 'after', suppressed: ['bulletin:bulletin-1', 'storm:storm-1'] }),
      storm: { bulletin: b2, measure: measure({ bulletinId: 'bulletin-2', signalHere: 2 }) },
    });
    expect(r.state.suppressed).toEqual([]);
    expect(r.switched?.to).toBe('during');
    expect(r.switched?.input).toBe('bulletin:bulletin-2');
  });
});
