import { describe, expect, it } from 'vitest';
import type { AnswerEvent, EngineChange, MockEngine, MockScenario } from '../types/index.ts';
import { createMockEngine } from './mock.ts';

type OutcomeName =
  | 'answered_ai' | 'answered_summary' | 'refused' | 'fixed_reply' | 'bulletin_card' | 'plan_answer';

interface ScenarioSpec {
  scenario: MockScenario;
  question: string;
  tokens: string[];
  outcome: OutcomeName | null;
}

const GUIDE_FULL_TOKENS = [
  'summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'closing', 'done',
];

const SCENARIO_SPECS: ScenarioSpec[] = [
  { scenario: 'guide_full', question: 'Ano ang dapat gawin ngayon?', tokens: GUIDE_FULL_TOKENS, outcome: 'answered_ai' },
  { scenario: 'guide_critical', question: 'Kailan kami lumikas?', tokens: GUIDE_FULL_TOKENS, outcome: 'answered_ai' },
  {
    scenario: 'emergency_then_guide', question: 'Lumulubog ang bahay namin',
    tokens: ['emergency_card', ...GUIDE_FULL_TOKENS], outcome: 'answered_ai',
  },
  { scenario: 'refusal', question: 'Saan makakakuha ng bigas?', tokens: ['refusal', 'closing', 'done'], outcome: 'refused' },
  { scenario: 'live_data', question: 'Pasok ba ang tubig sa bahay?', tokens: ['fixed_reply', 'closing', 'done'], outcome: 'fixed_reply' },
  { scenario: 'live_data_bulletin', question: 'Nasaan na ang bagyo?', tokens: ['bulletin_card', 'closing', 'done'], outcome: 'bulletin_card' },
  { scenario: 'medical_dose', question: 'Ilang dosis ng gamot?', tokens: ['fixed_reply', 'closing', 'done'], outcome: 'fixed_reply' },
  { scenario: 'plan_center', question: 'Saan ang evacuation center?', tokens: ['plan_answer', 'closing', 'done'], outcome: 'plan_answer' },
  { scenario: 'plan_empty', question: 'Saan tayo magkikita?', tokens: ['plan_answer', 'closing', 'done'], outcome: 'plan_answer' },
  {
    scenario: 'ai_rejected', question: 'Ilang litro ng tubig?',
    tokens: ['summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_rejected', 'closing', 'done'],
    outcome: 'answered_summary',
  },
  {
    scenario: 'low_battery', question: 'Mababa ang baterya ko',
    tokens: ['summary', 'ai_status:skipped:low_battery', 'closing', 'done'], outcome: 'answered_summary',
  },
  {
    scenario: 'no_model', question: 'Wala pang model sa phone',
    tokens: ['summary', 'ai_status:skipped:no_model', 'closing', 'done'], outcome: 'answered_summary',
  },
  {
    scenario: 'phase_cue_during', question: 'Na dito na ang bagyo',
    tokens: ['summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'phase_change:switched', 'closing', 'done'],
    outcome: null,
  },
  {
    scenario: 'phase_cue_after', question: 'Humupa na ang bagyo',
    tokens: ['summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'phase_change:recommended', 'closing', 'done'],
    outcome: null,
  },
];

async function ready(scenario: MockScenario | null = null): Promise<MockEngine> {
  const engine = createMockEngine({ speed: 'fast' });
  const res = await engine.init();
  if (!res.ok) throw new Error(res.error.message);
  engine.debug.setScenario(scenario);
  return engine;
}

async function collect(engine: MockEngine, question: string): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const ev of engine.ask.run(question)) events.push(ev);
  return events;
}

function describeEvent(ev: AnswerEvent): string {
  switch (ev.type) {
    case 'ai_status': {
      const reason = ev.reason === undefined ? '' : `:${ev.reason}`;
      return `ai_status:${ev.status}${reason}`;
    }
    case 'phase_change':
      return `phase_change:${ev.kind}`;
    default:
      return ev.type;
  }
}

function shape(events: AnswerEvent[]): string[] {
  const out: string[] = [];
  for (const ev of events) {
    const token = describeEvent(ev);
    if (token === 'ai_partial' && out[out.length - 1] === 'ai_partial') continue;
    out.push(token);
  }
  return out;
}

