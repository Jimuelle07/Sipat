import type { AgeGroup, Contact, HomeTag, Member, MemberInput, NeedTag, Profile, ProfileInput, Relation } from '../../../engine';

/**
 * Pure form models for the Family tab, the member editor and setup. No React or
 * React Native imports so they run unchanged in Vitest, and no engine calls.
 */

export const MIN_PETS = 0;
export const MAX_PETS = 20;

export interface MemberDraft {
  id?: string;
  name: string;
  relation: Relation;
  ageGroup: AgeGroup;
  needs: NeedTag[];
  note: string;
  phone: string;
}

export interface HouseholdDraft {
  name: string;
  petsCount: number;
  home: HomeTag[];
  evacuationCenter: string;
  meetingPlace: string;
  contacts: Contact[];
}

export function blankMemberDraft(): MemberDraft {
  return { name: '', relation: 'other', ageGroup: 'adult', needs: [], note: '', phone: '' };
}

export function memberDraftFrom(member: Member): MemberDraft {
  return {
    id: member.id,
    name: member.name,
    relation: member.relation,
    ageGroup: member.ageGroup,
    needs: [...member.needs],
    note: member.note ?? '',
    phone: member.phone ?? '',
  };
}

export function memberInputFrom(draft: MemberDraft): MemberInput {
  const input: MemberInput = {
    name: draft.name.trim(),
    relation: draft.relation,
    ageGroup: draft.ageGroup,
    needs: [...draft.needs],
  };
  if (draft.id !== undefined) input.id = draft.id;
  const note = draft.note.trim();
  if (note.length > 0) input.note = note;
  const phone = draft.phone.trim();
  if (phone.length > 0) input.phone = phone;
  return input;
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function householdDraftFrom(profile: Profile): HouseholdDraft {
  return {
    name: profile.name,
    petsCount: profile.petsCount,
    home: [...profile.home],
    evacuationCenter: profile.plan.evacuationCenter ?? '',
    meetingPlace: profile.plan.meetingPlace ?? '',
    contacts: profile.plan.contacts.map((contact) => ({ ...contact })),
  };
}

export function buildProfileInput(profile: Profile, draft: HouseholdDraft): ProfileInput {
  const contacts: Contact[] = [];
  for (const contact of draft.contacts) {
    const name = contact.name.trim();
    if (name.length === 0) continue;
    const next: Contact = { name, phone: contact.phone.trim() };
    const relation = contact.relation?.trim();
    if (relation !== undefined && relation.length > 0) next.relation = relation;
    contacts.push(next);
  }
  const plan: Profile['plan'] = { ...profile.plan, contacts };
  const evacuationCenter = draft.evacuationCenter.trim();
  if (evacuationCenter.length > 0) plan.evacuationCenter = evacuationCenter;
  else delete plan.evacuationCenter;
  const meetingPlace = draft.meetingPlace.trim();
  if (meetingPlace.length > 0) plan.meetingPlace = meetingPlace;
  else delete plan.meetingPlace;
  return {
    id: profile.id,
    name: draft.name.trim(),
    petsCount: clampNumber(draft.petsCount, MIN_PETS, MAX_PETS),
    home: [...draft.home],
    plan,
  };
}

/** Uppercase initials for the avatar fallback: first and last name pieces, best effort. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  return `${first}${last}`.toUpperCase();
}
