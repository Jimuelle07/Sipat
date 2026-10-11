// Reconstructions of the app's screen components (app/ui/components/*), in dp.
import type { CSSProperties } from 'react';
import { border, minTouch, radius, shadow, space } from '../theme';
import type { Roles, Tone } from '../theme';
import { Chip, Icon, Tag, TextButton, Tile, Txt } from './primitives';

/** HomeScreen menuHead: the collapsible "Signal ng hangin" pill in the warning picker. */
export function MenuHead({ c, label, open, chosen }: { c: Roles; label: string; open: boolean; chosen?: string }) {
  return (
    <div style={{ minHeight: minTouch, display: 'flex', alignItems: 'center', gap: space.md, padding: `0 ${space.xl}px`, borderRadius: radius.pill, border: `${border.control}px solid ${c.stroke}`, backgroundColor: open ? c.selected.fill : c.surface, boxShadow: shadow.sticker }}>
      <div style={{ flex: 1 }}>
        <Txt role="label" color={c.text}>{label}</Txt>
        {chosen ? <Txt role="caption" color={c.textMuted}>{chosen}</Txt> : null}
      </div>
      {chosen ? <Icon name="checkmark-circle" size={16} color={c.accentText} /> : null}
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.ink} />
    </div>
  );
}

/** WarningOption.tsx: tall tile in the picker grid; selection adds a check and a 2 dp border. */
export function WarningOption({ label, tone, selected, style }: { label: string; tone: Tone; selected: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'relative', minHeight: minTouch * 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: space.sm, borderRadius: radius.menu, backgroundColor: tone.fill,
        boxShadow: `inset 0 0 0 ${border.hairline + selected * (border.emphasis - border.hairline)}px ${tone.ink}`,
        ...style,
      }}
    >
      <div style={{ position: 'absolute', top: space.md, right: space.md, opacity: selected, transform: `scale(${0.6 + 0.4 * selected})` }}>
        <Icon name="checkmark-circle" size={16} color={tone.ink} />
      </div>
      <Txt role="label" color={tone.ink} style={{ textAlign: 'center' }}>{label}</Txt>
    </div>
  );
}

/** SwitchBanner.tsx: the phase-switch alert. Sender is always the app, never an agency. */
export function SwitchBanner({ c, sender, time, text, reason, undoLabel, style }: {
  c: Roles; sender: string; time: string; text: string; reason: string; undoLabel: string; style?: CSSProperties;
}) {
  const ink = c.danger.ink;
  return (
    <div style={{ overflow: 'hidden', borderRadius: radius.menu, border: `${border.emphasis}px solid ${c.danger.fill}`, backgroundColor: c.surface, boxShadow: shadow.float, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.md, minHeight: minTouch, paddingLeft: space.xl, backgroundColor: c.danger.fill }}>
        <Icon name="warning" size={19} color={ink} />
        <Txt role="label" color={ink} style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{sender}</Txt>
        <Txt role="caption" color={ink}>{time}</Txt>
        <div style={{ width: minTouch, height: minTouch, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={19} color={ink} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, padding: `${space.lg}px ${space.xl}px ${space.md}px` }}>
        <Txt role="title" color={c.text}>{text}</Txt>
        <Txt role="body" color={c.textMuted}>{reason}</Txt>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 ${space.md}px ${space.sm}px` }}>
        <TextButton c={c} label={undoLabel} icon="arrow-undo" />
      </div>
    </div>
  );
}

/** ChecklistRow.tsx: `tick` 0→1 animates the press and the check. */
export function ChecklistRow({ c, text, tick, tag }: { c: Roles; text: string; tick: number; tag?: string }) {
  const done = tick >= 0.5;
  const press = tick > 0 && tick < 1 ? 1 - 0.08 * Math.sin(Math.PI * tick) : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.lg, minHeight: minTouch, padding: `${space.sm}px 0` }}>
      <div
        style={{
          width: minTouch / 2, height: minTouch / 2, borderRadius: space.md, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `${border.control}px solid ${done ? c.selected.fill : c.controlBorder}`,
          backgroundColor: done ? c.selected.fill : 'transparent', transform: `scale(${press})`,
        }}
      >
        <Icon name="checkmark" size={15} color={c.selected.ink} style={{ opacity: done ? 1 : 0, transform: `scale(${done ? 0.7 + 0.3 * Math.min(1, (tick - 0.5) * 2) : 0.7})` }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space.xs }}>
        <Txt role="body" color={done ? c.textMuted : c.text} style={{ textDecoration: done ? 'line-through' : 'none' }}>{text}</Txt>
        {tag ? <Tag c={c} label={tag} /> : null}
      </div>
    </div>
  );
}

/** SummaryCard.tsx: the vetted guide summary, with the source link. */
export function SummaryCard({ c, title, text, sourceLabel, linkStyle }: { c: Roles; title: string; text: string; sourceLabel: string; linkStyle?: CSSProperties }) {
  return (
    <Tile c={c} title={title}>
      <Txt role="body" color={c.text}>{text}</Txt>
      <TextButton c={c} label={sourceLabel} icon="document-text-outline" style={{ alignSelf: 'flex-start', ...linkStyle }} />
    </Tile>
  );
}

/** RefusalCard.tsx: "Wala ito sa gabay." with chips for topics the guides do cover. */
export function RefusalCard({ c, text, suggestions }: { c: Roles; text: string; suggestions: string[] }) {
  return (
    <Tile c={c}>
      <Txt role="body" color={c.text}>{text}</Txt>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm }}>
        {suggestions.map((s) => <Chip key={s} c={c} label={s} />)}
      </div>
    </Tile>
  );
}

/** PassageScreen "Pinagmulan" tile: agency · title · date, then the locator. */
export function SourceTile({ c, title, line, locator }: { c: Roles; title: string; line: string; locator: string }) {
  return (
    <Tile c={c} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        <Txt role="body" color={c.text}>{line}</Txt>
        <Txt role="bodySmall" color={c.textMuted}>{locator}</Txt>
      </div>
    </Tile>
  );
}
