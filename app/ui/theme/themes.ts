import { palette } from './palette';
import type {
  ColorRoles,
  HomeSection,
  Motion,
  Phase,
  Scheme,
  Theme,
  ThemeOptions,
  Tone,
  TypeRole,
  WarningTones,
} from './types';

const cache = new Map<string, Theme>();

type PhasePalette = (typeof palette.phase)[Phase];
type TonePair = readonly [fill: string, ink: string];

function tone([fill, ink]: TonePair): Tone {
  return { fill, ink };
}

function calmLightColors(p: PhasePalette): ColorRoles {
  const { gray: g, dark: d, alert: a, blue: b } = palette;
  return {
    canvas: p.tint,
    surface: g['0'],
    surfaceSunken: g['50'],
    hairline: g['200'],
    controlBorder: g['500'],
    text: g['900'],
    textMuted: g['600'],
    accentText: p.deep,
    highlight: tone([p.main, g['900']]),
    primary: tone([p.deep, g['0']]),
    capsule: tone([p.soft, g['900']]),
    selected: tone([p.soft, g['900']]),
    brand: b['700'],
    focus: b['700'],
    danger: tone([a.main, g['0']]),
    dangerSurface: tone([a.tint, a.deep]),
    scrim: g['900'],
    mascot: palette.mascot,
  };
}

function duringLightColors(p: PhasePalette): ColorRoles {
  const { gray: g, alert: a, blue: b } = palette;
  return {
    canvas: g['0'],
    surface: g['0'],
    surfaceSunken: g['100'],
    hairline: g['900'],
    controlBorder: g['900'],
    text: g['900'],
    textMuted: g['700'],
    accentText: p.deep,
    highlight: tone([p.deep, g['0']]),
    primary: tone([g['900'], g['0']]),
    capsule: tone([p.tint, g['900']]),
    selected: tone([g['900'], g['0']]),
    brand: b['800'],
    focus: b['800'],
    danger: tone([a.deep, g['0']]),
    dangerSurface: tone([a.tint, a.deep]),
    scrim: g['900'],
    mascot: palette.mascot,
  };
}

function calmDarkColors(p: PhasePalette): ColorRoles {
  const { gray: g, dark: d, alert: a } = palette;
  return {
    canvas: d.bg,
    surface: d.surface,
    surfaceSunken: d.bg,
    hairline: d.border,
    controlBorder: g['400'],
    text: d.text,
    textMuted: g['400'],
    accentText: p.main,
    highlight: tone([p.main, g['900']]),
    primary: tone([p.soft, g['900']]),
    capsule: tone([d.border, d.text]),
    selected: tone([p.main, g['900']]),
    brand: d.primary,
    focus: d.primary,
    danger: tone([a.main, g['0']]),
    dangerSurface: tone([d.surface, a.soft]),
    scrim: g['900'],
    mascot: palette.mascot,
  };
}

function duringDarkColors(p: PhasePalette): ColorRoles {
  const { gray: g, dark: d, alert: a } = palette;
  return {
    canvas: d.bg,
    surface: d.bg,
    surfaceSunken: d.surface,
    hairline: g['300'],
    controlBorder: g['300'],
    text: g['0'],
    textMuted: g['300'],
    accentText: p.main,
    highlight: tone([p.main, g['900']]),
    primary: tone([g['0'], g['900']]),
    capsule: tone([d.surface, g['0']]),
    selected: tone([p.main, g['900']]),
    brand: d.primary,
    focus: d.primary,
    danger: tone([a.main, g['0']]),
    dangerSurface: tone([d.surface, a.soft]),
    scrim: g['900'],
    mascot: palette.mascot,
  };
}

function buildColors(phase: Phase, scheme: Scheme): ColorRoles {
  const p = palette.phase[phase];
  const calm = phase !== 'during';
  if (scheme === 'light') return calm ? calmLightColors(p) : duringLightColors(p);
  return calm ? calmDarkColors(p) : duringDarkColors(p);
}

const REGULAR_TYPE: Record<'calm' | 'during', Record<TypeRole, Omit<Theme['type']['roles'][TypeRole], 'letterSpacing'>>> = {
  calm: {
    display: { fontSize: 38, lineHeight: 42, fontWeight: '500' },
    headline: { fontSize: 28, lineHeight: 32, fontWeight: '500' },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
    lead: { fontSize: 19, lineHeight: 26, fontWeight: '500' },
    body: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
    bodySmall: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
    label: { fontSize: 15, lineHeight: 18, fontWeight: '500' },
    caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  },
  during: {
    display: { fontSize: 46, lineHeight: 50, fontWeight: '700' },
    headline: { fontSize: 32, lineHeight: 36, fontWeight: '700' },
    title: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
    lead: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
    body: { fontSize: 19, lineHeight: 27, fontWeight: '400' },
    bodySmall: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
    label: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
    caption: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  },
};

