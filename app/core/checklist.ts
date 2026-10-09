import type {
  ChecklistGroupId,
  ChecklistItem,
  ChecklistItemView,
  ChecklistTick,
  ChecklistView,
  ColorLevel,
  Context,
  MemberTag,
  Phase,
  Profile,
  ProfileTag,
  WarningCard,
  WarningEntry,
  WarningKind,
} from '../types/index.ts';
import { memberTags } from './deriveHousehold.ts';

// Recommended groups per phase, in display order. "Gawin ngayon" (now) leads every phase.
export const PHASE_GROUPS: Record<Phase, ChecklistGroupId[]> = {
  before: ['now', 'go_bag', 'home'],
  during: ['now', 'evacuate'],
  after: ['now', 'after'],
};

// Canonical order used for any group that is not recommended by the current phase.
const GROUP_ORDER: readonly ChecklistGroupId[] = ['now', 'go_bag', 'home', 'evacuate', 'after'];
const COLOR_RANK: Record<ColorLevel, number> = { yellow: 1, orange: 2, red: 3 };
const MEMBER_TAG_SET = new Set<ProfileTag>([
  'infant', 'child', 'pregnant', 'senior', 'pwd', 'maintenance_meds', 'pets',
]);
const KINDS: readonly WarningKind[] = ['tcws', 'rainfall', 'surge', 'gale', 'barangay_order'];
const HOUR_MS = 3_600_000;

function isMemberTag(tag: ProfileTag): tag is MemberTag {
  return MEMBER_TAG_SET.has(tag);
}

function whenHolds(when: ChecklistItem['when'], context: Context): boolean {
  if (!when) return true;
  const w = context.warnings;
  if (when.tcws_min !== undefined && w.tcws && w.tcws.level >= when.tcws_min) return true;
  if (when.rainfall_min && w.rainfall && COLOR_RANK[w.rainfall.level] >= COLOR_RANK[when.rainfall_min]) return true;
  if (when.surge_min && w.surge && COLOR_RANK[w.surge.level] >= COLOR_RANK[when.surge_min]) return true;
  if (when.gale && w.gale) return true;
  if (when.barangay_order && w.barangay_order) return true;
  return false;
}

function warningLevelId(kind: WarningKind, context: Context): string {
  const w = context.warnings;
  switch (kind) {
    case 'tcws': return w.tcws ? `tcws-${w.tcws.level}` : '';
    case 'rainfall': return w.rainfall ? `rainfall-${w.rainfall.level}` : '';
    case 'surge': return w.surge ? `surge-${w.surge.level}` : '';
    case 'gale': return 'gale';
    case 'barangay_order': return 'barangay-order';
  }
}

function hoursSince(now: Date, at: string): number {
  return Math.floor((now.getTime() - Date.parse(at)) / HOUR_MS);
}

function byPriority(items: ChecklistItemView[]): ChecklistItemView[] {
  return items.slice().sort((a, b) => a.priority - b.priority);
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
  const tags = new Set<ProfileTag>([...profile.members, ...profile.home]);
  const perMember = profile.people.map((member) => ({ member, tags: new Set<MemberTag>(memberTags(member)) }));

  const byGroup = new Map<ChecklistGroupId, ChecklistItemView[]>();
  let done = 0;
  let total = 0;

  for (const item of items) {
    if (!item.phase.includes(context.phase)) continue;
    if (!whenHolds(item.when, context)) continue;
    if (item.requires_any && !item.requires_any.some((tag) => tags.has(tag))) continue;
    if (item.excludes?.some((tag) => tags.has(tag))) continue;

    const ticked = ticks[item.id]?.ticked === true;
    const view: ChecklistItemView = {
      id: item.id,
      text: item.text,
      priority: item.priority,
      critical: item.critical,
      ticked,
      sourceId: item.source_id,
    };

    const wanted = item.requires_any?.filter(isMemberTag);
    if (wanted && wanted.length > 0) {
      const forMembers = perMember
        .filter(({ tags: memberTagSet }) => wanted.some((tag) => memberTagSet.has(tag)))
        .map(({ member }) =>
          member.note === undefined
            ? { id: member.id, name: member.name }
            : { id: member.id, name: member.name, note: member.note },
        );
      if (forMembers.length > 0) view.forMembers = forMembers;
    }

    total++;
    if (ticked) done++;
    const list = byGroup.get(item.group) ?? [];
    list.push(view);
    byGroup.set(item.group, list);
  }

  // "now" holds the top items of the groups the phase recommends. While
  // barangay_order is active, evacuate leads "now" and sits right after it.
  const recommendedGroups = PHASE_GROUPS[context.phase];
  const barangayOrder = context.warnings.barangay_order !== undefined;
  const otherGroups = recommendedGroups.filter((id) => id !== 'now');
  const orderedSources = barangayOrder
    ? (['evacuate', ...otherGroups.filter((id) => id !== 'evacuate')] as ChecklistGroupId[])
    : otherGroups;

  const nowItems: ChecklistItemView[] = [];
  for (const id of orderedSources) {
    const list = byGroup.get(id);
    if (!list || list.length === 0) continue;
    let min = 3 as ChecklistItemView['priority'];
    for (const view of list) if (view.priority < min) min = view.priority;
    for (const view of list) if (view.priority === min) nowItems.push(view);
  }
  nowItems.push(...(byGroup.get('now') ?? []));
  const sortedNow = byPriority(nowItems);

  const order: ChecklistGroupId[] = ['now'];
  if (barangayOrder) order.push('evacuate');
  for (const id of recommendedGroups) if (id !== 'now' && !order.includes(id)) order.push(id);
  for (const id of GROUP_ORDER) if (!order.includes(id)) order.push(id);

  const required = new Set<ChecklistGroupId>(recommendedGroups);
  const groups = order
    .filter((id) => required.has(id) || byGroup.has(id))
    .map((id) => ({
      id,
      recommended: required.has(id),
      items: id === 'now' ? sortedNow : byPriority(byGroup.get(id) ?? []),
    }));

  const warningCards: WarningCard[] = [];
  let stale: ChecklistView['stale'];
  for (const kind of KINDS) {
    const active = context.warnings[kind];
    if (!active) continue;
    const entry = warnings.find((candidate) => candidate.id === warningLevelId(kind, context));
    if (entry) {
      const hours = hoursSince(now, active.setAt);
      const card: WarningCard = {
        warningId: entry.id,
        kind,
        label: entry.label,
        meaning: entry.meaning,
        setAt: active.setAt,
        hoursSinceSet: hours,
        stale: hours >= staleWarningHours,
        confirmed: entry.confirmed,
      };
      if (entry.lead_time_h !== undefined) card.leadTimeH = entry.lead_time_h;
      warningCards.push(card);
    }
    const hours = hoursSince(now, active.setAt);
    if (hours >= staleWarningHours && (!stale || hours > stale.hoursSinceSet)) {
      stale = { kind, hoursSinceSet: hours, copyKey: 'stale_warning' };
    }
  }

  const view: ChecklistView = { phase: context.phase, warningCards, groups, progress: { done, total } };
  if (stale) view.stale = stale;
  return view;
}
