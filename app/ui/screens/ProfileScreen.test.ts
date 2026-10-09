import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import type { Member, Profile } from '../../engine';
import { commonStrings } from '../strings/common';
import { profileStrings } from '../strings/profile';
import {
  blankMemberDraft,
  buildProfileInput,
  clampNumber,
  errorMessage,
  fieldErrorLines,
  householdDraftFrom,
  memberDraftFrom,
  memberInputFrom,
  parseSettingNumber,
  toggleInList,
} from './ProfileScreen';

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
  it('maps known codes and falls back for unknown ones', () => {
    expect(errorMessage('owner_required')).toBe(profileStrings.tl.error_owner_required);
    expect(errorMessage('out_of_range')).toBe(profileStrings.tl.error_out_of_range);
    expect(errorMessage('mystery')).toBe(profileStrings.tl.error_unknown);
  });

  it('labels each field path and keeps every error', () => {
    const lines = fieldErrorLines([
      { code: 'name_required', field: 'owner.name' },
      { code: 'pets_range', field: 'petsCount' },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`${profileStrings.tl.fieldName}: ${commonStrings.tl.error_name_required}`);
    expect(lines[1]).toBe(`${commonStrings.tl.petsCount}: ${commonStrings.tl.error_pets_range}`);
  });
});

describe('parseSettingNumber', () => {
  it('accepts numbers and trims whitespace', () => {
    expect(parseSettingNumber('15')).toBe(15);
    expect(parseSettingNumber(' 3 ')).toBe(3);
  });

  it('rejects empty or non-numeric text', () => {
    expect(parseSettingNumber('')).toBeNull();
    expect(parseSettingNumber('   ')).toBeNull();
    expect(parseSettingNumber('abc')).toBeNull();
  });
});
