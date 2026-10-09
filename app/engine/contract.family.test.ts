import { afterEach, describe, expect, it } from 'vitest';
import type {
  Engine,
  EngineChange,
  FaceDetection,
  MemberInput,
  PhotoError,
  ProfileInput,
  SaveMemberResult,
  SaveProfileResult,
} from '../types/index.ts';
import { ENGINES } from './contractHarness.ts';
import type { ContractControls } from './contractHarness.ts';

// Contract tests for profiles, family, photos and location, written from
// docs/api-layer.md sections 3.2, 3.5, 3.6, 3.7, 4 and 5. They run against both
// engines through only the Engine facade and ContractControls.

const DETECTIONS: FaceDetection[] = ['one_face', 'no_face', 'many_faces', 'unavailable'];
const PHOTO_ERRORS: PhotoError[] = [
  'permission_denied', 'no_camera', 'unreadable', 'draft_expired', 'not_found', 'io',
];

function profileErrors(result: SaveProfileResult): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code);
}

function memberErrors(result: SaveMemberResult): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code);
}

function recorder(engine: Engine): { changes: EngineChange[]; stop: () => void } {
  const changes: EngineChange[] = [];
  const stop = engine.onChange((c) => changes.push(c));
  return { changes, stop };
}

function anyBarangay(engine: Engine): string {
  const walk = (parent?: string): string | null => {
    for (const place of engine.family.location.places(parent)) {
      if (place.level === 'barangay') return place.psgc;
      const child = walk(place.psgc);
      if (child) return child;
    }
    return null;
  };
  const found = walk();
  if (found) return found;
  const current = engine.family.location.get();
  if (current) return current.psgc;
  throw new Error('the fixture places have no barangay');
}

