import type { ColorLevel, Phase, TcwsLevel } from '../../engine';

export type { ColorLevel, Phase, TcwsLevel };

/** The palette as shipped in assets/color-palette/palette.json. The only source of color in app/ui. */
export interface Palette {
  mascot: { original: string; refresh: string };
  blue: Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
  phase: Record<Phase, { tint: string; soft: string; main: string; deep: string }>;
  gray: Record<'0' | '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', string>;
  alert: { tint: string; soft: string; main: string; deep: string };
  /** design/design-v2 sticker set: the shared confetti palette. */
  sticker: Record<'carbon' | 'paper' | 'skyWash' | 'concrete' | 'mist' | 'blue' | 'mint' | 'lavender' | 'ember' | 'sunburst' | 'violet', string>;
  dark: { bg: string; surface: string; border: string; primary: string; text: string };
}

export type Scheme = 'light' | 'dark';

export interface ThemeOptions {
  phase: Phase;
  scheme: Scheme;
  largeText: boolean;
}

/** A filled surface and the ink that sits on it. Every pair keeps WCAG AA (4.5:1). */
export interface Tone {
  fill: string;
  ink: string;
}

/** Semantic color roles. Every value is a palette entry. */
export interface ColorRoles {
  canvas: string;          // screen background; tiles float on it with gutters
  surface: string;         // tiles, cards, sheets
  surfaceSunken: string;   // inputs, tracks, quiet wells inside a tile
  hairline: string;        // decorative dividers only (no contrast duty)
  controlBorder: string;   // input and control outlines; ≥3:1 against surface and canvas
  text: string;            // primary ink
  textMuted: string;       // secondary ink; ≥4.5:1 on surface and canvas
  accentText: string;      // phase-colored ink for headings, icons, selected labels; ≥4.5:1 on surface and canvas
  highlight: Tone;         // the single highlighter action per view (design/ "one accent")
  primary: Tone;           // filled primary button
  capsule: Tone;           // the CTA capsule container
  selected: Tone;          // selected chip or segment
  brand: string;           // Sipat blue: links, wordmark; ≥4.5:1 on surface and canvas
  focus: string;           // focus ring; ≥3:1 on surface and canvas
  danger: Tone;            // emergency fill (alert)
  dangerSurface: Tone;     // calm alert surface: tinted fill with alert ink
  scrim: string;           // overlay behind sheets and the crop frame; applied with scrimOpacity
  mascot: { original: string; refresh: string }; // reserved for the mascot slot only
  stroke: string;          // outlines on cards, buttons and stickers: a blue, never black
  ink: string;             // text and icons on a phase wash
  wash: string;            // the phase's big sticker colour: hero blob, selected segment, decorations
  stickers: Palette['sticker']; // the shared sticker set for decorations only
}

export type WarningTone = Tone;

export interface WarningTones {
  tcws: Record<TcwsLevel, WarningTone>;
  color: Record<ColorLevel, WarningTone>; // rainfall and surge
  onOff: WarningTone;                      // gale and barangay order
}

export interface TextStyleToken {
  fontSize: number;      // sp
  lineHeight: number;    // sp
  fontWeight: '400' | '500' | '700' | '800';
  letterSpacing: number; // sp (design/ em tracking × fontSize)
}

export type TypeRole =
  | 'display' | 'headline' | 'title' | 'lead' | 'body' | 'bodySmall' | 'label' | 'caption';

export interface Typography {
  /** Bundled faces: heavy display for headings, Inter for reading. Loaded once at the app root. */
  families: { display: string; medium: string; bold: string; serif: string; serifBold: string; serifItalic: string };
  roles: Record<TypeRole, TextStyleToken>;
  maxFontSizeMultiplier: number;
}

export interface Spacing {
  hair: number;     // 2
  xs: number;       // 4
  sm: number;       // 6
  md: number;       // 8
  gutter: number;   // 10, design/ base gutter: tiles float on the canvas
  lg: number;       // 14, capsule gap
  xl: number;       // 16
  tile: number;     // 20, tile padding
  xxl: number;      // 24
  section: number;  // gap between Home sections (per phase)
  xxxl: number;     // 40
}

export interface Radii {
  form: number;    // 10
  media: number;   // 14
  menu: number;    // 16
  panel: number;   // 20
  capsule: number; // 36
  pill: number;    // 999
}

export type Bezier = readonly [number, number, number, number];

export interface Motion {
  style: 'full' | 'minimal'; // minimal: opacity only (during, or reduce motion)
  fast: number;       // ms
  base: number;       // ms
  enter: Bezier;      // crisp ease-out entrance
  exit: Bezier;       // ease-in exit
  calm: Bezier;       // balanced in-out for theme crossfades
}

export type HomeSection =
  | 'hero'            // phase name, selector and the mascot slot
  | 'switchBanner'
  | 'emergency'
  | 'warnings'        // active chips plus "Ano ang narinig mo?"
  | 'storm'           // latest bulletin summary; opens the Bagyo screen
  | 'center'          // household evacuation center
  | 'pendingPhotos'
  | 'checklist'
  | 'ask'
  | 'guide'
  | 'hotlines'
  | 'battery';

export interface MascotSlotSpec {
  size: number;                         // dp square; the slot stays empty until the art exists
  placement: 'heroEnd' | 'headerEnd' | 'heroBelow';
}

export interface ShadowSpec {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
}

export interface Theme {
  /** Soft lift under outlined stickers: a tight contact shadow plus a long ambient one. */
  shadow: { sticker: ShadowSpec[]; float: ShadowSpec[] };
  phase: Phase;
  scheme: Scheme;
  largeText: boolean;
  mood: 'prepare' | 'essentials' | 'recover';
  colors: ColorRoles;
  warning: WarningTones;
  type: Typography;
  space: Spacing;
  radius: Radii;
  border: { hairline: number; control: number; emphasis: number };
  minTouch: number;
  scrimOpacity: number;
  motion: Motion;
  home: { order: HomeSection[] };
  mascot: MascotSlotSpec;
}
