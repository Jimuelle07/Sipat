import { describe, expect, it } from 'vitest';

import type { Member, Profile } from '../../engine';
import { errorMessage } from '../strings/errors';
import {
  blankMemberDraft,
  buildProfileInput,
  clampNumber,
  householdDraftFrom,
  initialsOf,
  memberDraftFrom,
  memberInputFrom,
  toggleInList,
} from './family/profileModel';

const profile: Profile = {
  id: 'household-1',
  name: 'Bahay namin',
  ownerId: 'member-1',
  people: [],
  petsCount: 2,
  headcount: 1,
  members: [],
  home: ['near_river', 'concrete'],
  location: null,
  plan: {
    evacuationCenter: 'Brgy Hall',
    evacuationCenterId: 'ec-9',
    meetingPlace: 'Simbahan',
    contacts: [{ name: 'Ate', phone: '09171234567', relation: 'sister' }],
  },
  updatedAt: '2026-10-09T00:00:00+08:00',
};

describe('toggleInList', () => {
  it('adds a missing value without mutating the source', () => {
    const base: readonly string[] = ['a'];
    const added = toggleInList(base, 'b');
    expect(added).toEqual(['a', 'b']);
    expect(base).toEqual(['a']);
  });

  it('removes a present value', () => {
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('clampNumber', () => {
  it('clamps to the range and rounds', () => {
    expect(clampNumber(4, 5, 50)).toBe(5);
    expect(clampNumber(51, 5, 50)).toBe(50);
    expect(clampNumber(15.6, 5, 50)).toBe(16);
    expect(clampNumber(2.4, 0, 20)).toBe(2);
  });

  it('falls back to the minimum for non-finite input', () => {
    expect(clampNumber(Number.NaN, 5, 50)).toBe(5);
    expect(clampNumber(Number.POSITIVE_INFINITY, 5, 50)).toBe(50);
  });
});

describe('member drafts', () => {
  it('starts a new member with safe defaults', () => {
    expect(blankMemberDraft()).toEqual({
      name: '',
      relation: 'other',
      ageGroup: 'adult',
      needs: [],
      note: '',
      phone: '',
    });
  });

  it('maps a member to a draft and back, trimming optionals and keeping the id', () => {
    const member: Member = {
      id: 'member-2',
      name: 'Ana',
      relation: 'child',
      ageGroup: 'child',
      needs: ['pwd'],
      note: '  allergy  ',
      phone: '09171234567',
      photoStatus: 'done',
      updatedAt: '2026-10-09T00:00:00+08:00',
    };
    const draft = memberDraftFrom(member);
    expect(draft).toEqual({
      id: 'member-2',
      name: 'Ana',
      relation: 'child',
      ageGroup: 'child',
      needs: ['pwd'],
      note: '  allergy  ',
      phone: '09171234567',
    });
    expect(memberInputFrom(draft)).toEqual({
      id: 'member-2',
      name: 'Ana',
      relation: 'child',
      ageGroup: 'child',
      needs: ['pwd'],
      note: 'allergy',
      phone: '09171234567',
    });
  });

  it('omits empty optional fields when creating a member', () => {
    const input = memberInputFrom({ ...blankMemberDraft(), name: '  Bob  ' });
    expect(input.name).toBe('Bob');
    expect(input.id).toBeUndefined();
    expect('note' in input).toBe(false);
    expect('phone' in input).toBe(false);
    expect(input.needs).toEqual([]);
  });

  it('copies the needs array so edits do not leak back', () => {
    const draft = { ...blankMemberDraft(), needs: ['pwd'] as Member['needs'] };
    const input = memberInputFrom(draft);
    input.needs.push('pregnant');
    expect(draft.needs).toEqual(['pwd']);
  });
});

describe('household draft and profile input', () => {
  it('reads the editable fields from the profile', () => {
    expect(householdDraftFrom(profile)).toEqual({
      name: 'Bahay namin',
      petsCount: 2,
      home: ['near_river', 'concrete'],
      evacuationCenter: 'Brgy Hall',
      meetingPlace: 'Simbahan',
      contacts: [{ name: 'Ate', phone: '09171234567', relation: 'sister' }],
    });
  });

  it('trims, clamps and preserves plan fields not shown in the form', () => {
    const draft = {
      ...householdDraftFrom(profile),
      name: '  Bahay ni Lola  ',
      petsCount: 99,
      evacuationCenter: '   ',
      meetingPlace: '  Plaza  ',
      contacts: [
        { name: '  Bob  ', phone: ' 0917  ', relation: '  anak  ' },
        { name: '   ', phone: '' },
      ],
    };
    const input = buildProfileInput(profile, draft);
    expect(input.name).toBe('Bahay ni Lola');
    expect(input.petsCount).toBe(20);
    expect('evacuationCenter' in input.plan).toBe(false);
    expect(input.plan.evacuationCenterId).toBe('ec-9');
    expect(input.plan.meetingPlace).toBe('Plaza');
    expect(input.plan.contacts).toEqual([{ name: 'Bob', phone: '0917', relation: 'anak' }]);
  });

  it('keeps an empty contact list and drops unset plan strings', () => {
    const draft = {
      ...householdDraftFrom(profile),
      evacuationCenter: '',
      meetingPlace: '',
      contacts: [],
    };
    const input = buildProfileInput(profile, draft);
    expect(input.plan.contacts).toEqual([]);
    expect('meetingPlace' in input.plan).toBe(false);
  });
});

describe('error copy', () => {
  it('maps known validation codes and falls back for unknown ones', () => {
    expect(errorMessage('tl', 'validation', 'name_required')).toBe('Lagyan ng pangalan.');
    expect(errorMessage('tl', 'family', 'owner_required')).toBe('Hindi puwedeng burahin ang pangunahing tao.');
    expect(errorMessage('tl', 'validation', 'mystery')).toBe(errorMessage('tl', 'validation', 'unknown'));
  });
});

describe('initialsOf', () => {
  it('takes the first and last initials, best effort', () => {
    expect(initialsOf('Ana Reyes')).toBe('AR');
    expect(initialsOf('Ana')).toBe('A');
    expect(initialsOf('  ')).toBe('');
  });
});
