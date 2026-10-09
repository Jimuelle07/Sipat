import type { Member, MemberTag } from '../types';

const ORDER: readonly MemberTag[] = ['infant', 'child', 'pregnant', 'senior', 'pwd', 'maintenance_meds', 'pets'];

/** Tags a single person contributes (never 'pets'), in MemberTag union order. */
export function memberTags(member: Member): MemberTag[] {
  const tags = new Set<MemberTag>(member.needs);
  if (member.ageGroup === 'infant' || member.ageGroup === 'child' || member.ageGroup === 'senior') {
    tags.add(member.ageGroup);
  }
  return ORDER.filter((t) => tags.has(t));
}

export function deriveHousehold(
  people: Member[],
  petsCount: number,
): { members: MemberTag[]; headcount: number } {
  const tags = new Set<MemberTag>();
  for (const p of people) for (const t of memberTags(p)) tags.add(t);
  if (petsCount > 0) tags.add('pets');
  return { members: ORDER.filter((t) => tags.has(t)), headcount: people.length };
}
