import { describe, expect, it } from 'vitest';
import { buildTheme } from './themes';
import { contrastRatio } from './contrast';
import type { Phase, Scheme, Theme, Tone, TypeRole } from './types';
import paletteJson from '../../../assets/color-palette/palette.json';

const PHASES: readonly Phase[] = ['before', 'during', 'after'];
const SCHEMES: readonly Scheme[] = ['light', 'dark'];
const LARGE: readonly boolean[] = [false, true];
const TYPE_ROLES: readonly TypeRole[] = [
  'display',
  'headline',
  'title',
  'lead',
  'body',
  'bodySmall',
  'label',
  'caption',
];

const round2 = (value: number): number => Math.round(value * 100) / 100;

interface ThemeCase {
  label: string;
  theme: Theme;
}

const themeCases: ThemeCase[] = [];
for (const phase of PHASES) {
  for (const scheme of SCHEMES) {
    for (const largeText of LARGE) {
      themeCases.push({
        label: `${phase}/${scheme}/${largeText ? 'large' : 'regular'}`,
        theme: buildTheme({ phase, scheme, largeText }),
      });
    }
  }
}

function themeFor(phase: Phase, scheme: Scheme, largeText = false): Theme {
  return buildTheme({ phase, scheme, largeText });
}

function describeContext(theme: Theme): string {
  return `${theme.phase}/${theme.scheme}/${theme.largeText ? 'large' : 'regular'}`;
}

function expectRatio(
  theme: Theme,
  what: string,
  fg: string,
  bg: string,
  minimum: number,
): void {
  const ratio = contrastRatio(fg, bg);
  expect(
    ratio,
    `${describeContext(theme)} · ${what}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need ≥${minimum}:1)`,
  ).toBeGreaterThanOrEqual(minimum);
}

function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      flattenStrings(item, out);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      flattenStrings(item, out);
    }
  }
  return out;
}

function collectHexStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('#')) {
      out.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectHexStrings(item, out);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectHexStrings(item, out);
    }
  }
  return out;
}

function themeTones(theme: Theme): { name: string; tone: Tone }[] {
  return [
    { name: 'highlight', tone: theme.colors.highlight },
    { name: 'primary', tone: theme.colors.primary },
    { name: 'capsule', tone: theme.colors.capsule },
    { name: 'selected', tone: theme.colors.selected },
    { name: 'danger', tone: theme.colors.danger },
    { name: 'dangerSurface', tone: theme.colors.dangerSurface },
    { name: 'warning.tcws.1', tone: theme.warning.tcws[1] },
    { name: 'warning.tcws.2', tone: theme.warning.tcws[2] },
    { name: 'warning.tcws.3', tone: theme.warning.tcws[3] },
    { name: 'warning.tcws.4', tone: theme.warning.tcws[4] },
    { name: 'warning.tcws.5', tone: theme.warning.tcws[5] },
    { name: 'warning.color.yellow', tone: theme.warning.color.yellow },
    { name: 'warning.color.orange', tone: theme.warning.color.orange },
    { name: 'warning.color.red', tone: theme.warning.color.red },
    { name: 'warning.onOff', tone: theme.warning.onOff },
  ];
}

const paletteValues = new Set(flattenStrings(paletteJson));