const TYPE_EM: Record<TypeRole, number> = {
  display: -0.03,
  headline: -0.04,
  title: -0.03,
  lead: -0.03,
  body: -0.01,
  bodySmall: -0.01,
  label: -0.04,
  caption: 0,
};

function buildType(phase: Phase, largeText: boolean): Theme['type'] {
  const family = phase === 'during' ? 'during' : 'calm';
  const roles = Object.fromEntries(
    Object.entries(REGULAR_TYPE[family]).map(([role, style]) => {
      const fontSize = largeText ? Math.round(style.fontSize * 1.25) : style.fontSize;
      const lineHeight = largeText ? Math.round(style.lineHeight * 1.25) : style.lineHeight;
      return [role, {
        ...style,
        fontSize,
        lineHeight,
        letterSpacing: Math.round(fontSize * TYPE_EM[role as TypeRole] * 100) / 100,
      }];
    }),
  ) as Theme['type']['roles'];

  return { fontFamily: undefined, roles, maxFontSizeMultiplier: largeText ? 1.3 : 1.6 };
}

function buildWarningTones(): WarningTones {
  const { gray: g, blue: b, alert: a, phase } = palette;
  const during = phase.during;
  return {
    tcws: {
      1: tone([during.soft, g['900']]),
      2: tone([during.main, g['900']]),
      3: tone([during.deep, g['0']]),
      4: tone([a.main, g['0']]),
      5: tone([a.deep, g['0']]),
    },
    color: {
      yellow: tone([during.soft, g['900']]),
      orange: tone([during.main, g['900']]),
      red: tone([a.main, g['0']]),
    },
    onOff: tone([b['800'], g['0']]),
  };
}

function buildMotion(phase: Phase): Motion {
  const calm = phase === 'before'
    ? { fast: 200, base: 300, reveal: 600, stagger: 40, highlight: 450, rise: 16 }
    : phase === 'after'
      ? { fast: 200, base: 320, reveal: 700, stagger: 55, highlight: 600, rise: 12 }
      : { fast: 150, base: 200, reveal: 200, stagger: 0, highlight: 0, rise: 0 };

  return {
    style: phase === 'during' ? 'minimal' : 'full',
    ...calm,
    enter: [0.16, 1, 0.3, 1],
    exit: [0.32, 0, 0.67, 0],
    calm: [0.45, 0, 0.55, 1],
  };
}

const HOME_ORDER: Record<Phase, HomeSection[]> = {
  before: ['hero', 'switchBanner', 'pendingPhotos', 'warnings', 'checklist', 'ask', 'guide', 'hotlines', 'battery'],
  during: ['switchBanner', 'emergency', 'warnings', 'center', 'checklist', 'hotlines', 'battery', 'hero'],
  after: ['switchBanner', 'hero', 'checklist', 'pendingPhotos', 'hotlines', 'guide', 'ask', 'battery'],
};

export function buildTheme(opts: ThemeOptions): Theme {
  const key = `${opts.phase}:${opts.scheme}:${opts.largeText}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const calm = opts.phase !== 'during';
  const theme: Theme = {
    phase: opts.phase,
    scheme: opts.scheme,
    largeText: opts.largeText,
    mood: opts.phase === 'before' ? 'prepare' : opts.phase === 'during' ? 'essentials' : 'recover',
    colors: buildColors(opts.phase, opts.scheme),
    warning: buildWarningTones(),
    type: buildType(opts.phase, opts.largeText),
    space: {
      hair: 2, xs: 4, sm: 6, md: 8, gutter: 10, lg: 14, xl: 16,
      tile: 20, xxl: 24, section: opts.phase === 'before' ? 30 : opts.phase === 'during' ? 20 : 40, xxxl: 40,
    },
    radius: { form: 10, media: 14, menu: 16, panel: 20, capsule: 36, pill: 999 },
    border: calm ? { hairline: 1, control: 1, emphasis: 2 } : { hairline: 2, control: 2, emphasis: 3 },
    minTouch: opts.largeText ? (calm ? 56 : 64) : (calm ? 48 : 56),
    scrimOpacity: 0.72,
    motion: buildMotion(opts.phase),
    home: { order: [...HOME_ORDER[opts.phase]] },
    mascot: opts.phase === 'before'
      ? { size: 96, placement: 'heroEnd' }
      : opts.phase === 'during'
        ? { size: 40, placement: 'headerEnd' }
        : { size: 120, placement: 'heroBelow' },
  };

  cache.set(key, theme);
  return theme;
}
