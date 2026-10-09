import { describe, expect, it } from 'vitest';
import type { CopyKey, FeedError, ModelInstallError, MockEngine } from '../types/index.ts';
import { ENGINE_API_VERSION } from '../types/index.ts';
import { createMockEngine } from './mock.ts';
import { EVAL_SUMMARY_FIXTURE } from './fixtures/eval.ts';

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

// docs/api-layer.md section 3.2: FeedError, returned by feed.refresh().
const FEED_ERRORS: FeedError[] = [
  'disabled',
  'offline',
  'http',
  'unknown_key',
  'key_expired',
  'bad_signature',
  'app_too_old',
  'rollback',
  'hash_mismatch',
  'schema',
];

// docs/api-layer.md section 3.2: ModelInstallError, returned by model.installFromPicker().
const MODEL_INSTALL_ERRORS: ModelInstallError[] = [
  'tier',
  'no_space',
  'wrong_file',
  'hash_mismatch',
  'cancelled',
  'io',
];

const SAMPLE_BULLETIN_TITLE = 'SAMPLE – hindi totoong bulletin';

async function ready(): Promise<MockEngine> {
  const engine = createMockEngine({ speed: 'fast' });
  const res = await engine.init();
  if (!res.ok) throw new Error(res.error.message);
  return engine;
}

describe('engine info', () => {
  it('reports api version 2 and the documented fields', async () => {
    const engine = await ready();
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
    const engine = await ready();
    for (const key of COPY_KEYS) {
      expect(engine.copy(key).length, `tl copy for ${key}`).toBeGreaterThan(0);
      expect(engine.copy(key, { lang: 'en' }).length, `en copy for ${key}`).toBeGreaterThan(0);
    }
  });

  it('substitutes vars into the template', async () => {
    const engine = await ready();

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
    const engine = await ready();
    expect(engine.copy('closing')).toBe(engine.copy('closing', { lang: 'tl' }));
    expect(engine.copy('closing', { lang: 'en' })).not.toBe(engine.copy('closing'));
  });
});

describe('guide', () => {
  it('returns topics, passages and sources from the fixtures', async () => {
    const engine = await ready();

    const topics = engine.guide.topics();
    expect(topics.length).toBeGreaterThan(0);
    for (const t of topics) {
      expect(t.count).toBeGreaterThan(0);
      expect(engine.guide.byTopic(t.topic).length).toBeGreaterThan(0);
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
    for (const s of sources) {
      expect(s.agency.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.date.length).toBeGreaterThan(0);
      expect(s.url.length).toBeGreaterThan(0);
    }
  });

  it('derives reviewers from reviewed_by', async () => {
    const engine = await ready();
    const reviewers = engine.guide.reviewers();
    expect(reviewers.length).toBeGreaterThan(0);
    for (const r of reviewers) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.passages).toBeGreaterThan(0);
    }
  });

  it('marks every fixture passage and checklist item as sample content', async () => {
    const engine = await ready();
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

describe('fixture hotlines', () => {
  it('has exactly two placeholder entries', async () => {
    const engine = await ready();
    const hotlines = engine.plan.hotlines();
    expect(hotlines.length).toBe(2);

    const ids = hotlines.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of hotlines) {
      expect(h.scope).toBe('national');
      expect(h.source_id.length).toBeGreaterThan(0);
      expect(h.verified_at.length).toBeGreaterThan(0);
      expect(`${h.name} ${h.number}`.toLowerCase()).toContain('fill in');
    }
  });
});

describe('emergency cards', () => {
  it('resolves a requested card id and falls back to the default for an unknown id', async () => {
    const engine = await ready();
    const defaultCard = engine.emergency.card();
    expect(engine.emergency.card(defaultCard.id).id).toBe(defaultCard.id);
    expect(engine.emergency.card('unknown-card').id).toBe(defaultCard.id);
  });
});

describe('plan.call', () => {
  it('accepts a hotline id and a raw phone number', async () => {
    const engine = await ready();

    const hotlines = engine.plan.hotlines();
    const byId = await engine.plan.call(hotlines[0]!.id);
    expect(byId.ok).toBe(true);

    const byPhone = await engine.plan.call(engine.profiles.active()!.people[0]!.phone!);
    expect(byPhone.ok).toBe(true);

    const unknown = await engine.plan.call('not-a-hotline');
    expect(unknown).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });
});

describe('feed', () => {
  it.each(['off', 'empty', 'fresh', 'stale'] as const)('get() reflects debug.setFeed(%s)', async (status) => {
    const engine = await ready();
    engine.debug.setFeed(status);
    await engine.feed.refresh();

    const state = engine.feed.get();
    expect(state.status).toBe(status);

    if (status === 'fresh' || status === 'stale') {
      expect(state.latest).not.toBeNull();
      expect(state.latest!.bulletin.source.title).toBe(SAMPLE_BULLETIN_TITLE);
      expect(state.latest!.stale).toBe(status === 'stale');
    } else {
      expect(state.latest).toBeNull();
    }
  });

  it.each(FEED_ERRORS)('refresh() returns %s from debug.setFeed', async (code) => {
    const engine = await ready();
    engine.debug.setFeed(code);

    const res = await engine.feed.refresh();
    expect(res).toMatchObject({ ok: false, error: { code } });
  });

  it('refresh() succeeds with the sample bulletin and fires onChange(feed)', async () => {
    const engine = await ready();
    const changes: string[] = [];
    engine.onChange((c) => changes.push(c));
    engine.debug.setFeed('fresh');

    const res = await engine.feed.refresh();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.status).toBe('fresh');
      expect(res.value.latest?.bulletin.source.title).toBe(SAMPLE_BULLETIN_TITLE);
    }
    expect(changes).toContain('feed');
  });

  it.each(['near', 'signal_here', 'track_approach', 'left'] as const)('refresh() succeeds with feed variant %s', async (variant) => {
    const engine = await ready();
    const changes: string[] = [];
    engine.onChange((change) => changes.push(change));
    engine.debug.setFeed(variant);
    const result = await engine.feed.refresh();
    expect(result.ok).toBe(true);
    expect(engine.feed.get().latest?.bulletin.id).toBe('sample-bulletin-1');
    expect(changes).toContain('feed');
  });

  it('a failed refresh keeps the cached bulletin', async () => {
    const engine = await ready();
    engine.debug.setFeed('fresh');
    const ok = await engine.feed.refresh();
    expect(ok.ok).toBe(true);
    const cached = engine.feed.get().latest;
    expect(cached).not.toBeNull();

    engine.debug.setFeed('offline');
    const failed = await engine.feed.refresh();
    expect(failed).toMatchObject({ ok: false, error: { code: 'offline' } });
    expect(engine.feed.get().latest).toEqual(cached);
  });
});