describe.each(ENGINES)('$name', (factory) => {
  let controls: ContractControls | null = null;

  afterEach(() => {
    controls?.dispose();
    controls = null;
  });

  async function setup(): Promise<{ engine: Engine; ctl: ContractControls }> {
    const { engine, ctl } = await factory.create();
    controls = ctl;
    return { engine, ctl };
  }

  it('has a fixture household with the main person first and exactly one pending member', async () => {
    const { engine } = await setup();
    const members = engine.family.members();
    expect(members).toHaveLength(4);
    expect(members[0]?.relation).toBe('self');
    expect(members[0]?.id).toBe(engine.profiles.active()?.ownerId);

    const pending = members.filter((m) => m.photoStatus === 'pending');
    expect(pending).toHaveLength(1);

    const listed = engine.family.pending();
    expect(listed.map((m) => m.id)).toEqual(pending.map((m) => m.id));
    for (const member of listed) expect(member.photoStatus).toBe('pending');
  });

  it('profiles.create returns each documented error code for bad input', async () => {
    const { engine } = await setup();
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
    const { engine } = await setup();
    const active = engine.profiles.active();
    expect(active).not.toBeNull();
    if (!active) return;
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
    const { engine } = await setup();
    const base: MemberInput = { name: 'Bago', relation: 'relative', ageGroup: 'adult', needs: [] };

    expect(memberErrors(engine.family.saveMember({ ...base, name: '' }))).toContain('name_required');
    expect(memberErrors(engine.family.saveMember({ ...base, name: 'x'.repeat(41) }))).toContain('too_long');
    expect(memberErrors(engine.family.saveMember({ ...base, phone: 'abc' }))).toContain('phone_invalid');
    expect(memberErrors(engine.family.saveMember({ ...base, relation: 'self' }))).toContain('owner_relation');
  });

  it('family.saveMember rejects more members than the documented maximum', async () => {
    const { engine } = await setup();
    let accepted = true;
    for (let i = 0; i < 40 && accepted; i++) {
      const res = engine.family.saveMember({ name: `Kasama ${i}`, relation: 'relative', ageGroup: 'adult', needs: [] });
      accepted = res.ok;
      if (!res.ok) expect(memberErrors(res)).toContain('too_many_members');
    }
    expect(accepted).toBe(false);
  });

  it('members derive household tags and headcount', async () => {
    const { engine } = await setup();
    const before = engine.profiles.active();
    expect(before).not.toBeNull();
    if (!before) return;
    expect(before.headcount).toBe(before.people.length);

    const res = engine.family.saveMember({ name: 'Bata', relation: 'child', ageGroup: 'child', needs: ['pwd'] });
    expect(res.ok).toBe(true);

    const after = engine.profiles.active();
    expect(after).not.toBeNull();
    if (!after) return;
    expect(after.headcount).toBe(before.headcount + 1);
    expect(after.headcount).toBe(after.people.length);
    expect(after.members).toContain('child');
    expect(after.members).toContain('pwd');
  });

  it('buildChecklist names members on items that match their tags', async () => {
    const { engine } = await setup();
    const byId = new Map(engine.family.members().map((m) => [m.id, m]));
    const items = engine.checklist.view().groups.flatMap((group) => group.items);
    const tagged = items.filter((item) => item.forMembers !== undefined);
    expect(tagged.length).toBeGreaterThan(0);

    for (const item of tagged) {
      for (const forMember of item.forMembers ?? []) {
        const member = byId.get(forMember.id);
        expect(member).toBeDefined();
        expect(forMember.name).toBe(member?.name);
      }
    }
  });

  it('a new member is pending until photos.save, and removing the photo makes it pending again', async () => {
    const { engine, ctl } = await setup();
    const added = engine.family.saveMember({ name: 'Bagong Miyembro', relation: 'sibling', ageGroup: 'adult', needs: [] });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const id = added.value.id;

    expect(added.value.photoStatus).toBe('pending');
    expect(engine.family.pending().map((m) => m.id)).toContain(id);

    ctl.setPhotoResult('one_face');
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
    const { engine } = await setup();
    engine.family.photos.removeAll();
    const members = engine.family.members();
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) expect(member.photoStatus).toBe('pending');
    expect(engine.family.pending()).toHaveLength(members.length);
  });

  it('photos.remove returns not_found for a member that does not exist', async () => {
    const { engine } = await setup();
    const res = engine.family.photos.remove('wala');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  it('a pending member blocks nothing else', async () => {
    const { engine } = await setup();
    const pendingId = engine.family.pending()[0]!.id;

    const card = engine.family.card(pendingId);
    expect(card).not.toBeNull();
    if (card) expect(card.member.photoStatus).toBe('pending');

    expect(engine.checklist.view().groups.length).toBeGreaterThan(0);

    const add = engine.family.saveMember({ name: 'Isa pa', relation: 'relative', ageGroup: 'adult', needs: [] });
    expect(add.ok).toBe(true);
  });

  it('removeMember deletes the photo file; the main person cannot be removed', async () => {
    const { engine, ctl } = await setup();
    const ownerId = engine.profiles.active()!.ownerId;

    const owner = engine.family.removeMember(ownerId);
    expect(owner.ok).toBe(false);
    if (!owner.ok) expect(owner.error.code).toBe('owner_required');

    const victim = engine.family.members().find((m) => m.id !== ownerId && m.photo !== undefined);
    expect(victim).toBeDefined();
    if (!victim) return;
    const photoUri = victim.photo!.uri;
    expect(ctl.photoFiles()).toContain(photoUri);

    const removed = engine.family.removeMember(victim.id);
    expect(removed.ok).toBe(true);
    expect(engine.family.members().map((m) => m.id)).not.toContain(victim.id);
    expect(ctl.photoFiles()).not.toContain(photoUri);

    const missing = engine.family.removeMember('wala');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });

  it('family.card returns the card for an existing member and null otherwise', async () => {
    const { engine } = await setup();
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
    const { engine, ctl } = await setup();
    const memberId = engine.family.members()[0]!.id;
    ctl.setPhotoResult(detection);

    const res = await engine.family.photos.start({ memberId }, 'camera');
    expect(res.ok).toBe(true);
    if (!res.ok || !res.value) throw new Error('expected a draft');
    expect(res.value.detection).toBe(detection);
    expect(res.value.memberId).toBe(memberId);
  });

  it.each(PHOTO_ERRORS)('photos.start returns error %s from setPhotoResult', async (code) => {
    const { engine, ctl } = await setup();
    const memberId = engine.family.members()[0]!.id;
    ctl.setPhotoResult(code);

    const res = await engine.family.photos.start({ memberId }, 'gallery');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(code);
  });

  it('one_face gives a suggested crop and save records faceCheck one_face', async () => {
    const { engine, ctl } = await setup();
    const memberId = engine.family.pending()[0]!.id;
    ctl.setPhotoResult('one_face');

    const started = await engine.family.photos.start({ memberId }, 'camera');
    expect(started.ok).toBe(true);
    if (!started.ok || !started.value) throw new Error('expected a draft');
    expect(started.value.detection).toBe('one_face');
    expect(typeof started.value.suggestedCrop.width).toBe('number');
    expect(typeof started.value.suggestedCrop.height).toBe('number');

    const saved = await engine.family.photos.save(started.value.draftId, started.value.suggestedCrop);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.faceCheck).toBe('one_face');
  });

  it.each(['no_face', 'many_faces', 'unavailable'] as const)(
    'a %s detection needs a manual crop and save records faceCheck manual',
    async (detection) => {
      const { engine, ctl } = await setup();
      const memberId = engine.family.pending()[0]!.id;
      ctl.setPhotoResult(detection);

      const started = await engine.family.photos.start({ memberId }, 'camera');
      expect(started.ok).toBe(true);
      if (!started.ok || !started.value) throw new Error('expected a draft');
      expect(started.value.detection).toBe(detection);

      const saved = await engine.family.photos.save(started.value.draftId, started.value.suggestedCrop);
      expect(saved.ok).toBe(true);
      if (saved.ok) expect(saved.value.faceCheck).toBe('manual');
    },
  );

  it('profiles.create, save and remove fire onChange(profiles)', async () => {
    const { engine } = await setup();
    const { changes, stop } = recorder(engine);
    const active = engine.profiles.active();
    expect(active).not.toBeNull();
    if (!active) return;

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

  it('family and photo mutations fire onChange(family)', async () => {
    const { engine, ctl } = await setup();
    const { changes, stop } = recorder(engine);
    const pendingId = engine.family.pending()[0]!.id;

    changes.length = 0;
    const added = engine.family.saveMember({ name: 'X', relation: 'relative', ageGroup: 'adult', needs: [] });
    expect(added.ok).toBe(true);
    expect(changes).toContain('family');

    ctl.setPhotoResult('one_face');
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
    const { engine } = await setup();
    const memberId = engine.family.members()[0]!.id;

    const ok = await engine.family.shareCard(memberId, { current: null });
    expect(ok.ok).toBe(true);

    const missing = await engine.family.shareCard('wala', { current: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });

  it('location.get returns the fixture household location', async () => {
    const { engine } = await setup();
    const location = engine.family.location.get();
    expect(location).not.toBeNull();
    if (location) expect(typeof location.psgc).toBe('string');
  });

  it('location.setArea stores a fixture barangay and rejects an unknown PSGC', async () => {
    const { engine } = await setup();

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
    expect(engine.family.location.get()?.psgc).toBe(psgc);
  });

  it('location.setArea fires onChange(profiles)', async () => {
    const { engine } = await setup();
    const { changes, stop } = recorder(engine);

    changes.length = 0;
    const res = engine.family.location.setArea(anyBarangay(engine));
    expect(res.ok).toBe(true);
    expect(changes).toContain('profiles');

    stop();
  });
});
