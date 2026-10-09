import { describe, expect, it } from 'vitest';
import type {
  EngineChange,
  FaceDetection,
  LocationError,
  MemberInput,
  MockEngine,
  PhotoError,
  ProfileInput,
} from '../types/index.ts';
import { createMockEngine } from './mock.ts';

async function ready(): Promise<MockEngine> {
  const engine = createMockEngine({ speed: 'fast' });
  const res = await engine.init();
  if (!res.ok) throw new Error(res.error.message);
  return engine;
}

function recorder(engine: MockEngine): { changes: EngineChange[]; stop: () => void } {
  const changes: EngineChange[] = [];
  const stop = engine.onChange((c) => changes.push(c));
  return { changes, stop };
}

function profileErrors(result: ReturnType<MockEngine['profiles']['create']>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code);
}

function memberErrors(result: ReturnType<MockEngine['family']['saveMember']>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code);
}

function anyBarangay(engine: MockEngine): string {
  for (const province of engine.family.location.places()) {
    for (const mid of engine.family.location.places(province.psgc)) {
      const barangay = engine.family.location.places(mid.psgc).find((p) => p.level === 'barangay');
      if (barangay) return barangay.psgc;
    }
  }
  return engine.family.location.get()!.psgc;
}

const DETECTIONS: FaceDetection[] = ['one_face', 'no_face', 'many_faces', 'unavailable'];
const PHOTO_ERRORS: PhotoError[] = [
  'permission_denied', 'no_camera', 'unreadable', 'draft_expired', 'not_found', 'io',
];
const LOCATION_ERRORS: LocationError[] = ['permission_denied', 'services_off', 'unavailable'];

