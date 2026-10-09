import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AnswerEvent,
  Engine,
  EngineChange,
  MockEngine,
  MockScenario,
  Outcome,
} from '../types/index.ts';
import { createMockEngine } from './mock.ts';
import { ENGINES, type ContractControls, type EngineUnderTest } from './contractHarness.ts';

// Contract tests for the Ask stream. The same cases run against both engines through the
// harness (docs/api-layer.md section 3.7); the keyword table and realistic timings are
// mock-only (section 3.6).

const GUIDE_FULL_TOKENS = [
  'summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'closing', 'done',
];

interface ScenarioSpec {
  scenario: MockScenario;
  main: AnswerEvent['type'];
  outcome: Outcome;
}

// Section 3.6: every scenario, the main card it must show and the outcome it must end on.
const SCENARIO_SPECS: ScenarioSpec[] = [
  { scenario: 'guide_full', main: 'summary', outcome: 'answered_ai' },
  { scenario: 'guide_critical', main: 'summary', outcome: 'answered_ai' },
  { scenario: 'emergency_then_guide', main: 'summary', outcome: 'answered_ai' },
  { scenario: 'refusal', main: 'refusal', outcome: 'refused' },
  { scenario: 'live_data', main: 'fixed_reply', outcome: 'fixed_reply' },
  { scenario: 'live_data_bulletin', main: 'bulletin_card', outcome: 'bulletin_card' },
  { scenario: 'medical_dose', main: 'fixed_reply', outcome: 'fixed_reply' },
  { scenario: 'plan_center', main: 'plan_answer', outcome: 'plan_answer' },
  { scenario: 'plan_empty', main: 'plan_answer', outcome: 'plan_answer' },
  { scenario: 'ai_rejected', main: 'summary', outcome: 'answered_summary' },
  { scenario: 'low_battery', main: 'summary', outcome: 'answered_summary' },
  { scenario: 'no_model', main: 'summary', outcome: 'answered_summary' },
  { scenario: 'phase_cue_during', main: 'summary', outcome: 'answered_ai' },
  { scenario: 'phase_cue_after', main: 'summary', outcome: 'answered_ai' },
];

async function collect(engine: Engine, question: string): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of engine.ask.run(question)) events.push(event);
  return events;
}

function describeEvent(event: AnswerEvent): string {
  switch (event.type) {
    case 'ai_status': {
      const reason = event.reason === undefined ? '' : `:${event.reason}`;
      return `ai_status:${event.status}${reason}`;
    }
    case 'phase_change':
      return `phase_change:${event.kind}`;
    default:
      return event.type;
  }
}

function shape(events: AnswerEvent[]): string[] {
  const out: string[] = [];
  for (const event of events) {
    const token = describeEvent(event);
    if (token === 'ai_partial' && out[out.length - 1] === 'ai_partial') continue;
    out.push(token);
  }
  return out;
}

function lastEvent(events: AnswerEvent[]): AnswerEvent {
  const last = events[events.length - 1];
  if (last === undefined) throw new Error('no events');
  return last;
}

