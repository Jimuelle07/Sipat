import type { ChecklistView, CopyKey, MemberTag, Profile, TextKind } from '../types';
import { memberTags } from '../core/deriveHousehold';
import { strings as uiStrings } from '../ui/strings';
const strings = uiStrings.tl;

/**
 * Pure, deterministic text exports for the share/SMS features.
 *
 * SMS length: docs/api-layer.md "ShareService" asks to keep the body within one GSM-7 SMS
 * (160 characters) where possible. The templates below stay short enough for a four-person
 * household with a couple of vulnerable members; the caller is responsible for anything longer.
 *
 * Rule 8: member names, notes and photos never appear in a text. Only the household name,
 * the derived headcount, the location and the per-need counts are rendered.
 */

/** Tagalog labels for the derived household needs, in `MemberTag` order (docs/api-layer.md, ShareService). */
const VULNERABLE_TL: readonly { tag: MemberTag; label: string }[] = [
  { tag: 'infant', label: 'sanggol' },
  { tag: 'child', label: 'bata' },
  { tag: 'pregnant', label: 'buntis' },
  { tag: 'senior', label: 'senior' },
  { tag: 'pwd', label: 'PWD' },
  { tag: 'maintenance_meds', label: 'may maintenance na gamot' },
];

/**
 * Counts the household's vulnerable members by need, e.g. "1 sanggol, 1 senior,
 * 1 may maintenance na gamot", or "wala" when nobody matches. Never reads names or notes.
 */
function vulnerableText(profile: Profile): string {
  const counts = new Map<MemberTag, number>();
  for (const member of profile.people) {
    for (const tag of memberTags(member)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const parts = VULNERABLE_TL
    .filter(({ tag }) => (counts.get(tag) ?? 0) > 0)
    .map(({ tag, label }) => `${counts.get(tag)} ${label}`);
  return parts.length > 0 ? parts.join(', ') : 'wala';
}

/**
 * The SMS body the phone's messaging app opens with (docs/api-layer.md, ShareService).
 * `where` falls back to the plan's evacuation center; when neither is set the location
 * clause is left out rather than shipping an empty "Nasa .".
 *
 * No clock is read so the result is deterministic; the docs' optional `{time}` suffix on
 * `need_help` is therefore omitted. `copy` is part of the Engine contract (`plan.textPreview`
 * passes `engine.copy`); the SMS templates use no safety copy keys today.
 */
export function exportHouseholdSms(
  profile: Profile,
  kind: TextKind,
  opts: { where?: string; copy: (k: CopyKey) => string },
): string {
  const where = (opts.where ?? profile.plan.evacuationCenter ?? '').trim();
  if (kind === 'need_help') {
    const core = `TULONG: ${profile.headcount} tao${where ? ` sa ${where}` : ''}`;
    return `${core}. May ${vulnerableText(profile)}. - ${profile.name}`;
  }
  const core = `Ligtas kami, ${profile.headcount} tao${where ? `. Nasa ${where}` : ''}`;
  return `${core}. - ${profile.name}`;
}

/** The Tagalog group headings from the UI copy (app/ui/strings.ts), keyed by ChecklistGroupId. */
const GROUP_LABEL: Record<ChecklistView['groups'][number]['id'], string> = {
  now: strings.group_now,
  go_bag: strings.group_go_bag,
  home: strings.group_home,
  evacuate: strings.group_evacuate,
  after: strings.group_after,
};

function memberNames(members: { name: string }[]): string {
  return members.map((m) => m.name).join(', ');
}

/**
 * A plain-text version of the checklist, grouped in the same order as `ChecklistView.groups`:
 * a heading per group and one `[x]`/`[ ]` line per item, followed by the computed quantity
 * and the members an item is for. No clock or I/O, so the output is deterministic.
 */
export function exportChecklistText(view: ChecklistView, opts: { title?: string } = {}): string {
  const parts: string[] = [];
  if (opts.title !== undefined && opts.title.length > 0) parts.push(opts.title);

  for (const group of view.groups) {
    const lines = [GROUP_LABEL[group.id]];
    for (const item of group.items) {
      const extras: string[] = [];
      if (item.quantityText !== undefined) extras.push(item.quantityText);
      if (item.forMembers !== undefined && item.forMembers.length > 0) {
        extras.push(`para kay ${memberNames(item.forMembers)}`);
      }
      const line = `${item.ticked ? '[x]' : '[ ]'} ${item.text}`;
      lines.push(extras.length > 0 ? `${line} — ${extras.join('; ')}` : line);
    }
    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}
