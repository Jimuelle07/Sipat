import { describe, expect, it } from 'vitest';

import type {
  ColorLevel,
  Context,
  PhaseSwitch,
  TcwsLevel,
  WarningCard,
  WarningEntry,
  WarningKind,
} from '../../../engine';
import type { HomeSection, Tone } from '../../theme/types';
import { buildTheme } from '../../theme/themes';
import {
  cardLevel,
  homeSections,
  isOptionActive,
  pickerGroups,
  shouldShowSwitch,
  warningTone,
} from './homeModel';

const AT = '2026-01-01T00:00:00+08:00';

const theme = buildTheme({ phase: 'before', scheme: 'light', largeText: false });

const entry = (
  id: string,
  kind: WarningKind,
  level: WarningEntry['level'],
): WarningEntry => ({
  id,
  kind,
  level,
  label: 'Babala',
  meaning: 'Paliwanag mula sa gabay.',
  actions: [],
  source_id: 'source-test',
  confirmed: true,
});

const card = (warningId: string): WarningCard => ({
  warningId,
  kind: 'tcws',
  label: 'Babala',
  meaning: 'Paliwanag mula sa gabay.',
  setAt: AT,
  hoursSinceSet: 1,
  stale: false,
  confirmed: true,
});

const phaseSwitch = (at: string): PhaseSwitch => ({
  from: 'before',
  to: 'during',
  source: 'warning',
  input: 'warning:tcws-3',
  at,
});

const warningsWith = (warnings: Context['warnings']): Pick<Context, 'warnings'> => ({ warnings });

describe('warningTone', () => {
  const cases: [WarningKind, TcwsLevel | ColorLevel | 'on' | undefined, Tone][] = [
    ['tcws', 1, theme.warning.tcws[1]],
    ['tcws', 3, theme.warning.tcws[3]],
    ['tcws', 5, theme.warning.tcws[5]],
    ['rainfall', 'yellow', theme.warning.color.yellow],
    ['rainfall', 'orange', theme.warning.color.orange],
    ['surge', 'red', theme.warning.color.red],
    ['gale', 'on', theme.warning.onOff],
    ['gale', undefined, theme.warning.onOff],
    ['barangay_order', 'on', theme.warning.onOff],
    ['barangay_order', undefined, theme.warning.onOff],
    ['tcws', undefined, theme.warning.onOff],
    ['rainfall', undefined, theme.warning.onOff],
    ['surge', undefined, theme.warning.onOff],
  ];

  it.each(cases)(
    'kind %s with level %s maps to its warning tone',
    (kind, level, expected) => {
      expect(warningTone(theme, kind, level)).toEqual(expected);
    },
  );

  it('returns the tcws tone object from the theme by reference', () => {
    expect(warningTone(theme, 'tcws', 4)).toBe(theme.warning.tcws[4]);
  });

  it('returns the rainfall and surge tones from the shared color scale', () => {
    expect(warningTone(theme, 'rainfall', 'orange')).toBe(theme.warning.color.orange);
    expect(warningTone(theme, 'surge', 'red')).toBe(theme.warning.color.red);
  });

  it('returns the on/off tone for gale, barangay order and any missing level', () => {
    expect(warningTone(theme, 'gale')).toBe(theme.warning.onOff);
    expect(warningTone(theme, 'barangay_order')).toBe(theme.warning.onOff);
    expect(warningTone(theme, 'tcws')).toBe(theme.warning.onOff);
    expect(warningTone(theme, 'rainfall')).toBe(theme.warning.onOff);
  });
});

describe('cardLevel', () => {
  const options = [
    entry('tcws-3', 'tcws', 3),
    entry('rainfall-orange', 'rainfall', 'orange'),
    entry('gale-on', 'gale', 'on'),
  ];

  it('returns the level of the entry whose id matches the card warningId', () => {
    expect(cardLevel(options, card('tcws-3'))).toBe(3);
    expect(cardLevel(options, card('rainfall-orange'))).toBe('orange');
    expect(cardLevel(options, card('gale-on'))).toBe('on');
  });

  it('returns undefined when no entry matches the card warningId', () => {
    expect(cardLevel(options, card('surge-red'))).toBeUndefined();
  });

  it('returns undefined when the option list is empty', () => {
    expect(cardLevel([], card('tcws-3'))).toBeUndefined();
  });
});