describe('evacuation', () => {
  it('returns three placeholder centers and the barangay copy key', async () => {
    const engine = await ready();
    const view = engine.evacuation.view();

    expect(view.centers.length).toBe(3);
    for (const ranked of view.centers) {
      expect(ranked.center.name.length).toBeGreaterThan(0);
    }
    expect(view.barangayCopyKey).toBe('barangay_decides');
  });
});

describe('account', () => {
  it('is signed out and the demo calls return the documented results', async () => {
    const engine = await ready();

    expect(engine.account.state()).toEqual({ signedIn: false });

    expect(await engine.account.signUp({ email: 'a@b.com', password: 'secret123' })).toMatchObject({
      ok: false,
      error: { code: 'demo_only' },
    });
    expect(await engine.account.signIn({ email: 'a@b.com', password: 'secret123' })).toMatchObject({
      ok: false,
      error: { code: 'demo_only' },
    });
    expect(await engine.account.sendReset('a@b.com')).toMatchObject({ ok: false, error: { code: 'demo_only' } });
    expect(engine.account.signOut()).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
    expect(engine.account.setSync(true)).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
  });
});

describe('mock MVP stretch and Pilot flows', () => {
  it('keeps a status AI override until settings recomputes the decision', async () => {
    const engine = await ready();
    engine.debug.setStatus({ ai: { allowed: true } });
    expect(engine.status().ai).toEqual({ allowed: true });
    engine.settings.update({ lowBatteryMode: true });
    expect(engine.status().ai).toEqual({ allowed: false, reason: 'low_battery' });
  });

  it('imports, applies and rolls back a placeholder pack', async () => {
    const engine = await ready();
    const changes: string[] = [];
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
    const changes: string[] = [];
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

  it('adds a placeholder photo to the unsent damage draft', async () => {
    const engine = await ready();
    const changes: string[] = [];
    engine.onChange((change) => changes.push(change));
    const draft = engine.damage.list().find((item) => item.sentAt === null)!;
    const result = await engine.damage.addPhoto(draft.id, 'gallery');
    expect(result.ok && result.value?.photoPaths).toEqual(['fixture://damage/damage-sample-1/1.jpg']);
    expect(changes).toContain('damage');
  });
});

describe('damage', () => {
  it('has one unsent draft', async () => {
    const engine = await ready();
    const list = engine.damage.list();
    expect(list.length).toBe(1);
    expect(list[0]!.id.length).toBeGreaterThan(0);
    expect(list[0]!.sentAt).toBeNull();
  });
});

describe('model', () => {
  it('installFromPicker succeeds by default and reports progress', async () => {
    const engine = await ready();
    const progress: { bytes: number; total: number }[] = [];

    const res = await engine.model.installFromPicker((bytes, total) => progress.push({ bytes, total }));
    expect(res).toMatchObject({ ok: true, value: 'installed' });
    expect(engine.info().model.present).toBe(true);

    expect(progress.length).toBeGreaterThan(0);
    const last = progress[progress.length - 1]!;
    expect(last.total).toBeGreaterThan(0);
    expect(last.bytes).toBe(last.total);
  });

  it('remove() clears the installed model', async () => {
    const engine = await ready();
    await engine.model.installFromPicker(() => {});
    await engine.model.remove();
    expect(engine.info().model.present).toBe(false);
  });

  it.each(MODEL_INSTALL_ERRORS)('installFromPicker returns %s from debug.setModelInstallResult', async (code) => {
    const engine = await ready();
    const presentBefore = engine.info().model.present;
    engine.debug.setModelInstallResult(code);

    const res = await engine.model.installFromPicker(() => {});
    expect(res).toMatchObject({ ok: false, error: { code } });
    expect(engine.info().model.present).toBe(presentBefore);
  });
});

describe('screen', () => {
  it('sosOn and sosOff resolve', async () => {
    const engine = await ready();
    await expect(engine.screen.sosOn()).resolves.toBeUndefined();
    await expect(engine.screen.sosOff()).resolves.toBeUndefined();
  });
});

describe('evaluation', () => {
  it('returns the fixture summary', async () => {
    const engine = await ready();
    const summary = engine.evaluation.summary();

    expect(summary).not.toBeNull();
    expect(summary).toEqual(EVAL_SUMMARY_FIXTURE);
    expect(typeof summary!.generatedAt).toBe('string');
    expect(typeof summary!.retrieval.hitAt2).toBe('number');
    expect(typeof summary!.retrieval.correctRefusal).toBe('number');
    expect(typeof summary!.retrieval.emergencyTrigger).toBe('number');
    expect(typeof summary!.retrieval.liveDataReply).toBe('number');
    expect(typeof summary!.answers.numberCheckPass).toBe('number');
  });
});
