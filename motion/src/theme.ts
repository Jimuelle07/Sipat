import palette from '../../assets/color-palette/palette.json';
import { Easing } from 'remotion';
import { display, inter, serif } from './fonts';

export { palette };
export type Phase = 'before' | 'during' | 'after';

const { blue: b, sticker: s, phase: ph, alert: a, gray: g } = palette;

/** Light-scheme colour roles, mirroring stickerLightColors() in app/ui/theme/themes.ts. */
export function roles(phase: Phase) {
  return {
    canvas: ph[phase].soft,
    surface: s.paper,
    surfaceSunken: b['50'],
    hairline: b['300'],
    controlBorder: b['700'],
    text: b['900'],
    textMuted: b['800'],
    accentText: b['800'],
    highlight: { fill: b['400'], ink: b['900'] },
    selected: { fill: b['300'], ink: b['900'] },
    brand: b['800'],
    stroke: b['800'],
    ink: b['900'],
    wash: phase === 'before' ? s.mint : phase === 'during' ? s.sunburst : ph.after.main,
    danger: { fill: phase === 'during' ? a.deep : a.main, ink: g['0'] },
    dangerSurface: { fill: a.tint, ink: a.deep },
  };
}
export type Roles = ReturnType<typeof roles>;
export type Tone = { fill: string; ink: string };

/** buildWarningTones() in themes.ts. */
export const warningTones = {
  tcws: {
    1: { fill: s.sunburst, ink: g['900'] },
    2: { fill: ph.during.main, ink: g['900'] },
    3: { fill: s.ember, ink: g['900'] },
    4: { fill: a.main, ink: g['0'] },
    5: { fill: a.deep, ink: g['0'] },
  },
} as const;

/** REGULAR_TYPE and TYPE_EM in themes.ts; weight 800 renders in Bowlby One like the app's Txt. */
const TYPE = {
  display: [56, 54, 800, -0.02],
  headline: [26, 32, 800, -0.01],
  title: [16, 22, 800, 0],
  lead: [19, 25, 700, -0.03],
  body: [17, 24, 500, -0.01],
  bodySmall: [15, 21, 500, -0.01],
  label: [15, 18, 700, -0.04],
  caption: [13, 17, 700, 0],
} as const;
export type TypeRole = keyof typeof TYPE;

export function type(role: TypeRole, color?: string): React.CSSProperties {
  const [fontSize, lineHeight, weight, em] = TYPE[role];
  return {
    fontFamily: weight === 800 ? display : inter,
    fontWeight: weight === 800 ? 400 : weight,
    fontSize,
    lineHeight: `${lineHeight}px`,
    letterSpacing: Math.round(fontSize * em * 100) / 100,
    color,
  };
}

export const fonts = { display, inter, serif };
export const space = { hair: 2, xs: 4, sm: 6, md: 8, gutter: 10, lg: 14, xl: 16, tile: 20, xxl: 24, section: 30, xxxl: 40 };
export const radius = { form: 16, media: 16, menu: 20, panel: 24, capsule: 40, pill: 999 };
export const border = { hairline: 1, control: 1.5, emphasis: 2 };
export const minTouch = 48;

/** buildShadow('light') in themes.ts, as CSS. */
export const shadow = {
  sticker: '0 2px 3px rgba(0,0,0,0.22), 0 10px 22px -4px rgba(0,0,0,0.24)',
  float: '0 4px 6px rgba(0,0,0,0.2), 0 20px 36px -6px rgba(0,0,0,0.32)',
};

/** buildMotion() curves in themes.ts. */
export const ease = {
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.32, 0, 0.67, 0),
  calm: Easing.bezier(0.45, 0, 0.55, 1),
  // Enter curve with a sub-2% overshoot, for objects that land and settle.
  settle: Easing.bezier(0.2, 1.08, 0.36, 1),
};