describe('mock engine: profiles, family, photos and location', () => {
  it('has a fixture household of 4 members with exactly one pending, listed by pending()', async () => {
    const engine = await ready();
    const members = engine.family.members();
    expect(members).toHaveLength(4);
    expect(members[0]?.relation).toBe('self');
    expect(members[0]?.id).toBe(engine.profiles.active()?.ownerId);

    const pending = members.filter((m) => m.photoStatus === 'pending');
    expect(pending).toHaveLength(1);

    const listed = engine.family.pending();
    expect(listed.map((m) => m.id)).toEqual(pending.map((m) => m.id));
    expect(listed[0]?.photoStatus).toBe('pending');
  });

  it('covers every profile mutation with the documented onChange value', async () => {
    const engine = await ready();
    const { changes, stop } = recorder(engine);
    const active = engine.profiles.active()!;

    changes.length = 0;
    const saved = engine.profiles.save({ id: active.id, name: 'Bagong Bahay', petsCount: 0, home: [], plan: { contacts: [] } });
    expect(saved.ok).toBe(true);
    expect(changes).toContain('profiles');

    engine.checklist.tick('now-listen-radio', true);
    changes.length = 0;
    const removed = engine.profiles.remove(active.id);
    expect(removed.ok).toBe(true);
    expect(engine.profiles.active()).toBeNull();
    expect(changes).toContain('profiles');

    changes.length = 0;
    const created = engine.profiles.create({
      name: 'Bahay namin', owner: { name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [] },
    });
    expect(created.ok).toBe(true);
    expect(created.ok && created.value.ownerId).toBe(engine.profiles.active()?.ownerId);
    expect(engine.family.members()).toHaveLength(1);
    expect(engine.family.members()[0]?.photoStatus).toBe('pending');
    expect(JSON.stringify(engine.checklist.view())).not.toContain('"ticked":true');
    expect(changes).toContain('profiles');

    stop();
  });

  it('profiles.create returns each documented error code for bad input', async () => {
    const engine = await ready();
    const owner = (over: Partial<MemberInput> = {}): MemberInput => ({
      name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [], ...over,
    });

    expect(profileErrors(engine.profiles.create({ name: '', owner: owner() }))).toContain('name_required');
    expect(profileErrors(engine.profiles.create({ name: 'x'.repeat(61), owner: owner() }))).toContain('too_long');
    expect(profileErrors(engine.profiles.create({ name: 'Bahay', owner: owner({ name: '' }) }))).toContain('name_required');
    expect(profileErrors(engine.profiles.create({ name: 'Bahay', owner: owner({ name: 'x'.repeat(41) }) }))).toContain('too_long');
    expect(profileErrors(engine.profiles.create({ name: 'Bahay', owner: owner({ phone: 'abc' }) }))).toContain('phone_invalid');
  });

  it('profiles.save returns each documented error code for bad input', async () => {
    const engine = await ready();
    const active = engine.profiles.active()!;
    const withPlan = (over: Partial<ProfileInput> = {}): ProfileInput => ({
      id: active.id, name: 'Bahay namin', petsCount: 1, home: active.home, plan: { contacts: [] }, ...over,
    });

    expect(profileErrors(engine.profiles.save(withPlan({ name: '' })))).toContain('name_required');
    expect(profileErrors(engine.profiles.save(withPlan({ name: 'x'.repeat(61) })))).toContain('too_long');
    expect(profileErrors(engine.profiles.save(withPlan({ petsCount: 21 })))).toContain('pets_range');
    expect(profileErrors(engine.profiles.save(withPlan({ petsCount: -1 })))).toContain('pets_range');

    const sixContacts = [0, 1, 2, 3, 4, 5].map((i) => ({ name: `Kontak ${i}`, phone: '0000000000' }));
    expect(profileErrors(engine.profiles.save(withPlan({ plan: { contacts: sixContacts } })))).toContain('too_many_contacts');

    const badPhone = [{ name: 'Kontak', phone: 'abc' }];
    expect(profileErrors(engine.profiles.save(withPlan({ plan: { contacts: badPhone } })))).toContain('contact_phone_invalid');
  });

  it('family.saveMember returns each documented error code for bad input', async () => {
    const engine = await ready();
    const base: MemberInput = { name: 'Bago', relation: 'relative', ageGroup: 'adult', needs: [] };

    expect(memberErrors(engine.family.saveMember({ ...base, name: '' }))).toContain('name_required');
    expect(memberErrors(engine.family.saveMember({ ...base, name: 'x'.repeat(41) }))).toContain('too_long');
    expect(memberErrors(engine.family.saveMember({ ...base, phone: 'abc' }))).toContain('phone_invalid');
    expect(memberErrors(engine.family.saveMember({ ...base, relation: 'self' }))).toContain('owner_relation');
  });

  it('family.saveMember rejects more members than the documented maximum', async () => {
    const engine = await ready();
    let accepted = true;
    for (let i = 0; i < 40 && accepted; i++) {
      const res = engine.family.saveMember({ name: `Kasama ${i}`, relation: 'relative', ageGroup: 'adult', needs: [] });
      accepted = res.ok;
      if (!res.ok) expect(memberErrors(res)).toContain('too_many_members');
    }
    expect(accepted).toBe(false);
  });

  it('members derive household tags and headcount', async () => {
    const engine = await ready();
    const before = engine.profiles.active()!;
    expect(before.headcount).toBe(before.people.length);
    const beforeHeadcount = before.headcount;

    const res = engine.family.saveMember({ name: 'Bata', relation: 'child', ageGroup: 'child', needs: ['pwd'] });
    expect(res.ok).toBe(true);

    const after = engine.profiles.active()!;
    expect(after.headcount).toBe(beforeHeadcount + 1);
    expect(after.headcount).toBe(after.people.length);
    expect(after.members).toContain('child');
    expect(after.members).toContain('pwd');
  });

  it('a new member is pending until photos.save; remove makes it pending again', async () => {
    const engine = await ready();
    const added = engine.family.saveMember({ name: 'Bagong Miyembro', relation: 'sibling', ageGroup: 'adult', needs: [] });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const id = added.value.id;

    expect(added.value.photoStatus).toBe('pending');
    expect(engine.family.pending().map((m) => m.id)).toContain(id);

    engine.debug.setPhotoResult('one_face');
    const started = await engine.family.photos.start({ memberId: id }, 'camera');
    expect(started.ok).toBe(true);
    if (!started.ok || !started.value) return;

    const saved = await engine.family.photos.save(started.value.draftId, started.value.suggestedCrop);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.faceCheck).toBe('one_face');

    expect(engine.family.members().find((m) => m.id === id)?.photoStatus).toBe('done');
    expect(engine.family.pending().map((m) => m.id)).not.toContain(id);

    const removed = engine.family.photos.remove(id);
    expect(removed.ok).toBe(true);
    expect(engine.family.members().find((m) => m.id === id)?.photoStatus).toBe('pending');
    expect(engine.family.pending().map((m) => m.id)).toContain(id);
  });

  it('photos.removeAll makes every member pending', async () => {
    const engine = await ready();
    engine.family.photos.removeAll();
    const members = engine.family.members();
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) expect(member.photoStatus).toBe('pending');
    expect(engine.family.pending()).toHaveLength(members.length);
  });

  it('photos.remove returns not_found for a member that does not exist', async () => {
    const engine = await ready();
    const res = engine.family.photos.remove('wala');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  it('a pending member blocks nothing else', async () => {
    const engine = await ready();
    const pendingId = engine.family.pending()[0]!.id;

    const card = engine.family.card(pendingId);
    expect(card).not.toBeNull();
    if (card) expect(card.member.photoStatus).toBe('pending');

    expect(engine.checklist.view().groups.length).toBeGreaterThan(0);

    const add = engine.family.saveMember({ name: 'Isa pa', relation: 'relative', ageGroup: 'adult', needs: [] });
    expect(add.ok).toBe(true);
  });

  it('removeMember removes a member; the main person cannot be removed', async () => {
    const engine = await ready();
    const ownerId = engine.profiles.active()!.ownerId;

    const owner = engine.family.removeMember(ownerId);
    expect(owner.ok).toBe(false);
    if (!owner.ok) expect(owner.error.code).toBe('owner_required');

    const victim = engine.family.members().find((m) => m.id !== ownerId)!;
    const removed = engine.family.removeMember(victim.id);
    expect(removed.ok).toBe(true);
    expect(engine.family.members().map((m) => m.id)).not.toContain(victim.id);

    const missing = engine.family.removeMember('wala');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });

  it('family.card returns the card for an existing member and null otherwise', async () => {
    const engine = await ready();
    const ownerId = engine.profiles.active()!.ownerId;

    const card = engine.family.card(ownerId);
    expect(card).not.toBeNull();
    if (card) {
      expect(card.member.id).toBe(ownerId);
      expect(typeof card.ownerName).toBe('string');
    }
    expect(engine.family.card('wala')).toBeNull();
  });

  it.each(DETECTIONS)('photos.start returns a draft with detection %s', async (detection) => {
    const engine = await ready();
    const memberId = engine.family.members()[0]!.id;
    engine.debug.setPhotoResult(detection);

    const res = await engine.family.photos.start({ memberId }, 'camera');
    expect(res.ok).toBe(true);
    if (!res.ok || !res.value) throw new Error('expected a draft');
    expect(res.value.detection).toBe(detection);
    expect(res.value.memberId).toBe(memberId);
  });

  it.each(PHOTO_ERRORS)('photos.start returns error %s from debug.setPhotoResult', async (code) => {
    const engine = await ready();
    const memberId = engine.family.members()[0]!.id;
    engine.debug.setPhotoResult(code);

    const res = await engine.family.photos.start({ memberId }, 'gallery');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(code);
  });

  it('photos.save records faceCheck manual when detection was not one_face', async () => {
    const engine = await ready();
    const memberId = engine.family.pending()[0]!.id;
    engine.debug.setPhotoResult('no_face');

    const started = await engine.family.photos.start({ memberId }, 'camera');
    expect(started.ok).toBe(true);
    if (!started.ok || !started.value) throw new Error('expected a draft');
    expect(started.value.detection).toBe('no_face');

    const saved = await engine.family.photos.save(started.value.draftId, started.value.suggestedCrop);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.faceCheck).toBe('manual');
  });

  it('covers every family and photo mutation with the documented onChange value', async () => {
    const engine = await ready();
    const { changes, stop } = recorder(engine);
    const pendingId = engine.family.pending()[0]!.id;

    changes.length = 0;
    const added = engine.family.saveMember({ name: 'X', relation: 'relative', ageGroup: 'adult', needs: [] });
    expect(added.ok).toBe(true);
    expect(changes).toContain('family');

    engine.debug.setPhotoResult('one_face');
    const started = await engine.family.photos.start({ memberId: pendingId }, 'camera');
    if (!started.ok || !started.value) throw new Error('expected a draft');

    changes.length = 0;
    await engine.family.photos.save(started.value.draftId, started.value.suggestedCrop);
    expect(changes).toContain('family');

    changes.length = 0;
    engine.family.photos.remove(pendingId);
    expect(changes).toContain('family');

    changes.length = 0;
    engine.family.photos.removeAll();
    expect(changes).toContain('family');

    changes.length = 0;
    if (added.ok) engine.family.removeMember(added.value.id);
    expect(changes).toContain('family');

    stop();
  });

  it('shareCard resolves for a member and reports not_found for a missing one', async () => {
    const engine = await ready();
    const memberId = engine.family.members()[0]!.id;

    const ok = await engine.family.shareCard(memberId, { current: null });
    expect(ok.ok).toBe(true);

    const missing = await engine.family.shareCard('wala', { current: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });

  it('location.get returns the fixture household location', async () => {
    const engine = await ready();
    const location = engine.family.location.get();
    expect(location).not.toBeNull();
    if (location) expect(typeof location.psgc).toBe('string');
  });

  it('location.setArea stores a known barangay and rejects an unknown PSGC', async () => {
    const engine = await ready();

    const unknown = engine.family.location.setArea('not-a-barangay');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('unknown_place');

    const psgc = anyBarangay(engine);
    const ok = engine.family.location.setArea(psgc);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.psgc).toBe(psgc);
      expect(ok.value.coords).toBeUndefined();
    }
  });

  it('location.useGps follows debug.setLocationResult for ok and each error', async () => {
    const engine = await ready();

    engine.debug.setLocationResult('ok');
    const ok = await engine.family.location.useGps();
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(typeof ok.value.psgc).toBe('string');
      expect(ok.value.coords).toBeDefined();
      if (ok.value.coords) expect(typeof ok.value.coords.at).toBe('string');
    }

    for (const code of LOCATION_ERRORS) {
      engine.debug.setLocationResult(code);
      const res = await engine.family.location.useGps();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe(code);
    }
  });

  it('covers location mutations with the documented onChange value', async () => {
    const engine = await ready();
    const { changes, stop } = recorder(engine);

    changes.length = 0;
    engine.family.location.setArea(anyBarangay(engine));
    expect(changes).toContain('profiles');

    changes.length = 0;
    engine.debug.setLocationResult('ok');
    const gps = await engine.family.location.useGps();
    expect(gps.ok).toBe(true);
    expect(changes).toContain('profiles');

    stop();
  });
});