/** Section 6 event order rules. Cancellation is a documented exception (rule 8). */
function assertOrderRules(events: AnswerEvent[]): void {
  expect(events.length).toBeGreaterThan(0);
  const types = events.map((event) => event.type);

  expect(types.filter((type) => type === 'done').length).toBe(1);
  expect(types[types.length - 1]).toBe('done');
  const last = lastEvent(events);
  if (last.type !== 'done') throw new Error('the last event is not done');

  const emergencyAt = types.indexOf('emergency_card');
  if (emergencyAt !== -1) expect(emergencyAt).toBe(0);

  const mainTypes: AnswerEvent['type'][] = ['fixed_reply', 'bulletin_card', 'plan_answer', 'refusal', 'summary'];
  const mainCount = types.filter((type) => mainTypes.includes(type)).length;
  const mainAt = types.findIndex((type) => mainTypes.includes(type));

  const firstAi = types.findIndex((type) => type.startsWith('ai_'));
  const summaryAt = types.indexOf('summary');
  if (firstAi !== -1) {
    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(summaryAt).toBeLessThan(firstAi);
  }

  const terminals = events.filter(
    (event) => event.type === 'ai_final' || event.type === 'ai_rejected'
      || (event.type === 'ai_status' && event.status === 'skipped'),
  );
  expect(terminals.length).toBeLessThanOrEqual(1);

  const phaseAt = types.indexOf('phase_change');
  expect(types.filter((type) => type === 'phase_change').length).toBeLessThanOrEqual(1);
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

interface PlaceNode {
  psgc: string;
  name: string;
  parent?: string;
}

/** The location tree from `family.location.places`, each place carrying its parent PSGC. */
function allPlaces(engine: Engine): PlaceNode[] {
  const out: PlaceNode[] = [];
  const seen = new Set<string>();
  const walk = (parent?: string): void => {
    for (const place of engine.family.location.places(parent)) {
      if (seen.has(place.psgc)) continue;
      seen.add(place.psgc);
      out.push({ psgc: place.psgc, name: place.name, ...(parent === undefined ? {} : { parent }) });
      if (place.hasChildren) walk(place.psgc);
    }
  };
  walk();
  return out;
}

/** The first barangay PSGC in the location tree, for the local `setArea` call. */
function firstBarangay(engine: Engine): string | undefined {
  const walk = (parent?: string): string | undefined => {
    for (const place of engine.family.location.places(parent)) {
      if (place.level === 'barangay') return place.psgc;
      if (place.hasChildren) {
        const found = walk(place.psgc);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return walk();
}

/** The name and PSGC of the household location and each of its ancestors. */
function locationSecrets(engine: Engine): string[] {
  const values: string[] = [];
  const location = engine.profiles.active()?.location ?? null;
  if (location === null) return values;
  const byPsgc = new Map(allPlaces(engine).map((place) => [place.psgc, place]));
  let psgc: string | undefined = location.psgc;
  const seen = new Set<string>();
  while (psgc !== undefined && !seen.has(psgc)) {
    seen.add(psgc);
    const place = byPsgc.get(psgc);
    if (place !== undefined) values.push(place.name);
    values.push(psgc);
    psgc = place?.parent;
  }
  return values;
}

/**
 * Every private value AGENTS.md rule 8 and docs 3.7 keep off prompts, logs and requests: household
 * name, member details, photo URIs, plan contacts and plan places, and the location with its
 * ancestors (names, PSGC codes, coordinates). Plan contacts and plan places are shown in answer
 * events by design (product rule 4), so events are checked with `collectEventSecrets`.
 */
function collectSecrets(under: EngineUnderTest): string[] {
  const values: string[] = [];
  const profile = under.engine.profiles.active();
  if (profile !== null) {
    values.push(profile.name);
    if (profile.plan.evacuationCenter !== undefined) values.push(profile.plan.evacuationCenter);
    if (profile.plan.meetingPlace !== undefined) values.push(profile.plan.meetingPlace);
    for (const contact of profile.plan.contacts) values.push(contact.name, contact.phone);
    values.push(...locationSecrets(under.engine));
    if (profile.location?.coords !== undefined) {
      values.push(String(profile.location.coords.lat), String(profile.location.coords.lon));
    }
  }
  for (const member of under.engine.family.members()) {
    values.push(member.name);
    if (member.note !== undefined) values.push(member.note);
    if (member.phone !== undefined) values.push(member.phone);
  }
  values.push(...under.ctl.photoFiles());

  return [...new Set(values.filter((value) => value.length >= 3))];
}

/**
 * Values that must never surface in an answer event: member names, notes, phones, photo URIs and
 * the household's own location. Ancestor PSGC codes and plan places are excluded because a bulletin
 * card legitimately shows signal-area PSGC codes and a plan answer shows the plan (product rule 4).
 */
function collectEventSecrets(under: EngineUnderTest): string[] {
  const values: string[] = [];
  for (const member of under.engine.family.members()) {
    values.push(member.name);
    if (member.note !== undefined) values.push(member.note);
    if (member.phone !== undefined) values.push(member.phone);
  }
  values.push(...under.ctl.photoFiles());
  const location = under.engine.profiles.active()?.location ?? null;
  if (location !== null) {
    values.push(location.psgc);
    const place = allPlaces(under.engine).find((item) => item.psgc === location.psgc);
    if (place !== undefined) values.push(place.name);
    if (location.coords !== undefined) {
      values.push(String(location.coords.lat), String(location.coords.lon));
    }
  }
  return [...new Set(values.filter((value) => value.length >= 3))];
}

interface SkipCase {
  name: string;
  reason: string;
  arrange: (under: EngineUnderTest) => void;
}

// Section 7 PowerPolicy checks, in order: ai_off, no_model, tier, battery_saver, low_battery.
const SKIP_CASES: SkipCase[] = [
  { name: 'AI is switched off', reason: 'ai_off', arrange: (under) => { under.engine.settings.update({ aiEnabled: false }); } },
  { name: 'no model is installed', reason: 'no_model', arrange: (under) => { under.ctl.setModelPresent(false); } },
  { name: 'the device tier is none', reason: 'tier', arrange: (under) => { under.ctl.setTier('none'); } },
  { name: 'the battery saver is on', reason: 'battery_saver', arrange: (under) => { under.ctl.setBattery({ level: 80, charging: false, saver: true }); } },
  { name: 'the battery is below the threshold', reason: 'low_battery', arrange: (under) => { under.ctl.setBattery({ level: 5, charging: false, saver: false }); } },
  { name: 'the manual low-battery switch is on', reason: 'low_battery', arrange: (under) => { under.engine.settings.update({ lowBatteryMode: true }); } },
];

async function skippedReason(under: EngineUnderTest, question: string): Promise<string | null> {
  const events = await collect(under.engine, question);
  const skip = events.find(
    (event): event is Extract<AnswerEvent, { type: 'ai_status' }> =>
      event.type === 'ai_status' && event.status === 'skipped',
  );
  return skip?.reason ?? null;
}

describe.each(ENGINES)('$name', (factory) => {
  let controls: ContractControls | null = null;

  afterEach(() => {
    controls?.dispose();
    controls = null;
  });

  async function open(): Promise<EngineUnderTest> {
    const under = await factory.create();
    controls = under.ctl;
    return under;
  }

  async function askScenario(under: EngineUnderTest, scenario: MockScenario): Promise<AnswerEvent[]> {
    const question = under.ctl.scenario(scenario);
    // The live-data-with-bulletin route needs a cached feed; arrange it before asking.
    if (scenario === 'live_data_bulletin') await under.ctl.setFeed('fresh');
    return collect(under.engine, question);
  }

  for (const spec of SCENARIO_SPECS) {
    it(`${spec.scenario}: obeys the section 6 order rules and ends on ${spec.outcome}`, async () => {
      const under = await open();
      const events = await askScenario(under, spec.scenario);
      assertOrderRules(events);
      expect(events.some((event) => event.type === spec.main)).toBe(true);
      if (spec.scenario === 'emergency_then_guide') expect(events[0]?.type).toBe('emergency_card');
      const last = lastEvent(events);
      expect(last.type).toBe('done');
      if (last.type === 'done') expect(last.outcome).toBe(spec.outcome);
    });
  }

  it('guide_critical pins its summary above the AI part', async () => {
    const under = await open();
    const events = await askScenario(under, 'guide_critical');
    const summary = events.find((event) => event.type === 'summary');
    expect(summary).toBeDefined();
    if (summary?.type === 'summary') expect(summary.pinned).toBe(true);
    const firstAi = events.findIndex((event) => event.type.startsWith('ai_'));
    const summaryAt = events.findIndex((event) => event.type === 'summary');
    expect(summaryAt).toBeLessThan(firstAi);
  });

  it('phase_cue_during switches to during and fires onChange(phase)', async () => {
    const under = await open();
    const changes: EngineChange[] = [];
    under.engine.onChange((change) => changes.push(change));
    expect(under.engine.context.get().phase).toBe('before');

    const events = await askScenario(under, 'phase_cue_during');
    assertOrderRules(events);

    const phase = events.find((event) => event.type === 'phase_change');
    expect(phase).toBeDefined();
    if (phase?.type === 'phase_change') {
      expect(phase.kind).toBe('switched');
      expect(phase.from).toBe('before');
      expect(phase.to).toBe('during');
      expect(phase.source).toBe('ask');
    }
    expect(under.engine.context.get().phase).toBe('during');
    expect(changes).toContain('phase');
  });

  it('phase_cue_after only recommends and never switches the phase', async () => {
    const under = await open();
    const before = under.engine.context.get().phase;
    const events = await askScenario(under, 'phase_cue_after');
    assertOrderRules(events);

    const phase = events.find((event) => event.type === 'phase_change');
    expect(phase).toBeDefined();
    if (phase?.type === 'phase_change') {
      expect(phase.kind).toBe('recommended');
      expect(phase.to).toBe('after');
    }
    expect(under.engine.context.get().phase).toBe(before);
    expect(under.engine.context.get().phase).not.toBe('after');
  });

  it('cancel mid-stream ends with done(cancelled) and no phase_change', async () => {
    const under = await open();
    const question = under.ctl.scenario('phase_cue_during');
    const events: AnswerEvent[] = [];
    for await (const event of under.engine.ask.run(question)) {
      events.push(event);
      if (events.length === 1) under.engine.ask.cancel();
    }
    assertOrderRules(events);
    const last = lastEvent(events);
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.outcome).toBe('cancelled');
    expect(events.some((event) => event.type === 'phase_change')).toBe(false);
    expect(events.some((event) => event.type === 'closing')).toBe(false);
  });

  for (const skipCase of SKIP_CASES) {
    it(`answers from the vetted summary with ai_status(skipped, ${skipCase.reason}) when ${skipCase.name}`, async () => {
      const under = await open();
      const question = under.ctl.scenario('guide_full');
      skipCase.arrange(under);

      const events = await collect(under.engine, question);
      assertOrderRules(events);
      expect(events).toContainEqual({ type: 'ai_status', status: 'skipped', reason: skipCase.reason });
      expect(events.some((event) => event.type === 'summary')).toBe(true);
      const last = lastEvent(events);
      expect(last.type).toBe('done');
      if (last.type === 'done') expect(last.outcome).toBe('answered_summary');
    });
  }

  it('resolves AI skip reasons in the section 7 check order', async () => {
    const under = await open();
    const question = under.ctl.scenario('guide_full');
    under.engine.settings.update({ aiEnabled: false });
    under.ctl.setModelPresent(false);
    under.ctl.setTier('none');
    under.ctl.setBattery({ level: 1, charging: false, saver: true });
    expect(await skippedReason(under, question)).toBe('ai_off');

    under.engine.settings.update({ aiEnabled: true });
    expect(await skippedReason(under, question)).toBe('no_model');

    under.ctl.setModelPresent(true);
    expect(await skippedReason(under, question)).toBe('tier');

    under.ctl.setTier('full');
    expect(await skippedReason(under, question)).toBe('battery_saver');

    under.ctl.setBattery({ level: 1, charging: false, saver: false });
    expect(await skippedReason(under, question)).toBe('low_battery');
  });

  it('no member, plan or household-location secret appears in a prompt or the question log', async () => {
    const under = await open();
    const secrets = collectSecrets(under);
    expect(secrets.length).toBeGreaterThan(0);

    const allEvents: AnswerEvent[] = [];
    for (const spec of SCENARIO_SPECS) {
      const question = under.ctl.scenario(spec.scenario);
      allEvents.push(...await collect(under.engine, question));
    }

    const promptBlob = JSON.stringify(under.ctl.prompts());
    const eventBlob = JSON.stringify(allEvents);
    const historyBlob = JSON.stringify(under.engine.history.list());
    for (const secret of secrets) {
      expect(promptBlob, `prompt leaked ${secret}`).not.toContain(secret);
      expect(historyBlob, `log leaked ${secret}`).not.toContain(secret);
    }
    for (const secret of collectEventSecrets(under)) {
      expect(eventBlob, `event leaked ${secret}`).not.toContain(secret);
    }
    expect(under.ctl.requests()).toEqual([]);
  });

  const QUESTION_SECRET_KINDS = [
    'household name', 'member name', 'member note', 'member phone',
    'photo URI', 'area name', 'PSGC', 'coordinates',
  ] as const;
  type QuestionSecretKind = typeof QUESTION_SECRET_KINDS[number];

  function questionSecret(under: EngineUnderTest, kind: QuestionSecretKind): string | undefined {
    const profile = under.engine.profiles.active();
    const location = profile?.location ?? null;
    switch (kind) {
      case 'household name': return profile?.name;
      case 'member name': return under.engine.family.members()[0]?.name;
      case 'member note': return under.engine.family.members().find((member) => member.note !== undefined)?.note;
      case 'member phone': return under.engine.family.members().find((member) => member.phone !== undefined)?.phone;
      case 'photo URI': return under.ctl.photoFiles()[0];
      case 'area name': return allPlaces(under.engine).find((place) => place.psgc === location?.psgc)?.name;
      case 'PSGC': return location?.psgc;
      case 'coordinates':
        return location?.coords === undefined ? undefined : String(location.coords.lat);
    }
  }

  for (const kind of QUESTION_SECRET_KINDS) {
    it(`a question containing the ${kind} is redacted from the prompt and the question log`, async () => {
      const under = await open();
      // Only a one-shot GPS reading gives coordinates; the shared interface exposes no other way.
      if (kind === 'coordinates') await under.engine.family.location.useGps();
      const secret = questionSecret(under, kind);
      if (secret === undefined) return;

      const question = `Saan matatagpuan ang ${secret}?`.slice(0, under.engine.ask.maxLength);
      const events = await collect(under.engine, question);
      expect(events.length).toBeGreaterThan(0);

      expect(JSON.stringify(under.ctl.prompts()), `prompt leaked ${secret}`).not.toContain(secret);
      expect(JSON.stringify(under.engine.history.list()), `log leaked ${secret}`).not.toContain(secret);
    });
  }

  it('no bulletin text, storm name, position text or signal-area code appears in a prompt', async () => {
    const under = await open();
    await under.ctl.setFeed('fresh');

    const latest = under.engine.feed.get().latest;
    expect(latest).not.toBeNull();
    if (latest === null) return;

    const bulletin = latest.bulletin;
    // The question asks about the bagyo by name; even then no bulletin field may reach the prompt.
    const question = `Paano maghanda ngayong malapit ang ${bulletin.storm.name}?`
      .slice(0, under.engine.ask.maxLength);
    await collect(under.engine, question);

    const promptBlob = JSON.stringify(under.ctl.prompts());
    const secrets = [
      bulletin.text,
      bulletin.position.text,
      bulletin.source.title,
      bulletin.storm.name,
      bulletin.storm.internationalName ?? '',
      bulletin.movement?.text ?? '',
      ...bulletin.signalAreas.flatMap((area) => area.psgc),
    ].filter((value) => value.length >= 3);
    for (const secret of secrets) {
      expect(promptBlob, `prompt leaked ${secret}`).not.toContain(secret);
    }
  });

  it('makes no outbound request on any ask', async () => {
    const under = await open();
    for (const spec of SCENARIO_SPECS) {
      // Only the live-data-with-bulletin case arranges a cached feed, which is a network op in the
      // harness; every other ask is offline and must add no request.
      if (spec.scenario === 'live_data_bulletin') continue;
      await collect(under.engine, under.ctl.scenario(spec.scenario));
    }
    expect(under.ctl.requests()).toEqual([]);
  });

  it('makes no outbound request across profile, family, location, photo, ask, checklist and settings calls', async () => {
    const under = await open();
    const profile = under.engine.profiles.active();
    expect(profile).not.toBeNull();
    if (profile === null) return;

    under.engine.profiles.save({
      id: profile.id, name: profile.name, petsCount: profile.petsCount, home: profile.home, plan: profile.plan,
    });
    under.engine.family.members();
    under.engine.family.pending();
    under.engine.family.card(profile.ownerId);

    const barangay = firstBarangay(under.engine);
    if (barangay !== undefined) under.engine.family.location.setArea(barangay);

    const memberId = under.engine.family.members()[0]?.id;
    if (memberId !== undefined) {
      const draft = await under.engine.family.photos.start({ memberId }, 'gallery');
      if (draft.ok && draft.value !== null) {
        await under.engine.family.photos.save(draft.value.draftId, draft.value.suggestedCrop);
      }
    }

    await collect(under.engine, under.ctl.scenario('guide_full'));

    under.engine.checklist.view();
    under.engine.checklist.tick('now-listen-radio', true);
    under.engine.checklist.reset();

    under.engine.settings.update({ lowBatteryMode: true });
    under.engine.settings.update({ lowBatteryMode: false });

    expect(under.ctl.requests()).toEqual([]);
  });
});

// Section 3.6 keyword table and realistic timings: genuinely mock-only.
describe('mock only', () => {
  async function ready(scenario: MockScenario | null = null): Promise<MockEngine> {
    const engine = createMockEngine({ speed: 'fast' });
    const res = await engine.init();
    if (!res.ok) throw new Error(res.error.message);
    engine.debug.setScenario(scenario);
    return engine;
  }

  interface MockSpec {
    scenario: MockScenario;
    question: string;
    tokens: string[];
    outcome: Outcome;
  }

  const MOCK_SPECS: MockSpec[] = [
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
      outcome: 'answered_ai',
    },
    {
      scenario: 'phase_cue_after', question: 'Humupa na ang bagyo',
      tokens: ['summary', 'ai_status:loading_model', 'ai_status:thinking', 'ai_partial', 'ai_final', 'phase_change:recommended', 'closing', 'done'],
      outcome: 'answered_ai',
    },
  ];

  for (const spec of MOCK_SPECS) {
    it(`${spec.scenario}: a forced scenario matches the section 3.6 sequence`, async () => {
      const engine = await ready(spec.scenario);
      const events = await collect(engine, 'Ano ang dapat gawin ngayon?');
      assertOrderRules(events);
      expect(shape(events)).toEqual(spec.tokens);
      const last = lastEvent(events);
      if (last.type === 'done') expect(last.outcome).toBe(spec.outcome);
    });

    it(`${spec.scenario}: the keyword picks the scenario and matches the sequence`, async () => {
      const engine = await ready(null);
      const events = await collect(engine, spec.question);
      assertOrderRules(events);
      expect(shape(events)).toEqual(spec.tokens);
      const last = lastEvent(events);
      if (last.type === 'done') expect(last.outcome).toBe(spec.outcome);
    });
  }

  it('speed realistic stages the stream as section 3.6 documents', async () => {
    vi.useFakeTimers();
    try {
      const engine = createMockEngine({ speed: 'realistic' });
      await engine.init();

      const events: AnswerEvent[] = [];
      const consumer = (async () => {
        for await (const event of engine.ask.run('Ano ang dapat gawin ngayon?')) events.push(event);
      })();

      await vi.advanceTimersByTimeAsync(0);
      expect(events).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(300);
      expect(shape(events)).toContain('summary');

      await vi.advanceTimersByTimeAsync(10_000);
      await consumer;
      expect(shape(events)).toEqual(GUIDE_FULL_TOKENS);
    } finally {
      vi.useRealTimers();
    }
  });
});
