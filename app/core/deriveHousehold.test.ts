import { describe, expect, it } from 'vitest';
import type { Member } from '../types';
import { deriveHousehold, memberTags } from './deriveHousehold';
import { toManilaIso } from './time';

const m = (id: string, ageGroup: Member['ageGroup'], needs: Member['needs'] = []): Member => ({
  id, name: id, relation: 'other', ageGroup, needs, photoStatus: 'pending',
  updatedAt: '2026-10-09T00:00:00+08:00',
});

describe('deriveHousehold', () => {
  it('derives tags in union order with pets and headcount', () => {
    const r = deriveHousehold([m('a', 'senior', ['maintenance_meds']), m('b', 'infant')], 1);
    expect(r).toEqual({ members: ['infant', 'senior', 'maintenance_meds', 'pets'], headcount: 2 });
  });

  it('dedups and omits pets when none; teen/adult add nothing', () => {
    const r = deriveHousehold([m('a', 'child'), m('b', 'child', ['pwd']), m('c', 'adult'), m('d', 'teen')], 0);
    expect(r).toEqual({ members: ['child', 'pwd'], headcount: 4 });
  });

  it('memberTags never includes pets', () => {
    expect(memberTags(m('a', 'adult', ['pregnant']))).toEqual(['pregnant']);
  });
});

describe('toManilaIso', () => {
  it('formats in UTC+8', () => {
    expect(toManilaIso(new Date('2026-10-09T17:05:09Z'))).toBe('2026-10-10T01:05:09+08:00');
  });
});
