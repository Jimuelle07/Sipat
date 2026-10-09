import { describe, expect, it } from 'vitest';
import { buildChecklist, PHASE_GROUPS } from './checklist.ts';
import { deriveHousehold } from './deriveHousehold.ts';
import type {
  ChecklistGroupId,
  ChecklistItem,
  ChecklistTick,
  ChecklistView,
  Context,
  HomeTag,
  Member,
  NeedTag,
  Phase,
  Profile,
  WarningEntry,
  WarningKind,
} from '../types/index.ts';

const AT = '2026-10-10T08:00:00+08:00';
const NOW = new Date(AT);
const STALE_HOURS = 3;

function member(
  id: string,
  name: string,
  relation: Member['relation'],
  ageGroup: Member['ageGroup'],
  needs: NeedTag[] = [],
  note?: string,
): Member {
  const m: Member = { id, name, relation, ageGroup, needs, photoStatus: 'pending', updatedAt: AT };
  if (note !== undefined) m.note = note;
  return m;
}

function profile(people: Member[], home: HomeTag[] = []): Profile {
  const { members, headcount } = deriveHousehold(people, 0);
  return {
    id: 'p1',
    name: 'Bahay namin',
    ownerId: people[0]?.id ?? 'self',
    people,
    petsCount: 0,
    headcount,
    members,
    home,
    location: null,
    plan: { contacts: [] },
    updatedAt: AT,
  };
}

function item(
  id: string,
  group: ChecklistGroupId,
  phase: Phase[],
  priority: 1 | 2 | 3,
  extra: Partial<ChecklistItem> = {},
): ChecklistItem {
  const base: ChecklistItem = {
    id,
    text: `Gawin: ${id}`,
    group,
    phase,
    priority,
    critical: false,
    source_id: 'src-placeholder',
  };
  return { ...base, ...extra } as ChecklistItem;
}

function warning(
  id: string,
  kind: WarningKind,
  level: WarningEntry['level'],
  extra: Partial<WarningEntry> = {},
): WarningEntry {
  return {
    id,
    kind,
    level,
    label: `Babala ${id}`,
    meaning: 'placeholder: from source',
    actions: ['(fill in)'],
    source_id: 'src-placeholder',
    confirmed: true,
    ...extra,
  };
}

function ctx(phase: Phase, warnings: Context['warnings'] = {}): Context {
  return {
    phase,
    phaseSource: 'manual',
    reason: { source: 'manual', text: '' },
    changedAt: AT,
    recommended: null,
    suppressed: [],
    warnings,
  };
}

function build(
  p: Profile,
  c: Context,
  items: ChecklistItem[],
  warnings: WarningEntry[] = [],
  ticks: Record<string, ChecklistTick> = {},
): ChecklistView {
  return buildChecklist(p, c, items, warnings, ticks, NOW, STALE_HOURS);
}

const group = (v: ChecklistView, id: ChecklistGroupId) => v.groups.find((g) => g.id === id);
const groupIds = (v: ChecklistView) => v.groups.map((g) => g.id);
const idsIn = (v: ChecklistView, id: ChecklistGroupId) => group(v, id)?.items.map((i) => i.id) ?? [];
const showIds = (v: ChecklistView) => v.groups.flatMap((g) => g.items.map((i) => i.id));

const self = member('self', 'Ana', 'self', 'adult');
const base = () => profile([self]);

const ORDER_AT = '2026-10-10T07:00:00+08:00';

const ITEMS: ChecklistItem[] = [
  item('b1', 'go_bag', ['before'], 1),
  item('b2', 'go_bag', ['before'], 2),
  item('h1', 'home', ['before'], 1),
  item('e1', 'evacuate', ['before', 'during'], 1),
  item('e2', 'evacuate', ['during'], 2),
  item('f1', 'after', ['after'], 1),
];

describe('PHASE_GROUPS', () => {
  it('leads with now in every phase, then the recommended groups in order', () => {
    expect(PHASE_GROUPS).toEqual({
      before: ['now', 'go_bag', 'home'],
      during: ['now', 'evacuate'],
      after: ['now', 'after'],
    });
  });
});