function assertOrderRules(events: AnswerEvent[]): void {
  expect(events.length).toBeGreaterThan(0);
  const types = events.map((e) => e.type);

  expect(types.filter((t) => t === 'done').length).toBe(1);
  expect(types[types.length - 1]).toBe('done');
  const last = events[events.length - 1]!;
  if (last.type !== 'done') throw new Error('the last event is not done');

  const emergencyAt = types.indexOf('emergency_card');
  if (emergencyAt !== -1) expect(emergencyAt).toBe(0);

  const mainTypes = ['fixed_reply', 'bulletin_card', 'plan_answer', 'refusal', 'summary'];
  const mainCount = types.filter((t) => mainTypes.includes(t)).length;
  const mainAt = types.findIndex((t) => mainTypes.includes(t));

  const firstAi = types.findIndex((t) => t.startsWith('ai_'));
  const summaryAt = types.indexOf('summary');
  if (firstAi !== -1) {
    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(summaryAt).toBeLessThan(firstAi);
  }

  const terminals = events.filter(
    (e) => e.type === 'ai_final' || e.type === 'ai_rejected' || (e.type === 'ai_status' && e.status === 'skipped'),
  );
  expect(terminals.length).toBeLessThanOrEqual(1);

  const phaseAt = types.indexOf('phase_change');
  expect(types.filter((t) => t === 'phase_change').length).toBeLessThanOrEqual(1);
  const closingAt = types.indexOf('closing');

  if (last.outcome === 'cancelled') {
    expect(closingAt).toBe(-1);
    expect(phaseAt).toBe(-1);
    return;
  }

  expect(mainCount).toBe(1);
  expect(closingAt).toBe(events.length - 2);
  if (phaseAt !== -1) {
    expect(phaseAt).toBeGreaterThan(mainAt);
    if (firstAi !== -1) expect(phaseAt).toBeGreaterThan(firstAi);
    if (closingAt !== -1) expect(phaseAt).toBeLessThan(closingAt);
  }
}

