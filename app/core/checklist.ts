import type {
  ChecklistGroupId,
  ChecklistItem,
  ChecklistItemView,
  ChecklistTick,
  ChecklistView,
  ColorLevel,
  Context,
  MemberTag,
  Profile,
  ProfileTag,
  WarningCard,
  WarningEntry,
  WarningKind,
} from '../types';
import { memberTags } from './deriveHousehold';

const GROUP_ORDER: readonly ChecklistGroupId[] = ['now', 'go_bag', 'home', 'evacuate', 'after'];
const COLOR_RANK: Record<ColorLevel, number> = { yellow: 1, orange: 2, red: 3 };
const MEMBER_TAGS: Record<ProfileTag, boolean> = {
  infant: true, child: true, pregnant: true, senior: true, pwd: true, maintenance_meds: true, pets: true,
  near_river: false, near_sea: false, slope: false, low_lying: false, light_materials: false,
  concrete: false, upper_floor: false, fisherfolk: false, farmer: false,
};
const KINDS: readonly WarningKind[] = ['tcws', 'rainfall', 'surge', 'gale'];
const HOUR_MS = 3_600_000;

function whenHolds(when: ChecklistItem['when'], ctx: Context): boolean {
  if (!when) return true;
  const w = ctx.warnings;
  if (when.tcws_min !== undefined && w.tcws && w.tcws.level >= when.tcws_min) return true;
  if (when.rainfall_min && w.rainfall && COLOR_RANK[w.rainfall.level] >= COLOR_RANK[when.rainfall_min]) return true;
  if (when.surge_min && w.surge && COLOR_RANK[w.surge.level] >= COLOR_RANK[when.surge_min]) return true;
  if (when.gale && w.gale) return true;
  return false;
}

export function quantityText(q: NonNullable<ChecklistItem['quantity']>, headcount: number): string {
  const person = q.per === 'person';
  const total = q.amount * (person ? headcount : 1) * (q.days ?? 1);
  return (
    `${q.amount} ${q.unit}` +
    (person ? ` × ${headcount} tao` : '') +
    (q.days ? ` × ${q.days} araw` : '') +
    ` = ${total} ${q.unit}`
  );
}

function warningLevelId(kind: WarningKind, ctx: Context): string | undefined {
  const w = ctx.warnings;
  switch (kind) {
    case 'tcws': return w.tcws && `tcws-${w.tcws.level}`;
    case 'rainfall': return w.rainfall && `rainfall-${w.rainfall.level}`;
    case 'surge': return w.surge && `surge-${w.surge.level}`;
    case 'gale': return w.gale && 'gale';
  }
}

export function buildChecklist(
  profile: Profile,
  context: Context,
  items: ChecklistItem[],
  warnings: WarningEntry[],
  ticks: Record<string, ChecklistTick>,
  now: Date,
  staleWarningHours: number,
): ChecklistView {
  const tags = new Set<ProfileTag>([...profile.members, ...profile.home, ...profile.livelihood]);
  const perMember = profile.people.map((m) => ({ m, tags: new Set<MemberTag>(memberTags(m)) }));

  const byGroup = new Map<ChecklistGroupId, ChecklistItemView[]>();
  let done = 0;
  let total = 0;
  for (const item of items) {
    if (!item.phase.includes(context.phase)) continue;
    if (!whenHolds(item.when, context)) continue;
    if (item.requires_any && !item.requires_any.some((t) => tags.has(t))) continue;
    if (item.excludes?.some((t) => tags.has(t))) continue;

    const ticked = ticks[item.id]?.ticked === true;
    const view: ChecklistItemView = {
      id: item.id,
      text: item.text,
      priority: item.priority,
      critical: item.critical,
      ticked,
      sourceId: item.source_id,
    };
    if (item.quantity) view.quantityText = quantityText(item.quantity, profile.headcount);
    const wanted = item.requires_any?.filter((t) => MEMBER_TAGS[t]) as MemberTag[] | undefined;
    if (wanted && wanted.length > 0) {
      const who = perMember
        .filter(({ tags: mt }) => wanted.some((t) => mt.has(t)))
        .map(({ m }) => (m.note === undefined ? { id: m.id, name: m.name } : { id: m.id, name: m.name, note: m.note }));
      if (who.length > 0) view.forMembers = who;
    }
    total++;
    if (ticked) done++;
    const list = byGroup.get(item.group) ?? [];
    list.push(view);
    byGroup.set(item.group, list);
  }

  const groups = GROUP_ORDER.filter((g) => byGroup.has(g)).map((id) => ({
    id,
    // stable sort keeps content order within a priority
    items: byGroup.get(id)!.slice().sort((a, b) => a.priority - b.priority),
  }));

  const warningCards: WarningCard[] = [];
  let stale: ChecklistView['stale'];
  for (const kind of KINDS) {
    const active = context.warnings[kind];
    if (!active) continue;
    const entry = warnings.find((e) => e.id === warningLevelId(kind, context));
    if (entry) {
      const card: WarningCard = {
        warningId: entry.id,
        kind,
        label: entry.label,
        meaning: entry.meaning,
        setAt: active.setAt,
        confirmed: entry.confirmed,
      };
      if (entry.lead_time_h !== undefined) card.leadTimeH = entry.lead_time_h;
      warningCards.push(card);
    }
    const hours = Math.floor((now.getTime() - Date.parse(active.setAt)) / HOUR_MS);
    if (hours >= staleWarningHours && (!stale || hours > stale.hoursSinceSet)) {
      stale = { kind, hoursSinceSet: hours, copyKey: 'stale_warning' };
    }
  }

  const view: ChecklistView = { warningCards, groups, progress: { done, total } };
  if (stale) view.stale = stale;
  return view;
}
