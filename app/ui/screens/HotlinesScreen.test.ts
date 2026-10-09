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
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }) }));
vi.mock('../context/AppChrome', () => ({ AppBanners: 'AppBanners', StatusBadges: 'StatusBadges' }));

import type { Profile } from '../../engine';
import { errorMessage } from '../strings/errors';
import {
  buildPlanInput,
  contactPhoneError,
  hasContactsError,
  isPlanEmpty,
  planDraftFrom,
} from './HotlinesScreen';

function profileWith(plan: Profile['plan']): Profile {
  return {
    id: 'household-test',
    name: 'Bahay namin',
    ownerId: 'member-self',
    people: [],
    petsCount: 0,
    headcount: 0,
    members: [],
    home: [],
    location: null,
    plan,
    updatedAt: '2026-10-09T00:00:00+08:00',
  };
}

describe('isPlanEmpty', () => {
  it('is empty when nothing is set', () => {
    expect(isPlanEmpty({ contacts: [] })).toBe(true);
  });

  it('is not empty once a field or a contact is set', () => {
    expect(isPlanEmpty({ contacts: [], evacuationCenter: 'Barangay Hall' })).toBe(false);
    expect(isPlanEmpty({ contacts: [{ name: 'Ana', phone: '0000000000' }] })).toBe(false);
  });
});

describe('planDraftFrom', () => {
  it('copies the plan fields and clones the contacts', () => {
    const plan: Profile['plan'] = {
      evacuationCenter: 'Barangay Hall',
      meetingPlace: 'Simbahan',
      contacts: [{ name: 'Ana', phone: '0000000000', relation: 'Kapatid' }],
    };
    const draft = planDraftFrom(profileWith(plan));
    expect(draft).toEqual({ evacuationCenter: 'Barangay Hall', meetingPlace: 'Simbahan', contacts: plan.contacts });
    expect(draft.contacts[0]).not.toBe(plan.contacts[0]);
  });
});

describe('buildPlanInput', () => {
  it('trims values, drops blank contacts and deletes blank optionals', () => {
    const profile = profileWith({ contacts: [], evacuationCenterId: 'center-1' });
    const input = buildPlanInput(profile, {
      evacuationCenter: '  Barangay Hall  ',
      meetingPlace: '   ',
      contacts: [
        { name: '  Ana  ', phone: ' 0000000000 ', relation: '  Kapatid  ' },
        { name: '   ', phone: '0000000001' },
      ],
    });
    expect(input).toEqual({
      id: profile.id,
      name: profile.name,
      petsCount: profile.petsCount,
      home: profile.home,
      plan: {
        evacuationCenterId: 'center-1',
        evacuationCenter: 'Barangay Hall',
        contacts: [{ name: 'Ana', phone: '0000000000', relation: 'Kapatid' }],
      },
    });
  });

  it('keeps the household fields from the profile', () => {
    const profile = profileWith({ contacts: [] });
    const input = buildPlanInput(profile, { evacuationCenter: '', meetingPlace: 'Simbahan', contacts: [] });
    expect(input.id).toBe(profile.id);
    expect(input.name).toBe(profile.name);
    expect(input.home).toEqual(profile.home);
    expect(input.plan.meetingPlace).toBe('Simbahan');
    expect(input.plan.evacuationCenter).toBeUndefined();
  });
});

describe('contactPhoneError', () => {
  const errors = [{ code: 'contact_phone_invalid', field: 'plan.contacts.1.phone' }];

  it('matches the error to the exact contact', () => {
    expect(contactPhoneError(errors, 1, 'tl')).toBe(errorMessage('tl', 'validation', 'contact_phone_invalid'));
    expect(contactPhoneError(errors, 1, 'en')).toBe(errorMessage('en', 'validation', 'contact_phone_invalid'));
  });

  it('is undefined for another contact', () => {
    expect(contactPhoneError(errors, 0, 'tl')).toBeUndefined();
  });
});

describe('hasContactsError', () => {
  it('detects the too-many-contacts rejection', () => {
    expect(hasContactsError([{ code: 'too_many_contacts', field: 'plan.contacts' }])).toBe(true);
    expect(hasContactsError([])).toBe(false);
  });
});
