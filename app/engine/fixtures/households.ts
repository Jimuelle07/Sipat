// Placeholder fixture data for the mock engine and tests. Not official content.
import type { DamageDraft, Member, MemberPhoto, Profile } from '../../types/index.ts';
import { deriveHousehold } from '../../core/deriveHousehold.ts';
import { FIXTURE_PLACES } from './content.ts';

const AT = '2026-10-09T00:00:00+08:00';

/** A placeholder photo stored on the phone only; the mock never opens a camera. */
export const FIXTURE_PHOTO: MemberPhoto = {
  uri: 'fixture://photos/sample.jpg',
  bytes: 0,
  source: 'gallery',
  faceCheck: 'one_face',
  takenAt: AT,
  version: 1,
};

function member(
  id: string,
  name: string,
  relation: Member['relation'],
  ageGroup: Member['ageGroup'],
  needs: Member['needs'] = [],
  extra: { note?: string; phone?: string; photo?: MemberPhoto } = {},
): Member {
  const photo = extra.photo;
  const m: Member = {
    id,
    name,
    relation,
    ageGroup,
    needs,
    photoStatus: photo ? 'done' : 'pending',
    updatedAt: AT,
  };
  if (extra.note !== undefined) m.note = extra.note;
  if (extra.phone !== undefined) m.phone = extra.phone;
  if (photo !== undefined) m.photo = photo;
  return m;
}

/**
 * One household of 4 members: the main person, two others with placeholder photos and exactly one
 * member still pending (docs/api-layer.md section 3.6). A fresh copy every call.
 */
export function fixtureProfile(): Profile {
  const people: Member[] = [
    member('member-self', 'Nena', 'self', 'adult', [], {
      phone: '0000000000',
      photo: { ...FIXTURE_PHOTO, uri: 'fixture://photos/member-self.jpg' },
    }),
    member('member-child', 'Totoy', 'child', 'child', [], {
      photo: { ...FIXTURE_PHOTO, uri: 'fixture://photos/member-child.jpg' },
    }),
    member('member-senior', 'Lola Ising', 'parent', 'senior', ['maintenance_meds'], {
      note: 'gamot sa presyon',
      photo: { ...FIXTURE_PHOTO, uri: 'fixture://photos/member-senior.jpg' },
    }),
    member('member-infant', 'Baby Joy', 'child', 'infant'),
  ];
  const { members, headcount } = deriveHousehold(people, 0);
  const homeArea = FIXTURE_PLACES.items.find((p) => p.level === 'barangay');
  return {
    id: 'household-sample',
    name: 'Bahay namin (SAMPLE)',
    ownerId: 'member-self',
    people,
    petsCount: 0,
    headcount,
    members,
    home: ['near_river'],
    location: homeArea ? { psgc: homeArea.psgc } : null,
    plan: {
      evacuationCenter: 'SAMPLE Barangay Hall (placeholder)',
      contacts: [],
    },
    updatedAt: AT,
  };
}

/** Exactly one unsent damage report draft (Pilot) so the damage screen has data. */
export function fixtureDamageDrafts(): DamageDraft[] {
  return [
    {
      id: 'damage-sample-1',
      createdAt: '2026-10-10T07:00:00+08:00',
      damageType: 'wind',
      severity: 'light',
      affectedMembers: 1,
      notes: 'SAMPLE – placeholder damage note',
      photoPaths: [],
      sentAt: null,
    },
  ];
}
