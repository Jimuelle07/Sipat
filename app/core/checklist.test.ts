import { describe, expect, it } from 'vitest';
import type { ChecklistItem, ChecklistView, Context, Member, Profile, WarningEntry } from '../types';
import checklistFile from '../../content/checklist.json';
import warningsFile from '../../content/warnings.json';
import { buildChecklist } from './checklist';
import { deriveHousehold } from './deriveHousehold';

const items = checklistFile.items as ChecklistItem[];
const warnings = warningsFile.items as WarningEntry[];
const NOW = new Date('2026-10-09T12:00:00+08:00');

const member = (id: string, name: string, ageGroup: Member['ageGroup'], note?: string): Member => ({
  id, name, relation: id === 'self' ? 'self' : 'child', ageGroup, needs: [], note,
  updatedAt: '2026-10-09T00:00:00+08:00',
});

function profile(people: Member[], home: Profile['home'] = []): Profile {
  const { members, headcount } = deriveHousehold(people, 0);
  return {
    id: 'p1', name: 'Bahay namin', ownerId: 'self', people, petsCount: 0, headcount, members, home,
    livelihood: [], plan: { contacts: [] }, updatedAt: '2026-10-09T00:00:00+08:00',
  };
}

const ids = (v: ChecklistView) => v.groups.flatMap((g) => g.items.map((i) => i.id));
const find = (v: ChecklistView, id: string) =>
  v.groups.flatMap((g) => g.items).find((i) => i.id === id);
const build = (p: Profile, ctx: Context, its: ChecklistItem[] = items) =>
  buildChecklist(p, ctx, its, warnings, {}, NOW, 3);

const before: Context = { phase: 'before', warnings: {} };
const self = member('self', 'Ana', 'adult');

describe('buildChecklist', () => {
  it('shows infant supplies naming the infant only when present', () => {
    const baby = member('b1', 'Bunso', 'infant', 'gatas na formula');
    const v = build(profile([self, baby]), before);
    expect(find(v, 'gobag-infant-supplies')?.forMembers).toEqual([{ id: 'b1', name: 'Bunso', note: 'gatas na formula' }]);
    expect(ids(build(profile([self]), before))).not.toContain('gobag-infant-supplies');
  });

  it('near_river evacuation follows tcws/rainfall', () => {
    const p = profile([self], ['near_river']);
    const at = '2026-10-09T11:00:00+08:00';
    expect(ids(build(p, { phase: 'during', warnings: { tcws: { level: 3, setAt: at } } }))).toContain('evacuate-near-river');
    expect(ids(build(p, { phase: 'during', warnings: { tcws: { level: 1, setAt: at } } }))).not.toContain('evacuate-near-river');
  });

  it('phase after shows only after items', () => {
    const v = build(profile([self]), { phase: 'after', warnings: {} });
    const shown = ids(v);
    expect(shown.length).toBeGreaterThan(0);
    for (const id of shown) expect(items.find((i) => i.id === id)!.phase).toContain('after');
    expect(v.progress).toEqual({ done: 0, total: shown.length });
  });

  it('computes quantity text', () => {
    const fixture: ChecklistItem = {
      id: 'fx-water', text: 'Tubig', group: 'go_bag', phase: ['before'], priority: 1, critical: false,
      quantity: { per: 'person', amount: 2, unit: 'litro', days: 3 }, source_id: 'ocd-go-bag',
    };
    const p = profile([self, ...['a', 'b', 'c', 'd'].map((x) => member(x, x, 'adult'))]);
    expect(p.headcount).toBe(5);
    expect(find(build(p, before, [fixture]), 'fx-water')?.quantityText).toBe('2 litro × 5 tao × 3 araw = 30 litro');
  });

  it('flags stale warnings and builds warning cards', () => {
    const setAt = new Date(NOW.getTime() - 4 * 3_600_000).toISOString();
    const v = build(profile([self]), { phase: 'during', warnings: { tcws: { level: 3, setAt } } });
    expect(v.stale).toEqual({ kind: 'tcws', hoursSinceSet: 4, copyKey: 'stale_warning' });
    expect(v.warningCards.map((c) => c.warningId)).toEqual(['tcws-3']);
  });
});
