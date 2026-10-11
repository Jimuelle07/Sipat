// Web reconstructions of the app's primitives in app/ui/components, in dp, light scheme.
// Each mirrors the RN StyleSheet of the component it names.
import type { CSSProperties, ReactNode } from 'react';
import glyphs from '../lib/ionicons.json';
import { iconFamily } from '../fonts';
import { border, minTouch, radius, shadow, space, type } from '../theme';
import type { Roles, Tone, TypeRole } from '../theme';

export type IconName = keyof typeof glyphs;

/** @expo/vector-icons Ionicons glyph, from the same font file the app ships. */
export function Icon({ name, size, color, style }: { name: IconName; size: number; color: string; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: iconFamily, fontSize: size, lineHeight: `${size}px`, width: size, height: size, color, display: 'inline-block', textAlign: 'center', flexShrink: 0, ...style }}>
      {String.fromCodePoint(glyphs[name])}
    </span>
  );
}

export function Txt({ role = 'body', color, style, children }: { role?: TypeRole; color: string; style?: CSSProperties; children: ReactNode }) {
  return <div style={{ ...type(role, color), ...style }}>{children}</div>;
}

/** Tile.tsx: soft floating surface, radius.panel, control border, sticker shadow. */
export function Tile({ c, title, tone = 'default', wash, tilt = 0, style, children }: {
  c: Roles; title?: string; tone?: 'default' | 'accent'; wash?: string; tilt?: number; style?: CSSProperties; children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: space.lg, padding: space.tile,
        backgroundColor: wash ?? c.surface,
        border: `${tone === 'accent' ? border.emphasis : border.control}px solid ${tone === 'accent' ? c.accentText : c.controlBorder}`,
        borderRadius: radius.panel, boxShadow: shadow.sticker,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {title !== undefined ? <Txt role="title" color={c.text}>{title}</Txt> : null}
      {children}
    </div>
  );
}

/** Tag.tsx: caption pill, selected tone by default. */
export function Tag({ c, label, tone, icon, style }: { c: Roles; label: string; tone?: Tone; icon?: IconName; style?: CSSProperties }) {
  const fill = tone?.fill ?? c.selected.fill;
  const ink = tone?.ink ?? c.selected.ink;
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: space.xs, padding: `${space.xs}px ${space.gutter}px`, borderRadius: radius.pill, backgroundColor: fill, ...style }}>
      {icon ? <Icon name={icon} size={13} color={ink} /> : null}
      <Txt role="caption" color={ink} style={{ whiteSpace: 'nowrap' }}>{label}</Txt>
    </div>
  );
}

/** Chip.tsx: outlined pill on surface. */
export function Chip({ c, label }: { c: Roles; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: minTouch, padding: `0 ${space.lg}px`, borderRadius: radius.pill, border: `${border.control}px solid ${c.controlBorder}`, backgroundColor: c.surface, boxShadow: shadow.sticker }}>
      <Txt role="label" color={c.text} style={{ whiteSpace: 'nowrap' }}>{label}</Txt>
    </div>
  );
}

/** Button.tsx variant "text": the quiet inline action. */
export function TextButton({ c, label, icon, style }: { c: Roles; label: string; icon?: IconName; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minHeight: minTouch, padding: `0 ${space.xs}px`, ...style }}>
      {icon ? <Icon name={icon} size={15} color={c.brand} /> : null}
      <Txt role="label" color={c.brand} style={{ whiteSpace: 'nowrap' }}>{label}</Txt>
    </div>
  );
}

/** ProgressBar.tsx: caption label over a sunken pill track filled with the phase wash. */
export function ProgressBar({ c, value, label }: { c: Roles; value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
      <Txt role="caption" color={c.textMuted}>{label}</Txt>
      <div style={{ height: space.xl, borderRadius: radius.pill, backgroundColor: c.surfaceSunken, border: `${border.control}px solid ${c.stroke}`, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, value)) * 100}%`, borderRadius: radius.pill, backgroundColor: c.wash }} />
      </div>
    </div>
  );
}

/** ClosingLine.tsx: short hairline rule over the accent safety line. */
export function ClosingLine({ c, text, role = 'bodySmall' }: { c: Roles; text: string; role?: TypeRole }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      <div style={{ height: border.hairline, width: space.xxxl, backgroundColor: c.hairline }} />
      <Txt role={role} color={c.accentText}>{text}</Txt>
    </div>
  );
}

/** Scales a dp-sized subtree to film pixels from its top-left corner. */
export function Zoom({ k, x, y, w, style, children }: { k: number; x: number; y: number; w: number; style?: CSSProperties; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, transform: `scale(${k})`, transformOrigin: '0 0', ...style }}>
      {children}
    </div>
  );
}
