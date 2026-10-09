import { describe, expect, it } from 'vitest';
import type {
  ChecklistItemView,
  ChecklistView,
  CopyKey,
  Member,
  Profile,
} from '../types';
import { deriveHousehold } from '../core/deriveHousehold';
import { strings as uiStrings } from '../ui/strings';
const strings = uiStrings.tl;
import { exportChecklistText, exportHouseholdSms } from './exportText';

const noCopy = (_key: CopyKey): string => '';

function member(
  id: string,
  name: string,
  relation: Member['relation'],
  ageGroup: Member['ageGroup'],
  needs: Member['needs'] = [],
  note?: string,
): Member {
  const m: Member = { id, name, relation, ageGroup, needs, updatedAt: '2026-10-09T00:00:00+08:00' };
  if (note !== undefined) m.note = note;
  return m;
}

function profile(people: Member[], evacuationCenter?: string): Profile {
  const { members, headcount } = deriveHousehold(people, 0);
  const plan: Profile['plan'] =
    evacuationCenter === undefined ? { contacts: [] } : { evacuationCenter, contacts: [] };
  return {
    id: 'hh-a',
    name: 'Bahay namin',
    ownerId: people[0]!.id,
    people,
    petsCount: 0,
    headcount,
    members,
    home: [],
    livelihood: [],
    plan,
    updatedAt: '2026-10-09T00:00:00+08:00',
  };
}

const HOUSEHOLD = profile(
  [
    member('a1', 'Ana', 'self', 'adult'),
    member('a2', 'Paolo', 'spouse', 'adult'),
    member('a3', 'Bunso', 'child', 'infant'),
    member('a4', 'Lola Nena', 'parent', 'senior', ['maintenance_meds'], 'gamot sa altapresyon'),
  ],
  'Barangay Hall',
);

const MEMBER_TEXT = ['Ana', 'Paolo', 'Bunso', 'Lola Nena', 'gamot sa altapresyon'];

describe('exportHouseholdSms', () => {
  it('safe names the headcount, location and household, not members', () => {
    const body = exportHouseholdSms(HOUSEHOLD, 'safe', { copy: noCopy });
    expect(body).toBe('Ligtas kami, 4 tao. Nasa Barangay Hall. - Bahay namin');
    for (const text of MEMBER_TEXT) expect(body).not.toContain(text);
  });

  it('need_help counts the vulnerable by need, not members', () => {
    const body = exportHouseholdSms(HOUSEHOLD, 'need_help', { copy: noCopy });
    expect(body).toBe(
      'TULONG: 4 tao sa Barangay Hall. May 1 sanggol, 1 senior, 1 may maintenance na gamot. - Bahay namin',
    );
    for (const text of MEMBER_TEXT) expect(body).not.toContain(text);
  });

  it('falls back to the plan evacuation center when where is omitted', () => {
    expect(exportHouseholdSms(HOUSEHOLD, 'safe', { copy: noCopy })).toContain('Barangay Hall');
  });

  it('prefers an explicit where over the plan', () => {
    const body = exportHouseholdSms(HOUSEHOLD, 'safe', { where: 'Eskwelahan', copy: noCopy });
    expect(body).toContain('Eskwelahan');
    expect(body).not.toContain('Barangay Hall');
  });

  it('drops the location clause when there is no where at all', () => {
    const homeless = profile(
      [member('b1', 'Ana', 'self', 'adult'), member('b2', 'Bunso', 'child', 'infant')],
    );
    expect(exportHouseholdSms(homeless, 'safe', { copy: noCopy })).toBe('Ligtas kami, 2 tao. - Bahay namin');
    expect(exportHouseholdSms(homeless, 'need_help', { copy: noCopy })).toBe(
      'TULONG: 2 tao. May 1 sanggol. - Bahay namin',
    );
  });

  it('says "wala" when nobody is vulnerable', () => {
    const adults = profile([member('c1', 'Ana', 'self', 'adult'), member('c2', 'Paolo', 'spouse', 'adult')]);
    expect(exportHouseholdSms(adults, 'need_help', { copy: noCopy })).toBe(
      'TULONG: 2 tao. May wala. - Bahay namin',
    );
  });

  it('stays within one GSM-7 SMS (160 chars) for this household', () => {
    expect(exportHouseholdSms(HOUSEHOLD, 'safe', { copy: noCopy }).length).toBeLessThanOrEqual(160);
    expect(exportHouseholdSms(HOUSEHOLD, 'need_help', { copy: noCopy }).length).toBeLessThanOrEqual(160);
  });
});

function item(id: string, text: string, ticked: boolean, extra: Partial<ChecklistItemView> = {}): ChecklistItemView {
  return { id, text, priority: 1, critical: false, ticked, sourceId: 'src', ...extra };
}

function view(groups: ChecklistView['groups'], progress = { done: 0, total: 0 }): ChecklistView {
  return { warningCards: [], groups, progress };
}

describe('exportChecklistText', () => {
  const sample = view([
    {
      id: 'now',
      items: [item('now-1', 'Makinig sa radyo', true), item('now-2', 'I-charge ang phone', false)],
    },
    {
      id: 'go_bag',
      items: [
        item('gobag-water', 'Inuming tubig', false, {
          quantityText: '2 litro × 5 tao × 3 araw = 30 litro',
        }),
        item('gobag-meds', 'Maintenance na gamot', true, {
          forMembers: [{ id: 'a4', name: 'Lola Nena' }],
        }),
      ],
    },
  ]);

  it('prints a title first when given', () => {
    const text = exportChecklistText(sample, { title: 'Mga dapat gawin' });
    expect(text.startsWith('Mga dapat gawin\n\n')).toBe(true);
  });

  it('groups under the UI headings, in ChecklistView order', () => {
    const text = exportChecklistText(sample);
    const nowAt = text.indexOf(strings.group_now);
    const bagAt = text.indexOf(strings.group_go_bag);
    expect(nowAt).toBeGreaterThanOrEqual(0);
    expect(bagAt).toBeGreaterThan(nowAt);
  });

  it('renders ticks, quantities and the members an item is for', () => {
    const text = exportChecklistText(sample);
    expect(text).toContain('[x] Makinig sa radyo');
    expect(text).toContain('[ ] I-charge ang phone');
    expect(text).toContain('[ ] Inuming tubig — 2 litro × 5 tao × 3 araw = 30 litro');
    expect(text).toContain('[x] Maintenance na gamot — para kay Lola Nena');
  });

  it('returns an empty string for an empty view and no title', () => {
    expect(exportChecklistText(view([]))).toBe('');
  });
});
