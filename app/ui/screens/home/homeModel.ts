import type {
  ColorLevel,
  Context,
  PhaseSwitch,
  TcwsLevel,
  WarningCard,
  WarningEntry,
  WarningKind,
} from '../../../engine';
import type { HomeSection, Theme, Tone } from '../../theme/types';

const COLOR_LEVELS: readonly ColorLevel[] = ['yellow', 'orange', 'red'];

function isColorLevel(level: TcwsLevel | ColorLevel | 'on'): level is ColorLevel {
  return typeof level === 'string' && (COLOR_LEVELS as readonly string[]).includes(level);
}

export function warningTone(
  theme: Theme,
  kind: WarningKind,
  level?: TcwsLevel | ColorLevel | 'on',
): Tone {
  if (level === undefined) return theme.warning.onOff;
  switch (kind) {
    case 'tcws':
      return typeof level === 'number' ? theme.warning.tcws[level] : theme.warning.onOff;
    case 'rainfall':
    case 'surge':
      return isColorLevel(level) ? theme.warning.color[level] : theme.warning.onOff;
    default:
      return theme.warning.onOff;
  }
}

export function cardLevel(
  options: WarningEntry[],
  card: WarningCard,
): TcwsLevel | ColorLevel | 'on' | undefined {
  return options.find((entry) => entry.id === card.warningId)?.level;
}

export function pickerGroups(options: WarningEntry[]): { kind: WarningKind; entries: WarningEntry[] }[] {
  const groups = new Map<WarningKind, WarningEntry[]>();
  for (const option of options) {
    const entries = groups.get(option.kind);
    if (entries) entries.push(option);
    else groups.set(option.kind, [option]);
  }
  return [...groups].map(([kind, entries]) => ({ kind, entries }));
}

export function isOptionActive(context: Pick<Context, 'warnings'>, entry: WarningEntry): boolean {
  const active = context.warnings[entry.kind];
  if (!active) return false;
  if (entry.kind === 'gale' || entry.kind === 'barangay_order') return true;
  return 'level' in active && active.level === entry.level;
}

export function shouldShowSwitch(lastSwitch: PhaseSwitch | undefined, seenAt: string | null): boolean {
  return lastSwitch !== undefined && lastSwitch.at !== seenAt;
}

export function homeSections(
  order: readonly HomeSection[],
  available: ReadonlySet<HomeSection>,
): HomeSection[] {
  return order.filter((section) => available.has(section));
}
