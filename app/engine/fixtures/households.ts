import type { Member, MemberPhoto, Profile } from '../../types';
import { deriveHousehold } from '../../core/deriveHousehold';

/** A placeholder photo on the phone only; the mock never opens a camera. */
export const FIXTURE_PHOTO: MemberPhoto = {
  uri: 'fixture://photos/lola.jpg',
  bytes: 0,
  source: 'gallery',
  faceCheck: 'one_face',
  takenAt: '2026-10-09T00:00:00+08:00',
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
  const m: Member = { id, name, relation, ageGroup, needs, updatedAt: '2026-10-09T00:00:00+08:00' };
  if (extra.note !== undefined) m.note = extra.note;
  if (extra.phone !== undefined) m.phone = extra.phone;
  if (extra.photo !== undefined) m.photo = extra.photo;
  return m;
}

function profile(
  id: string,
  name: string,
  ownerId: string,
  people: Member[],
  petsCount: number,
  home: Profile['home'],
  plan: Profile['plan'],
): Profile {
  const { members, headcount } = deriveHousehold(people, petsCount);
  return {
    id,
    name,
    ownerId,
    people,
    petsCount,
    headcount,
    members,
    home,
    livelihood: [],
    plan,
    updatedAt: '2026-10-09T00:00:00+08:00',
  };
}

/** Two households of four members each (docs/api-layer.md section 3.6). Fresh copies every call. */
export function fixtureHouseholds(): Profile[] {
  const a = profile(
    'hh-a',
    'Bahay namin',
    'a1',
    [
      member('a1', 'Mika', 'self', 'adult'),
      member('a2', 'Paolo', 'spouse', 'adult'),
      member('a3', 'Bunso', 'child', 'infant'),
      member('a4', 'Lola Nena', 'parent', 'senior', ['maintenance_meds'], {
        note: 'gamot sa altapresyon',
        photo: FIXTURE_PHOTO,
      }),
    ],
    1,
    ['near_river', 'light_materials'],
    { evacuationCenter: 'Barangay Hall', contacts: [] },
  );

  const b = profile(
    'hh-b',
    'Bahay nina Lola',
    'b1',
    [
      member('b1', 'Lola Iska', 'self', 'adult'),
      member('b2', 'Mang Tino', 'spouse', 'adult'),
      member('b3', 'Ate Rosa', 'child', 'adult'),
      member('b4', 'Kuya Jun', 'sibling', 'adult', ['pwd']),
    ],
    0,
    ['near_sea', 'concrete'],
    { evacuationCenter: 'Bahay ng Kapitana', contacts: [] },
  );

  return [a, b];
}