describe('contract: the Ask stream on the mock engine', () => {
  for (const spec of SCENARIO_SPECS) {
    it(`${spec.scenario}: a forced scenario matches the section 3.6 sequence`, async () => {
      const engine = await ready(spec.scenario);
      const events = await collect(engine, 'Ano ang dapat gawin ngayon?');
      assertOrderRules(events);
      expect(shape(events)).toEqual(spec.tokens);
      if (spec.outcome !== null) {
        const last = events[events.length - 1]!;
        if (last.type === 'done') expect(last.outcome).toBe(spec.outcome);
      }
    });

    it(`${spec.scenario}: the keyword picks the scenario and matches the sequence`, async () => {
      const engine = await ready(null);
      const events = await collect(engine, spec.question);
      assertOrderRules(events);
      expect(shape(events)).toEqual(spec.tokens);
      if (spec.outcome !== null) {
        const last = events[events.length - 1]!;
        if (last.type === 'done') expect(last.outcome).toBe(spec.outcome);
      }
    });
  }

  it('every scenario stream obeys the section 6 order rules', async () => {
    for (const spec of SCENARIO_SPECS) {
      const engine = await ready(spec.scenario);
      assertOrderRules(await collect(engine, 'Ano ang dapat gawin ngayon?'));
    }
  });

  it('guide_critical pins its summary above the AI part', async () => {
    const engine = await ready(null);
    const events = await collect(engine, 'Kailan kami lumikas?');
    const summary = events.find((e) => e.type === 'summary');
    expect(summary).toBeDefined();
    if (summary?.type === 'summary') expect(summary.pinned).toBe(true);
    const firstAi = events.findIndex((e) => e.type.startsWith('ai_'));
    const summaryAt = events.findIndex((e) => e.type === 'summary');
    expect(summaryAt).toBeLessThan(firstAi);
  });

  it('phase_cue_during switches to during and fires onChange phase', async () => {
    const engine = await ready(null);
    const changes: EngineChange[] = [];
    engine.onChange((c) => changes.push(c));
    expect(engine.context.get().phase).toBe('before');

    const events = await collect(engine, 'Na dito na ang bagyo');
    assertOrderRules(events);

    const phase = events.find((e) => e.type === 'phase_change');
    expect(phase).toBeDefined();
    if (phase?.type === 'phase_change') {
      expect(phase.kind).toBe('switched');
      expect(phase.from).toBe('before');
      expect(phase.to).toBe('during');
      expect(phase.source).toBe('ask');
    }
    expect(engine.context.get().phase).toBe('during');
    expect(changes).toContain('phase');
  });

  it('phase_cue_after only recommends and never switches the phase', async () => {
    const engine = await ready(null);
    const before = engine.context.get().phase;
    const events = await collect(engine, 'Humupa na ang bagyo');
    assertOrderRules(events);

    const phase = events.find((e) => e.type === 'phase_change');
    expect(phase).toBeDefined();
    if (phase?.type === 'phase_change') {
      expect(phase.kind).toBe('recommended');
      expect(phase.to).toBe('after');
    }
    expect(engine.context.get().phase).toBe(before);
    expect(engine.context.get().phase).not.toBe('after');
  });

  it('guide answers select a phase-matching fixture passage and prefer title/topic matches', async () => {
    const engine = await ready(null);
    const signals = await collect(engine, 'Ano ang ibig sabihin ng babala sa hangin?');
    expect(signals.find((event) => event.type === 'summary')).toMatchObject({ passageId: 'during-signals-01' });

    const before = await collect(engine, 'Ano ang laman ng go bag?');
    expect(before.find((event) => event.type === 'summary')).toMatchObject({ passageId: 'before-gobag-01' });

    engine.context.setPhase('after');
    const after = await collect(engine, 'Ano ang dapat gawin pagkatapos?');
    expect(after.find((event) => event.type === 'summary')).toMatchObject({ passageId: 'after-cleanup-01' });
  });

  it.each([
    ['Sino ang tatawagan?', 'contacts'],
    ['Ano ang hotline?', 'hotlines'],
  ] as const)('mock-only plan route returns the %s field', async (question, field) => {
    const engine = await ready(null);
    const events = await collect(engine, question);
    expect(events.find((event) => event.type === 'plan_answer')).toMatchObject({ type: 'plan_answer', field });
  });

  it('cancel mid-stream ends with done(cancelled) and no phase_change', async () => {
    const engine = await ready('phase_cue_during');
    const events: AnswerEvent[] = [];
    for await (const ev of engine.ask.run('Ano ang dapat gawin ngayon?')) {
      events.push(ev);
      if (events.length === 1) engine.ask.cancel();
    }
    assertOrderRules(events);
    const last = events[events.length - 1]!;
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.outcome).toBe('cancelled');
    expect(events.some((e) => e.type === 'phase_change')).toBe(false);
    expect(events.some((e) => e.type === 'closing')).toBe(false);
  });

  it('lowBatteryMode turns AI off and skips it in the next answer', async () => {
    const engine = await ready(null);
    expect(engine.status().ai).toEqual({ allowed: true });

    const res = engine.settings.update({ lowBatteryMode: true });
    expect(res.ok).toBe(true);
    expect(engine.status().ai).toEqual({ allowed: false, reason: 'low_battery' });

    const events = await collect(engine, 'Ano ang dapat gawin ngayon?');
    assertOrderRules(events);
    expect(events).toContainEqual({ type: 'ai_status', status: 'skipped', reason: 'low_battery' });
    const last = events[events.length - 1]!;
    if (last.type === 'done') expect(last.outcome).toBe('answered_summary');
  });

  it('debug.setScenario(null) returns to picking by keyword', async () => {
    const engine = await ready('refusal');
    const forced = await collect(engine, 'Ano ang dapat gawin ngayon?');
    expect(shape(forced)[0]).toBe('refusal');

    engine.debug.setScenario(null);
    const byKeyword = await collect(engine, 'Saan makakakuha ng bigas?');
    expect(shape(byKeyword)[0]).toBe('refusal');

    const fallback = await collect(engine, 'Ano ang dapat gawin ngayon?');
    expect(shape(fallback)[0]).toBe('summary');
  });

  it('no member name, note, photo path or location appears in Ask events or questionLog', async () => {
    const engine = await ready(null);
    const members = engine.family.members();
    const secrets = [
      ...members.map((m) => m.name),
      ...members.flatMap((m) => (m.note === undefined ? [] : [m.note])),
      ...members.flatMap((m) => (m.photo === undefined ? [] : [m.photo.uri])),
      ...(engine.profiles.active()?.location ? [engine.profiles.active()!.location!.psgc] : []),
    ].filter((s) => s.length >= 3);
    expect(secrets.length).toBeGreaterThan(0);

    for (const spec of SCENARIO_SPECS) {
      const events = await collect(engine, spec.question);
      const blob = JSON.stringify(events);
      for (const secret of secrets) expect(blob).not.toContain(secret);
    }

    const privateQuestion = secrets.join(' ');
    const privateEvents = JSON.stringify(await collect(engine, privateQuestion));
    for (const secret of secrets) expect(privateEvents).not.toContain(secret);
    const log = JSON.stringify(engine.history.list());
    for (const secret of secrets) expect(log).not.toContain(secret);
  });
});