describe('buildTheme contrast invariants', () => {
  it.each(themeCases)('$label · text on surface keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'text/surface', theme.colors.text, theme.colors.surface, 4.5);
  });

  it.each(themeCases)('$label · text on canvas keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'text/canvas', theme.colors.text, theme.colors.canvas, 4.5);
  });

  it.each(themeCases)('$label · textMuted on surface keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'textMuted/surface', theme.colors.textMuted, theme.colors.surface, 4.5);
  });

  it.each(themeCases)('$label · textMuted on canvas keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'textMuted/canvas', theme.colors.textMuted, theme.colors.canvas, 4.5);
  });

  it.each(themeCases)('$label · accentText on surface keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'accentText/surface', theme.colors.accentText, theme.colors.surface, 4.5);
  });

  it.each(themeCases)('$label · accentText on canvas keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'accentText/canvas', theme.colors.accentText, theme.colors.canvas, 4.5);
  });

  it.each(themeCases)('$label · brand on surface keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'brand/surface', theme.colors.brand, theme.colors.surface, 4.5);
  });

  it.each(themeCases)('$label · brand on canvas keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'brand/canvas', theme.colors.brand, theme.colors.canvas, 4.5);
  });

  it.each(themeCases)('$label · text on surfaceSunken keeps ≥4.5:1', ({ theme }) => {
    expectRatio(theme, 'text/surfaceSunken', theme.colors.text, theme.colors.surfaceSunken, 4.5);
  });

  it.each(themeCases)('$label · every Tone keeps ink ≥4.5:1 on its fill', ({ theme }) => {
    for (const { name, tone } of themeTones(theme)) {
      const ratio = contrastRatio(tone.fill, tone.ink);
      expect(
        ratio,
        `${describeContext(theme)} · ${name}: ink ${tone.ink} on fill ${tone.fill} = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themeCases)('$label · controlBorder on surface keeps ≥3.0:1', ({ theme }) => {
    expectRatio(
      theme,
      'controlBorder/surface',
      theme.colors.controlBorder,
      theme.colors.surface,
      3,
    );
  });

  it.each(themeCases)('$label · controlBorder on canvas keeps ≥3.0:1', ({ theme }) => {
    expectRatio(theme, 'controlBorder/canvas', theme.colors.controlBorder, theme.colors.canvas, 3);
  });

  it.each(themeCases)('$label · focus on surface keeps ≥3.0:1', ({ theme }) => {
    expectRatio(theme, 'focus/surface', theme.colors.focus, theme.colors.surface, 3);
  });

  it.each(themeCases)('$label · focus on canvas keeps ≥3.0:1', ({ theme }) => {
    expectRatio(theme, 'focus/canvas', theme.colors.focus, theme.colors.canvas, 3);
  });
});

describe('buildTheme palette traceability', () => {
  it.each(themeCases)('$label · every hex string comes from palette.json', ({ theme }) => {
    for (const hex of collectHexStrings(theme)) {
      expect(paletteValues.has(hex), `${hex} is not a value in palette.json`).toBe(true);
    }
  });
});

describe('buildTheme role spot checks', () => {
  it('before light canvas is the before tint', () => {
    expect(themeFor('before', 'light').colors.canvas).toBe(paletteJson.phase.before.tint);
  });

  it('during light canvas is gray[0]', () => {
    expect(themeFor('during', 'light').colors.canvas).toBe(paletteJson.gray['0']);
  });

  it('during light highlight is the during deep fill with gray[0] ink', () => {
    expect(themeFor('during', 'light').colors.highlight).toEqual({
      fill: paletteJson.phase.during.deep,
      ink: paletteJson.gray['0'],
    });
  });

  it.each(['before', 'after'] as const)('%s dark canvas is dark.bg', (phase) => {
    expect(themeFor(phase, 'dark').colors.canvas).toBe(paletteJson.dark.bg);
  });

  it('after dark accentText is the after main', () => {
    expect(themeFor('after', 'dark').colors.accentText).toBe(paletteJson.phase.after.main);
  });

  it.each(['before', 'after'] as const)('%s light danger is alert.main with gray[0] ink', (phase) => {
    expect(themeFor(phase, 'light').colors.danger).toEqual({
      fill: paletteJson.alert.main,
      ink: paletteJson.gray['0'],
    });
  });

  it.each(['before', 'after'] as const)('%s light brand is blue[700]', (phase) => {
    expect(themeFor(phase, 'light').colors.brand).toBe(paletteJson.blue['700']);
  });
});

describe('buildTheme phase character', () => {
  it('the three light phases differ in canvas or highlight.fill pairwise', () => {
    const before = themeFor('before', 'light');
    const during = themeFor('during', 'light');
    const after = themeFor('after', 'light');
    const pairs: [Theme, Theme][] = [
      [before, during],
      [during, after],
      [before, after],
    ];
    for (const [a, b] of pairs) {
      expect(
        a.colors.canvas !== b.colors.canvas || a.colors.highlight.fill !== b.colors.highlight.fill,
      ).toBe(true);
    }
  });

  it.each([
    ['before', 'prepare'],
    ['during', 'essentials'],
    ['after', 'recover'],
  ] as const)('%s mood is %s', (phase, mood) => {
    expect(themeFor(phase, 'light').mood).toBe(mood);
  });

  it('during is the high-contrast, stripped variant', () => {
    const before = themeFor('before', 'light');
    const during = themeFor('during', 'light');
    const after = themeFor('after', 'light');

    expect(during.border.hairline).toBeGreaterThan(before.border.hairline);
    expect(during.minTouch).toBeGreaterThan(before.minTouch);
    expect(during.type.roles.body.fontSize).toBeGreaterThan(before.type.roles.body.fontSize);

    expect(during.motion.style).toBe('minimal');
    expect(before.motion.style).toBe('full');
    expect(after.motion.style).toBe('full');
  });

  it('during home order leads with the switch banner and emergency before checklist', () => {
    const order = themeFor('during', 'light').home.order;
    expect(order[0]).toBe('switchBanner');
    expect(order.indexOf('emergency')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('checklist')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('emergency')).toBeLessThan(order.indexOf('checklist'));
  });
});

describe('buildTheme largeText', () => {
  const pairs: { label: string; phase: Phase; scheme: Scheme }[] = [];
  for (const phase of PHASES) {
    for (const scheme of SCHEMES) {
      pairs.push({ label: `${phase}/${scheme}`, phase, scheme });
    }
  }

  it.each(pairs)('$label scales every type role by 1.25 and grows touch', ({ phase, scheme }) => {
    const regular = themeFor(phase, scheme, false);
    const large = themeFor(phase, scheme, true);

    for (const role of TYPE_ROLES) {
      expect(large.type.roles[role].fontSize).toBe(
        Math.round(regular.type.roles[role].fontSize * 1.25),
      );
      expect(large.type.roles[role].lineHeight).toBe(
        Math.round(regular.type.roles[role].lineHeight * 1.25),
      );
    }

    expect(large.minTouch).toBeGreaterThan(regular.minTouch);
    expect(regular.type.maxFontSizeMultiplier).toBe(1.6);
    expect(large.type.maxFontSizeMultiplier).toBe(1.3);
  });
});

describe('buildTheme letterSpacing', () => {
  it.each(LARGE)('before body tracking is em −0.01 (largeText=%s)', (largeText) => {
    const { fontSize, letterSpacing } = themeFor('before', 'light', largeText).type.roles.body;
    expect(letterSpacing).toBe(round2(fontSize * -0.01));
  });

  it.each(LARGE)('before headline tracking is em −0.04 (largeText=%s)', (largeText) => {
    const { fontSize, letterSpacing } = themeFor('before', 'light', largeText).type.roles.headline;
    expect(letterSpacing).toBe(round2(fontSize * -0.04));
  });
});

describe('buildTheme mascot slot', () => {
  it.each(themeCases)('$label · has a positive slot and the palette mascot colors', ({ theme }) => {
    expect(theme.mascot.size).toBeGreaterThan(0);
    expect(theme.colors.mascot).toEqual(paletteJson.mascot);
  });

  it.each([
    ['before', 96, 'heroEnd'],
    ['during', 40, 'headerEnd'],
    ['after', 120, 'heroBelow'],
  ] as const)('%s slot is %i dp at %s', (phase, size, placement) => {
    const regular = themeFor(phase, 'light', false);
    const large = themeFor(phase, 'light', true);
    expect(regular.mascot.size).toBe(size);
    expect(regular.mascot.placement).toBe(placement);
    expect(large.mascot.size).toBe(size);
    expect(large.mascot.placement).toBe(placement);
  });
});

describe('buildTheme memoization', () => {
  it('returns the same object for identical options', () => {
    const first = buildTheme({ phase: 'before', scheme: 'light', largeText: false });
    const second = buildTheme({ phase: 'before', scheme: 'light', largeText: false });
    expect(first).toBe(second);
  });

  it('returns a different object when the scheme differs', () => {
    const light = buildTheme({ phase: 'before', scheme: 'light', largeText: false });
    const dark = buildTheme({ phase: 'before', scheme: 'dark', largeText: false });
    expect(light).not.toBe(dark);
  });
});
