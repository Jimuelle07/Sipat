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

function stickerLightColors(phase: Phase): ColorRoles {
  const { gray: g, alert: a, sticker: s, blue: b, phase: ph } = palette;
  // Phase hue lives on the canvas and the hero: green before, orange-yellow during, purple after.
  // Blue is the UI: strokes, actions, links, selection.
  const canvas = ph[phase].soft;
  const wash = phase === 'before' ? s.mint : phase === 'during' ? s.sunburst : ph.after.main;
  return {
    canvas,
    surface: s.paper,
    surfaceSunken: b['50'],
    hairline: b['300'],
    controlBorder: b['700'],
    text: b['900'],
    textMuted: b['800'],
    accentText: b['800'],
    highlight: tone([b['400'], b['900']]),
    primary: tone([b['800'], s.paper]),
    capsule: tone([s.paper, b['900']]),
    selected: tone([b['300'], b['900']]),
    brand: b['800'],
    focus: b['800'],
    danger: tone([phase === 'during' ? a.deep : a.main, g['0']]),
    dangerSurface: tone([a.tint, a.deep]),
    scrim: b['900'],
    mascot: palette.mascot,
    stroke: b['800'],
    ink: b['900'],
    wash,
    stickers: s,
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
    stroke: g['400'],
    ink: d.text,
    wash: p.main,
    stickers: palette.sticker,
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
    stroke: g['400'],
    ink: d.text,
    wash: p.main,
    stickers: palette.sticker,
  };
}

function buildColors(phase: Phase, scheme: Scheme): ColorRoles {
  const p = palette.phase[phase];
  const calm = phase !== 'during';
  if (scheme === 'light') return stickerLightColors(phase);
  return calm ? calmDarkColors(p) : duringDarkColors(p);
}

const REGULAR_TYPE: Record<'calm' | 'during', Record<TypeRole, Omit<Theme['type']['roles'][TypeRole], 'letterSpacing'>>> = {
  // Sticker-book scale: crushed heavy display, bold headings, medium body.
  calm: {
    display: { fontSize: 56, lineHeight: 54, fontWeight: '800' },
    headline: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
    title: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
    lead: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
    body: { fontSize: 17, lineHeight: 24, fontWeight: '500' },
    bodySmall: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
    label: { fontSize: 15, lineHeight: 18, fontWeight: '700' },
    caption: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  },
  during: {
    display: { fontSize: 52, lineHeight: 52, fontWeight: '800' },
    headline: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
    lead: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
    body: { fontSize: 19, lineHeight: 27, fontWeight: '500' },
    bodySmall: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
    label: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
    caption: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  },
};

const TYPE_EM: Record<TypeRole, number> = {
  display: -0.02,
  headline: -0.01,
  title: 0,
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

  return { families: { display: 'BowlbyOne_400Regular', medium: 'Inter_500Medium', bold: 'Inter_700Bold' }, roles, maxFontSizeMultiplier: largeText ? 1.3 : 1.6 };
}

function buildWarningTones(): WarningTones {
  const { gray: g, blue: b, alert: a, phase } = palette;
  const during = phase.during;
  return {
    tcws: {
      1: tone([palette.sticker.sunburst, g['900']]),
      2: tone([during.main, g['900']]),
      3: tone([palette.sticker.ember, g['900']]),
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

function buildShadow(scheme: Scheme): Theme['shadow'] {
  // Dark canvases swallow carbon shadows, so they run deeper there.
  const ink = palette.sticker.carbon;
  const k = scheme === 'dark' ? 1.8 : 1;
  const a = (alpha: number): string => `${ink}${Math.round(Math.min(alpha * k, 1) * 255).toString(16).padStart(2, '0')}`;
  return {
    sticker: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, spreadRadius: 0, color: a(0.22) },
      { offsetX: 0, offsetY: 10, blurRadius: 22, spreadRadius: -4, color: a(0.24) },
    ],
    float: [
      { offsetX: 0, offsetY: 4, blurRadius: 6, spreadRadius: 0, color: a(0.2) },
      { offsetX: 0, offsetY: 20, blurRadius: 36, spreadRadius: -6, color: a(0.32) },
    ],
  };
}

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
    shadow: buildShadow(opts.scheme),
    warning: buildWarningTones(),
    type: buildType(opts.phase, opts.largeText),
    space: {
      hair: 2, xs: 4, sm: 6, md: 8, gutter: 10, lg: 14, xl: 16,
      tile: 20, xxl: 24, section: opts.phase === 'before' ? 30 : opts.phase === 'during' ? 20 : 40, xxxl: 40,
    },
    radius: { form: 16, media: 16, menu: 20, panel: 24, capsule: 40, pill: 999 },
    border: calm ? { hairline: 1, control: 1.5, emphasis: 2 } : { hairline: 1.5, control: 2, emphasis: 2.5 },
    minTouch: opts.largeText ? (calm ? 56 : 64) : (calm ? 48 : 56),
    scrimOpacity: 0.72,
    motion: buildMotion(opts.phase),
    home: { order: [...HOME_ORDER[opts.phase]] },
    mascot: opts.phase === 'before'
      ? { size: 168, placement: 'heroEnd' }
      : opts.phase === 'during'
        ? { size: 48, placement: 'headerEnd' }
        : { size: 168, placement: 'heroBelow' },
  };

  cache.set(key, theme);
  return theme;
}