describe('buildChecklist', () => {
  it('leads every phase with a recommended now group, then the recommended groups, then others', () => {
    const before = build(base(), ctx('before'), ITEMS);
    expect(before.phase).toBe('before');
    expect(groupIds(before)[0]).toBe('now');
    expect(group(before, 'now')?.recommended).toBe(true);
    expect(group(before, 'go_bag')?.recommended).toBe(true);
    expect(group(before, 'home')?.recommended).toBe(true);
    expect(group(before, 'evacuate')?.recommended).toBe(false);
    expect(groupIds(before).indexOf('evacuate')).toBeGreaterThan(groupIds(before).indexOf('home'));
    expect(groupIds(before)).not.toContain('after');
  });

  it('during recommends now and evacuate', () => {
    const during = build(base(), ctx('during'), ITEMS);
    expect(during.phase).toBe('during');
    expect(groupIds(during)).toEqual(['now', 'evacuate']);
    expect(group(during, 'now')?.recommended).toBe(true);
    expect(group(during, 'evacuate')?.recommended).toBe(true);
  });

  it('after recommends now and after', () => {
    const after = build(base(), ctx('after'), ITEMS);
    expect(after.phase).toBe('after');
    expect(groupIds(after)).toEqual(['now', 'after']);
    expect(group(after, 'now')?.recommended).toBe(true);
    expect(group(after, 'after')?.recommended).toBe(true);
  });

  it('shows only items whose phase list includes the current phase', () => {
    const v = build(base(), ctx('after'), ITEMS);
    expect(showIds(v)).toContain('f1');
    expect(showIds(v)).not.toContain('b1');
    expect(showIds(v)).not.toContain('e1');
  });

  it('fills now with the top items of the recommended groups, keeping the full groups below', () => {
    const fixture: ChecklistItem[] = [
      item('g1', 'go_bag', ['before'], 1),
      item('g2', 'go_bag', ['before'], 2),
      item('h1', 'home', ['before'], 1),
      item('h3', 'home', ['before'], 3),
    ];
    const v = build(base(), ctx('before'), fixture);
    expect([...idsIn(v, 'now')].sort()).toEqual(['g1', 'h1']);
    expect(idsIn(v, 'go_bag')).toEqual(['g1', 'g2']);
    expect(idsIn(v, 'home')).toEqual(['h1', 'h3']);
  });

  it('shows an item grouped as now in the now group', () => {
    const v = build(base(), ctx('before'), [item('n1', 'now', ['before'], 1)]);
    expect(idsIn(v, 'now')).toContain('n1');
  });

  it('sorts items within a group by priority', () => {
    const v = build(base(), ctx('before'), [
      item('p3', 'go_bag', ['before'], 3),
      item('p1', 'go_bag', ['before'], 1),
      item('p2', 'go_bag', ['before'], 2),
    ]);
    expect(idsIn(v, 'go_bag')).toEqual(['p1', 'p2', 'p3']);
  });

  it('shows a warning-gated item only when its warning condition holds', () => {
    const gated: ChecklistItem[] = [
      item('secure-roof', 'home', ['during'], 1, { when: { tcws_min: 3 } }),
      item('move-up', 'home', ['during'], 2, { when: { rainfall_min: 'orange' } }),
    ];
    const setAt = '2026-10-10T07:00:00+08:00';

    const tcws3 = build(base(), ctx('during', { tcws: { level: 3, setAt } }), gated);
    expect(showIds(tcws3)).toContain('secure-roof');
    expect(showIds(tcws3)).not.toContain('move-up');

    const tcws2 = build(base(), ctx('during', { tcws: { level: 2, setAt } }), gated);
    expect(showIds(tcws2)).not.toContain('secure-roof');

    const noWarnings = build(base(), ctx('during'), gated);
    expect(showIds(noWarnings)).not.toContain('secure-roof');

    const rain = build(base(), ctx('during', { rainfall: { level: 'orange', setAt } }), gated);
    expect(showIds(rain)).toContain('move-up');
    expect(showIds(rain)).not.toContain('secure-roof');

    const rainYellow = build(base(), ctx('during', { rainfall: { level: 'yellow', setAt } }), gated);
    expect(showIds(rainYellow)).not.toContain('move-up');
  });

  it('filters by household tags with requires_any and excludes', () => {
    const baby = member('k1', 'Bunso', 'child', 'infant');
    const infantItem = item('infant-kit', 'go_bag', ['before'], 1, { requires_any: ['infant'] });
    expect(showIds(build(profile([self, baby]), ctx('before'), [infantItem]))).toContain('infant-kit');
    expect(showIds(build(base(), ctx('before'), [infantItem]))).not.toContain('infant-kit');

    const riverItem = item('evac-river', 'evacuate', ['before'], 1, { excludes: ['near_river'] });
    expect(showIds(build(profile([self], ['near_river']), ctx('before'), [riverItem]))).not.toContain('evac-river');
    expect(showIds(build(profile([self], []), ctx('before'), [riverItem]))).toContain('evac-river');
  });

  it('names the matching members an item is for', () => {
    const baby = member('k1', 'Bunso', 'child', 'infant', [], 'gatas');
    const lolo = member('s1', 'Lolo Ben', 'grandparent', 'senior', ['maintenance_meds']);
    const fx = item('meds', 'go_bag', ['before'], 1, { requires_any: ['maintenance_meds', 'infant'] });
    const view = group(build(profile([self, baby, lolo]), ctx('before'), [fx]), 'go_bag')
      ?.items.find((i) => i.id === 'meds');

    expect(view?.forMembers?.map((m) => m.id).sort()).toEqual(['k1', 's1']);
    expect(view?.forMembers?.find((m) => m.id === 'k1')).toEqual({ id: 'k1', name: 'Bunso', note: 'gatas' });
    expect(view?.forMembers?.find((m) => m.id === 's1')?.name).toBe('Lolo Ben');
    expect(view?.forMembers?.find((m) => m.id === 's1')?.note).toBeUndefined();
  });

  it('barangay_order moves evacuate right after now and leads now with evacuate items', () => {
    const fixture: ChecklistItem[] = [
      item('g1', 'go_bag', ['before', 'during'], 1),
      item('h1', 'home', ['before'], 1),
      item('e1', 'evacuate', ['before', 'during'], 1),
      item('e2', 'evacuate', ['before', 'during'], 2),
    ];

    const ordered = build(base(), ctx('before', { barangay_order: { setAt: ORDER_AT } }), fixture);
    expect(groupIds(ordered)[0]).toBe('now');
    expect(groupIds(ordered)[1]).toBe('evacuate');
    expect(idsIn(ordered, 'now')[0]).toBe('e1');

    const normal = build(base(), ctx('before'), fixture);
    expect(idsIn(normal, 'now')).not.toContain('e1');
    expect(groupIds(normal).indexOf('evacuate')).toBeGreaterThan(groupIds(normal).indexOf('home'));
  });

  it('during fills now with the top evacuate items even without a barangay order', () => {
    const fixture: ChecklistItem[] = [
      item('n1', 'now', ['during'], 2),
      item('e1', 'evacuate', ['during'], 1),
      item('e2', 'evacuate', ['during'], 2),
    ];
    const v = build(base(), ctx('during'), fixture);
    expect(idsIn(v, 'now')).toContain('e1');
    expect(idsIn(v, 'evacuate')).toEqual(['e1', 'e2']);
  });

  it('while barangay_order is active, now leads with evacuate items before group-now items', () => {
    const fixture: ChecklistItem[] = [
      item('n1', 'now', ['before'], 1),
      item('e1', 'evacuate', ['before'], 1),
    ];
    const v = build(base(), ctx('before', { barangay_order: { setAt: ORDER_AT } }), fixture);
    expect(idsIn(v, 'now')).toEqual(['e1', 'n1']);
  });

  it('builds a warning card with hoursSinceSet and stale from now and staleWarningHours', () => {
    const warnings: WarningEntry[] = [
      warning('tcws-3', 'tcws', 3, { lead_time_h: 18 }),
      warning('rainfall-orange', 'rainfall', 'orange'),
    ];
    const setAt = '2026-10-10T05:00:00+08:00';
    const v = build(base(), ctx('during', { tcws: { level: 3, setAt } }), [], warnings);

    expect(v.warningCards).toHaveLength(1);
    expect(v.warningCards[0]).toMatchObject({
      warningId: 'tcws-3',
      kind: 'tcws',
      label: 'Babala tcws-3',
      meaning: 'placeholder: from source',
      leadTimeH: 18,
      setAt,
      hoursSinceSet: 3,
      stale: true,
      confirmed: true,
    });
    expect(v.stale).toEqual({ kind: 'tcws', hoursSinceSet: 3, copyKey: 'stale_warning' });
  });

  it('marks a fresh warning not stale and omits the stale banner', () => {
    const warnings: WarningEntry[] = [warning('rainfall-orange', 'rainfall', 'orange')];
    const setAt = '2026-10-10T07:00:00+08:00';
    const v = build(base(), ctx('during', { rainfall: { level: 'orange', setAt } }), [], warnings);

    expect(v.warningCards[0]?.warningId).toBe('rainfall-orange');
    expect(v.warningCards[0]?.kind).toBe('rainfall');
    expect(v.warningCards[0]?.hoursSinceSet).toBe(1);
    expect(v.warningCards[0]?.stale).toBe(false);
    expect(v.warningCards[0]?.leadTimeH).toBeUndefined();
    expect(v.stale).toBeUndefined();
  });

  it('counts progress ticks over the shown items only', () => {
    const fixture: ChecklistItem[] = [
      item('a', 'after', ['during'], 1),
      item('b', 'after', ['during'], 2),
      item('c', 'after', ['after'], 1),
    ];
    const ticks: Record<string, ChecklistTick> = {
      a: { ticked: true, updatedAt: AT },
      b: { ticked: false, updatedAt: AT },
      c: { ticked: true, updatedAt: AT },
    };
    const v = build(base(), ctx('during'), fixture, [], ticks);
    expect(v.progress).toEqual({ done: 1, total: 2 });
  });

  it('never includes quantity or amount text in the view', () => {
    const baby = member('k1', 'Bunso', 'child', 'infant');
    const fixture: ChecklistItem[] = [
      item('a', 'go_bag', ['before'], 1),
      item('b', 'home', ['before'], 1, { requires_any: ['infant'] }),
    ];
    const v = build(profile([self, baby]), ctx('before'), fixture);

    for (const g of v.groups) {
      for (const view of g.items) {
        expect(view).not.toHaveProperty('quantityText');
      }
    }
    expect(JSON.stringify(v)).not.toContain('×');
  });
});
