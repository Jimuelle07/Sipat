import { afterEach, describe, expect, it } from 'vitest';
import type { AnswerEvent, CopyKey, EngineChange, FeedError, MockEngine } from '../types/index.ts';
import { ENGINE_API_VERSION } from '../types/index.ts';
import { createMockEngine } from './mock.ts';
import { ENGINES, type EngineUnderTest } from './contractHarness.ts';

// docs/api-layer.md section 2: every CopyKey the engine must answer.
const COPY_KEYS: CopyKey[] = [
  'closing',
  'refusal',
  'source_link',
  'no_live_data',
  'stale_warning',
  'medical_dose',
  'phase_before',
  'phase_during',
  'phase_after',
  'phase_switched',
  'bulletin_age',
  'barangay_decides',
  'photo_consent',
  'photo_required',
  'photo_pending',
  'location_button',
  'aid_notice',
];

async function drain(stream: AsyncIterable<AnswerEvent>): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe.each(ENGINES)('$name', (factory) => {
  let current: EngineUnderTest | null = null;

  async function start(): Promise<EngineUnderTest> {
    current = await factory.create();
    return current;
  }

  afterEach(() => {
    current?.ctl.dispose();
    current = null;
  });

  describe('engine info', () => {
    it('reports api version 2, online false and the documented model fields', async () => {
      const { engine } = await start();
      const info = engine.info();

      expect(ENGINE_API_VERSION).toBe(2);
      expect(info.engineApiVersion).toBe(ENGINE_API_VERSION);
      expect(typeof info.appVersion).toBe('string');
      expect(info.guideDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(info.passagesCount).toBeGreaterThan(0);
      expect(info.sourcesCount).toBeGreaterThan(0);
      expect(Array.isArray(info.packs)).toBe(true);
      expect(info.online).toBe(false);
      expect(info.model.attribution).toBe('Built with Llama');
      expect(typeof info.model.fileName).toBe('string');
      expect(typeof info.model.sizeBytes).toBe('number');
      expect(typeof info.model.present).toBe('boolean');
    });
  });

  describe('copy', () => {
    it('returns non-empty Tagalog and English text for every CopyKey', async () => {
      const { engine } = await start();
      for (const key of COPY_KEYS) {
        expect(engine.copy(key).length, `tl copy for ${key}`).toBeGreaterThan(0);
        expect(engine.copy(key, { lang: 'en' }).length, `en copy for ${key}`).toBeGreaterThan(0);
      }
    });

    it('substitutes vars into the template', async () => {
      const { engine } = await start();

      const pending = engine.copy('photo_pending', { vars: { name: 'Ana' } });
      expect(pending).toContain('Ana');
      expect(pending).not.toContain('{name}');

      const switched = engine.copy('phase_switched', { vars: { phase: 'Habang may bagyo' } });
      expect(switched).toContain('Habang may bagyo');
      expect(switched).not.toContain('{phase}');

      const age = engine.copy('bulletin_age', {
        vars: { issuedAt: '2026-10-10T08:00:00+08:00', fetchedAt: '2026-10-10T09:00:00+08:00' },
      });
      expect(age).toContain('2026-10-10T08:00:00+08:00');
      expect(age).toContain('2026-10-10T09:00:00+08:00');
      expect(age).not.toContain('{issuedAt}');
      expect(age).not.toContain('{fetchedAt}');
    });

    it('defaults to Tagalog and offers a different English line', async () => {
      const { engine } = await start();
      expect(engine.copy('closing')).toBe(engine.copy('closing', { lang: 'tl' }));
      expect(engine.copy('closing', { lang: 'en' })).not.toBe(engine.copy('closing'));
    });
  });

  describe('guide', () => {
    it('returns topics, passages, sources and reviewers from the fixtures', async () => {
      const { engine } = await start();

      const topics = engine.guide.topics();
      expect(topics.length).toBeGreaterThan(0);
      for (const topic of topics) {
        expect(topic.count).toBeGreaterThan(0);
        expect(engine.guide.byTopic(topic.topic).length).toBeGreaterThan(0);
      }

      const first = topics[0]!;
      const cards = engine.guide.byTopic(first.topic);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0]!.id.length).toBeGreaterThan(0);

      const detail = engine.guide.passage(cards[0]!.id);
      expect(detail).not.toBeNull();
      expect(detail!.text.length).toBeGreaterThan(0);
      expect(detail!.source.agency.length).toBeGreaterThan(0);
      expect(detail!.source.title.length).toBeGreaterThan(0);
      expect(detail!.source.date.length).toBeGreaterThan(0);
      expect(detail!.source.url.length).toBeGreaterThan(0);
      expect(detail!.reviewedBy.length).toBeGreaterThan(0);
      expect(detail!.reviewedAt.length).toBeGreaterThan(0);
      expect(typeof detail!.version).toBe('number');

      expect(engine.guide.passage('does-not-exist')).toBeNull();

      const sources = engine.guide.sources();
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.agency.length).toBeGreaterThan(0);
        expect(source.title.length).toBeGreaterThan(0);
        expect(source.date.length).toBeGreaterThan(0);
        expect(source.url.length).toBeGreaterThan(0);
      }

      const reviewers = engine.guide.reviewers();
      expect(reviewers.length).toBeGreaterThan(0);
      for (const reviewer of reviewers) {
        expect(reviewer.name.length).toBeGreaterThan(0);
        expect(reviewer.passages).toBeGreaterThan(0);
      }
    });

    it('filters topics and passages by the active phase', async () => {
      const { engine } = await start();

      const before = new Set(engine.guide.topics().map((topic) => topic.topic));
      expect(before.has('go_bag')).toBe(true);
      expect(before.has('evacuation')).toBe(false);

      engine.context.setPhase('during');
      const during = new Set(engine.guide.topics().map((topic) => topic.topic));
      expect(during.has('evacuation')).toBe(true);
      expect(during.has('go_bag')).toBe(false);
      for (const topic of during) {
        for (const card of engine.guide.byTopic(topic)) {
          expect(during.has(card.topic)).toBe(true);
        }
      }
    });

    it('marks every fixture passage and checklist item as sample content', async () => {
      const { engine } = await start();
      for (const topic of engine.guide.topics()) {
        for (const passage of engine.guide.byTopic(topic.topic)) {
          expect(passage.title.startsWith('SAMPLE: ')).toBe(true);
          expect(passage.summary.startsWith('SAMPLE: ')).toBe(true);
        }
      }
      const text = JSON.stringify(engine.checklist.view());
      expect(text).toContain('SAMPLE: ');
    });
  });

  describe('plan and emergency', () => {
    it('returns the fixture national hotlines', async () => {
      const { engine } = await start();
      const hotlines = engine.plan.hotlines();
      expect(hotlines.length).toBe(2);

      const ids = hotlines.map((hotline) => hotline.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const hotline of hotlines) {
        expect(hotline.scope).toBe('national');
        expect(hotline.source_id.length).toBeGreaterThan(0);
        expect(hotline.verified_at.length).toBeGreaterThan(0);
        expect(`${hotline.name} ${hotline.number}`.toLowerCase()).toContain('fill in');
      }
    });

    it('resolves the default emergency card and falls back for an unknown id', async () => {
      const { engine } = await start();
      const defaultCard = engine.emergency.card();
      expect(defaultCard.id.length).toBeGreaterThan(0);
      expect(engine.emergency.card(defaultCard.id).id).toBe(defaultCard.id);
      expect(engine.emergency.card('unknown-card').id).toBe(defaultCard.id);
    });

    it('call() accepts a hotline id and a raw phone number but not an unknown value', async () => {
      const { engine } = await start();
      const hotlines = engine.plan.hotlines();

      const byId = await engine.plan.call(hotlines[0]!.id);
      if (!byId.ok) expect(byId.error.code).toBe('no_dialer');

      const phone = engine.profiles.active()!.people[0]!.phone!;
      const byPhone = await engine.plan.call(phone);
      if (!byPhone.ok) expect(byPhone.error.code).toBe('no_dialer');

      const unknown = await engine.plan.call('not-a-hotline-or-number');
      expect(unknown).toMatchObject({ ok: false, error: { code: 'not_found' } });
    });
  });

  describe('history', () => {
    it('lists a finished question and clears on demand', async () => {
      const { engine, ctl } = await start();
      const question = ctl.scenario('guide_full');
      const events = await drain(engine.ask.run(question));
      expect(events.length).toBeGreaterThan(0);

      const listed = engine.history.list();
      expect(listed.length).toBeGreaterThan(0);
      expect(typeof listed[0]!.id).toBe('string');
      expect(typeof listed[0]!.question).toBe('string');
      expect(typeof listed[0]!.outcome).toBe('string');

      engine.history.clear();
      expect(engine.history.list()).toEqual([]);
    });
  });

  describe('evaluation', () => {
    it('returns an EvalSummary shape', async () => {
      const { engine } = await start();
      const summary = engine.evaluation.summary();

      expect(summary).not.toBeNull();
      if (summary) {
        expect(typeof summary.generatedAt).toBe('string');
        expect(typeof summary.retrieval.hitAt2).toBe('number');
        expect(typeof summary.retrieval.correctRefusal).toBe('number');
        expect(typeof summary.retrieval.emergencyTrigger).toBe('number');
        expect(typeof summary.retrieval.liveDataReply).toBe('number');
        expect(summary.answers.faithfulness === null || typeof summary.answers.faithfulness === 'number').toBe(true);
        expect(typeof summary.answers.numberCheckPass).toBe('number');
        expect(typeof summary.phase.casesPassed).toBe('number');
        expect(typeof summary.phase.casesTotal).toBe('number');
        expect(typeof summary.phase.wrongDirection).toBe('number');
      }
    });
  });

  describe('account', () => {
    it('is signed out, returns the demo results and makes no outbound request', async () => {
      const { engine, ctl } = await start();

      expect(engine.account.state()).toEqual({ signedIn: false });
      expect(await engine.account.signUp({ email: 'a@b.com', password: 'secret123' }))
        .toMatchObject({ ok: false, error: { code: 'demo_only' } });
      expect(await engine.account.signIn({ email: 'a@b.com', password: 'secret123' }))
        .toMatchObject({ ok: false, error: { code: 'demo_only' } });
      expect(await engine.account.sendReset('a@b.com')).toMatchObject({ ok: false, error: { code: 'demo_only' } });
      expect(engine.account.signOut()).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
      expect(engine.account.setSync(true)).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });

      expect(ctl.requests()).toEqual([]);
    });
  });

  describe('model', () => {
    it('installs the exact file and reports progress up to the total', async () => {
      const { engine, ctl } = await start();
      ctl.setModelPresent(false);
      ctl.setModelFile('exact');
      const progress: { bytes: number; total: number }[] = [];

      const res = await engine.model.installFromPicker((bytes, total) => progress.push({ bytes, total }));

      expect(res).toMatchObject({ ok: true, value: 'installed' });
      expect(engine.info().model.present).toBe(true);
      expect(progress.length).toBeGreaterThan(0);
      const last = progress[progress.length - 1]!;
      expect(last.total).toBeGreaterThan(0);
      expect(last.bytes).toBe(last.total);
    });

    it.each(['wrong_name', 'wrong_size'] as const)(
      'returns wrong_file for a %s file before copying',
      async (setting) => {
        const { engine, ctl } = await start();
        ctl.setModelPresent(false);
        ctl.setModelFile(setting);

        const res = await engine.model.installFromPicker(() => {});

        expect(res).toMatchObject({ ok: false, error: { code: 'wrong_file' } });
        expect(ctl.modelDirFiles()).toEqual([]);
      },
    );

    it('returns hash_mismatch for a wrong hash and leaves no file behind', async () => {
      const { engine, ctl } = await start();
      ctl.setModelPresent(false);
      ctl.setModelFile('wrong_hash');

      const res = await engine.model.installFromPicker(() => {});

      expect(res).toMatchObject({ ok: false, error: { code: 'hash_mismatch' } });
      expect(ctl.modelDirFiles()).toEqual([]);
    });

    it('reports no install when no file is chosen', async () => {
      const { engine, ctl } = await start();
      ctl.setModelPresent(false);
      ctl.setModelFile('none');

      const res = await engine.model.installFromPicker(() => {});

      // Section 3.2/7: a closed picker is a null success; the mock reports cancelled instead.
      expect(res.ok ? res.value === null : res.error.code === 'cancelled').toBe(true);
      expect(ctl.modelDirFiles()).toEqual([]);
    });

    it('returns tier on a none-tier device before copying', async () => {
      const { engine, ctl } = await start();
      ctl.setModelPresent(false);
      ctl.setTier('none');
      ctl.setModelFile('exact');

      const res = await engine.model.installFromPicker(() => {});

      expect(res).toMatchObject({ ok: false, error: { code: 'tier' } });
      expect(ctl.modelDirFiles()).toEqual([]);
    });

    it('remove() clears the installed model', async () => {
      const { engine, ctl } = await start();
      ctl.setModelPresent(false);
      ctl.setModelFile('exact');
      await engine.model.installFromPicker(() => {});
      expect(engine.info().model.present).toBe(true);

      await engine.model.remove();

      expect(engine.info().model.present).toBe(false);
      expect(ctl.modelDirFiles()).toEqual([]);
    });
  });

  describe('feed (MVP stretch)', () => {
    it('get() returns a documented FeedState', async () => {
      const { engine } = await start();
      const state = engine.feed.get();

      expect(['off', 'empty', 'fresh', 'stale']).toContain(state.status);
      expect(typeof state.refreshing).toBe('boolean');
      expect(typeof state.serverStale).toBe('boolean');
      if (state.latest) {
        expect(typeof state.latest.bulletin.id).toBe('string');
        expect(typeof state.latest.ageText).toBe('string');
      }
    });

    it.each(['off', 'empty', 'fresh', 'stale'] as const)('setFeed(%s) is reflected in get()', async (status) => {
      const { engine, ctl } = await start();
      await ctl.setFeed(status);

      const state = engine.feed.get();
      expect(state.status).toBe(status);
      if (status === 'fresh' || status === 'stale') {
        expect(state.latest).not.toBeNull();
        expect(state.latest!.bulletin.source.title).toContain('SAMPLE');
        expect(state.latest!.stale).toBe(status === 'stale');
      } else {
        expect(state.latest).toBeNull();
      }
    });

    it.each(['near', 'signal_here', 'track_approach', 'left'] as const)(
      'setFeed(%s) serves the sample bulletin',
      async (variant) => {
        const { engine, ctl } = await start();
        await ctl.setFeed(variant);

        const state = engine.feed.get();
        expect(state.latest).not.toBeNull();
        expect(state.latest!.bulletin.source.title).toContain('SAMPLE');
      },
    );

    it('refresh() resolves a Result, never throws and fires onChange(feed)', async () => {
      const { engine, ctl } = await start();
      await ctl.setFeed('fresh');
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));

      const res = await engine.feed.refresh();

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('fresh');
        expect(res.value.latest?.bulletin.source.title).toContain('SAMPLE');
      }
      expect(changes).toContain('feed');
    });

    it('refresh() returns a documented error when the feed is off', async () => {
      const { engine, ctl } = await start();
      await ctl.setFeed('off');

      const res = await engine.feed.refresh();

      expect(res.ok).toBe(false);
      if (!res.ok) expect(typeof res.error.code).toBe('string');
    });
  });

  describe('evacuation (MVP stretch)', () => {
    it('view() returns a documented EvacuationView without throwing', async () => {
      const { engine, ctl } = await start();
      await ctl.setFeed('fresh');

      const view = engine.evacuation.view();
      expect(view.barangayCopyKey).toBe('barangay_decides');
      expect(Array.isArray(view.centers)).toBe(true);
      expect(typeof view.centersFirst).toBe('boolean');
      expect(typeof view.needsLocation).toBe('boolean');
      if (view.bulletin) expect(typeof view.bulletin.bulletin.id).toBe('string');
      if (view.storm) expect(typeof view.storm.closestKm).toBe('number');
      for (const ranked of view.centers) {
        expect(ranked.center.name.length).toBeGreaterThan(0);
        expect(typeof ranked.distanceKm).toBe('number');
      }
    });
  });

  describe('screen', () => {
    it('sosOn and sosOff resolve', async () => {
      const { engine } = await start();
      await expect(engine.screen.sosOn()).resolves.toBeUndefined();
      await expect(engine.screen.sosOff()).resolves.toBeUndefined();
    });
  });

  describe('stretch and Pilot services', () => {
    it('never throws and returns documented values', async () => {
      const { engine } = await start();

      expect(engine.updates.pending()).toBeNull();
      expect(engine.updates.networkLog()).toEqual([]);
      expect(Array.isArray(engine.packs.installed())).toBe(true);

      const drafts = engine.damage.list();
      expect(Array.isArray(drafts)).toBe(true);
      for (const draft of drafts) {
        expect(typeof draft.id).toBe('string');
        expect(draft.sentAt === null || typeof draft.sentAt === 'string').toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Mock-only cases: the version-2 mock's scripted flow extras. The real engine
// keeps these as documented no-ops, so they cannot run through the shared
// `ContractControls` (docs/api-layer.md section 3.6).
// ---------------------------------------------------------------------------
describe('mock only', () => {
  async function ready(): Promise<MockEngine> {
    const engine = createMockEngine({ speed: 'fast' });
    const res = await engine.init();
    if (!res.ok) throw new Error(res.error.message);
    return engine;
  }

  const FEED_ERRORS: FeedError[] = [
    'disabled', 'offline', 'http', 'unknown_key', 'key_expired', 'bad_signature',
    'app_too_old', 'rollback', 'hash_mismatch', 'schema',
  ];

  describe('feed debug controls', () => {
    it.each(FEED_ERRORS)('refresh() returns %s from debug.setFeed', async (code) => {
      const engine = await ready();
      engine.debug.setFeed(code);

      const res = await engine.feed.refresh();

      expect(res).toMatchObject({ ok: false, error: { code } });
    });

    it('a failed refresh keeps the cached bulletin', async () => {
      const engine = await ready();
      engine.debug.setFeed('fresh');
      expect((await engine.feed.refresh()).ok).toBe(true);
      const cached = engine.feed.get().latest;
      expect(cached).not.toBeNull();

      engine.debug.setFeed('offline');
      const failed = await engine.feed.refresh();

      expect(failed).toMatchObject({ ok: false, error: { code: 'offline' } });
      expect(engine.feed.get().latest).toEqual(cached);
    });

    it('evacuation.view() returns the three placeholder centers', async () => {
      const engine = await ready();

      const view = engine.evacuation.view();

      expect(view.centers.length).toBe(3);
      expect(view.barangayCopyKey).toBe('barangay_decides');
    });
  });

  describe('status override', () => {
    it('keeps an AI override until settings recompute the decision', async () => {
      const engine = await ready();
      engine.debug.setStatus({ ai: { allowed: true } });
      expect(engine.status().ai).toEqual({ allowed: true });

      engine.settings.update({ lowBatteryMode: true });

      expect(engine.status().ai).toEqual({ allowed: false, reason: 'low_battery' });
    });
  });

  describe('packs, updates and damage flows', () => {
    it('imports, applies and rolls back a placeholder pack', async () => {
      const engine = await ready();
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));

      const previewResult = await engine.packs.importFromPicker();
      expect(previewResult.ok).toBe(true);
      if (!previewResult.ok || !previewResult.value) throw new Error('expected a pack preview');

      const applied = await engine.packs.apply(previewResult.value.previewId);
      expect(applied.ok).toBe(true);
      expect(engine.packs.installed()).toHaveLength(1);

      const rolledBack = await engine.packs.rollback(previewResult.value.packs[0]!.packId);
      expect(rolledBack.ok).toBe(true);
      expect(engine.packs.installed()).toHaveLength(0);
      expect(changes).toContain('packs');
    });

    it('checks and downloads a placeholder update without network log entries', async () => {
      const engine = await ready();
      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));

      const checked = await engine.updates.check();
      expect(checked.ok).toBe(true);
      if (!checked.ok || !checked.value) throw new Error('expected an update plan');

      const progress: number[] = [];
      const downloaded = await engine.updates.download(checked.value.planId, (bytes) => progress.push(bytes));

      expect(downloaded.ok).toBe(true);
      expect(progress.at(-1)).toBe(checked.value.totalBytes);
      expect(engine.updates.networkLog()).toEqual([]);
      expect(engine.info().online).toBe(false);
      expect(changes).toContain('updates');
    });

    it('has one unsent damage draft and adds a placeholder photo', async () => {
      const engine = await ready();
      const list = engine.damage.list();
      expect(list.length).toBe(1);
      expect(list[0]!.id.length).toBeGreaterThan(0);
      expect(list[0]!.sentAt).toBeNull();

      const changes: EngineChange[] = [];
      engine.onChange((change) => changes.push(change));
      const result = await engine.damage.addPhoto(list[0]!.id, 'gallery');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.photoPaths).toHaveLength(1);
        expect(typeof result.value?.photoPaths[0]).toBe('string');
      }
      expect(changes).toContain('damage');
    });
  });
});