describe('pickerGroups', () => {
  it('groups entries in order of first appearance while keeping the options order', () => {
    const options = [
      entry('tcws-1', 'tcws', 1),
      entry('rainfall-yellow', 'rainfall', 'yellow'),
      entry('tcws-3', 'tcws', 3),
      entry('surge-red', 'surge', 'red'),
      entry('rainfall-orange', 'rainfall', 'orange'),
    ];

    expect(pickerGroups(options)).toEqual([
      {
        kind: 'tcws',
        entries: [options[0], options[2]],
      },
      {
        kind: 'rainfall',
        entries: [options[1], options[4]],
      },
      {
        kind: 'surge',
        entries: [options[3]],
      },
    ]);
  });

  it('omits kinds that have no entries', () => {
    const options = [
      entry('gale-on', 'gale', 'on'),
      entry('barangay-on', 'barangay_order', 'on'),
    ];

    const groups = pickerGroups(options);
    expect(groups.map((group) => group.kind)).toEqual(['gale', 'barangay_order']);
    expect(groups.some((group) => group.kind === 'tcws')).toBe(false);
    expect(groups.some((group) => group.kind === 'rainfall')).toBe(false);
    expect(groups.some((group) => group.kind === 'surge')).toBe(false);
  });

  it('returns an empty list when there are no options', () => {
    expect(pickerGroups([])).toEqual([]);
  });
});

describe('isOptionActive', () => {
  const context = warningsWith({
    tcws: { level: 3, setAt: AT },
    rainfall: { level: 'orange', setAt: AT },
    gale: { setAt: AT },
  });

  it('is true when the matching kind is active at the same level', () => {
    expect(isOptionActive(context, entry('tcws-3', 'tcws', 3))).toBe(true);
    expect(isOptionActive(context, entry('rainfall-orange', 'rainfall', 'orange'))).toBe(true);
  });

  it('is false when the matching kind is active at a different level', () => {
    expect(isOptionActive(context, entry('tcws-2', 'tcws', 2))).toBe(false);
    expect(isOptionActive(context, entry('tcws-5', 'tcws', 5))).toBe(false);
    expect(isOptionActive(context, entry('rainfall-red', 'rainfall', 'red'))).toBe(false);
  });

  it('is false when the kind is not active at all', () => {
    expect(isOptionActive(context, entry('surge-red', 'surge', 'red'))).toBe(false);
    expect(isOptionActive(context, entry('barangay-on', 'barangay_order', 'on'))).toBe(false);
  });

  it('treats gale and barangay order as active whenever they are present, ignoring the level', () => {
    expect(isOptionActive(context, entry('gale-on', 'gale', 'on'))).toBe(true);

    const barangay = warningsWith({ barangay_order: { setAt: AT } });
    expect(isOptionActive(barangay, entry('barangay-on', 'barangay_order', 'on'))).toBe(true);
    expect(isOptionActive(barangay, entry('gale-on', 'gale', 'on'))).toBe(false);
  });

  it('is false for every kind when no warnings are active', () => {
    const empty = warningsWith({});
    expect(isOptionActive(empty, entry('tcws-3', 'tcws', 3))).toBe(false);
    expect(isOptionActive(empty, entry('gale-on', 'gale', 'on'))).toBe(false);
  });
});

describe('shouldShowSwitch', () => {
  const cases: [string, PhaseSwitch | undefined, string | null, boolean][] = [
    ['no last switch', undefined, null, false],
    ['no last switch even with a seen time', undefined, AT, false],
    ['last switch already seen', phaseSwitch(AT), AT, false],
    ['last switch not seen yet', phaseSwitch(AT), '2025-12-31T00:00:00+08:00', true],
    ['last switch and nothing seen yet', phaseSwitch(AT), null, true],
  ];

  it.each(cases)('%s', (_name, lastSwitch, seenAt, expected) => {
    expect(shouldShowSwitch(lastSwitch, seenAt)).toBe(expected);
  });
});

describe('homeSections', () => {
  it('filters the order down to the available sections while keeping order', () => {
    const order: readonly HomeSection[] = ['hero', 'warnings', 'checklist', 'hotlines'];
    const available = new Set<HomeSection>(['checklist', 'hotlines', 'hero']);

    expect(homeSections(order, available)).toEqual(['hero', 'checklist', 'hotlines']);
  });

  it('drops sections that are not available', () => {
    const order: readonly HomeSection[] = ['hero', 'switchBanner', 'emergency'];
    const available = new Set<HomeSection>(['hero']);

    expect(homeSections(order, available)).toEqual(['hero']);
  });

  it('returns an empty list when nothing is available', () => {
    const order: readonly HomeSection[] = ['hero', 'warnings', 'checklist'];
    expect(homeSections(order, new Set<HomeSection>())).toEqual([]);
  });

  it('ignores available sections that are not in the order', () => {
    const order: readonly HomeSection[] = ['hero'];
    const available = new Set<HomeSection>(['hero', 'hotlines']);

    expect(homeSections(order, available)).toEqual(['hero']);
  });
});
