// The phone: status bar glyphs, body, and the after-phase Home screen it shows at the end.
import { Img, staticFile } from 'remotion';
import { border, fonts, minTouch, palette, radius, roles, shadow, space } from '../theme';
import type { Roles } from '../theme';
import { HeroPoster, Marquee, MascotSlot, PhaseSelector } from './home';
import { Icon, Tile, Txt } from './primitives';

export const SCREEN = { w: 412, h: 915, status: 30 };

/** Status bar in dp (412 wide). `drop[i]` 0→1 takes signal bar i away; `plane` 0→1 brings the airplane in. */
export function StatusGlyphs({ color, drop = [0, 0, 0, 0], plane = 0, ghost = 0, width = SCREEN.w }: {
  color: string; drop?: number[]; plane?: number; ghost?: number; width?: number;
}) {
  return (
    <div style={{ width, height: SCREEN.status, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
      <div style={{ fontFamily: fonts.inter, fontWeight: 700, fontSize: 15, letterSpacing: -0.1, color }}>9:12</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ position: 'relative', width: 21, height: 14 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            {[4.5, 7.5, 10.5, 13.5].map((h, i) => {
              const d = drop[i] ?? 0;
              return (
                <div key={i} style={{ position: 'relative', width: 3.6, height: h }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 1, backgroundColor: color, opacity: ghost * 0.22 }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 1, backgroundColor: color, opacity: 1 - d, transform: `translateY(${d * 9}px) scaleY(${1 - d * 0.6})`, transformOrigin: 'bottom' }} />
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: 3, top: -1, opacity: plane, transform: `translateX(${(1 - plane) * -16}px)` }}>
            <Icon name="airplane" size={16} color={color} style={{ transform: 'rotate(-45deg)' }} />
          </div>
        </div>
        <div style={{ position: 'relative', width: 23, height: 11.5, borderRadius: 3.5, border: `1.4px solid ${color}`, padding: 1.4 }}>
          <div style={{ width: '78%', height: '100%', borderRadius: 1.6, backgroundColor: color }} />
          <div style={{ position: 'absolute', right: -4, top: 2.4, width: 2, height: 4.4, borderRadius: 1, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

/** Layout anchors of AfterHome in dp (screen coordinates), used to hand the film's mascot over to the poster. */
export const HOME = {
  posterTop: 195,
  posterLeft: 10,
  posterW: 392,
  posterBottom: 595,
  selectorTop: 649,
  mascotSlot: { left: 180, top: 389, size: 230 },
};

/** HomeScreen in the after phase, as the demo household sees it. `chrome` fades everything but the hero section. */
export function AfterHome({ frame, chrome, at, pop, posterRise, posterIn, mascot, status, selectorDrop = 0, selectorIn = 1 }: {
  frame: number; chrome: number; at: number; pop: [number, number, number]; posterRise: number; posterIn: number; mascot: boolean; status: number;
  selectorDrop?: number; selectorIn?: number;
}) {
  const c: Roles = roles('after');
  const fade = { opacity: chrome };
  return (
    <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h }}>
      <div style={{ position: 'absolute', top: 0, left: 0, opacity: status }}><StatusGlyphs color={c.ink} plane={1} drop={[1, 1, 1, 1]} /></div>
      <div style={{ position: 'absolute', top: SCREEN.status + space.md, left: space.gutter, right: space.gutter, height: minTouch, display: 'flex', alignItems: 'center', gap: space.sm, ...fade }}>
        <Img src={staticFile('app-icon.png')} style={{ width: minTouch * 0.75, height: minTouch * 0.75, borderRadius: radius.pill }} />
        <div style={{ display: 'flex', padding: 3, borderRadius: radius.pill, border: `${border.control}px solid ${c.stroke}`, backgroundColor: c.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: radius.pill, backgroundColor: c.selected.fill }}>
            <Icon name="checkmark" size={13} color={c.text} /><Txt role="label" color={c.text}>Tagalog</Txt>
          </div>
          <div style={{ padding: '7px 12px' }}><Txt role="label" color={c.text}>English</Txt></div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: radius.pill, border: `${border.control}px solid ${c.stroke}`, backgroundColor: c.surface }}>
          <Icon name="sparkles" size={13} color={c.text} /><Txt role="caption" color={c.text}>AI handa</Txt>
        </div>
      </div>
      <Txt role="headline" color={c.text} style={{ position: 'absolute', top: 104, left: space.gutter, ...fade }}>Tahanan</Txt>
      <div style={{ position: 'absolute', top: 152, left: 0, ...fade }}>
        <Marquee c={c} text="Pagkatapos ng bagyo · Dahan-dahang bumangon." frame={frame} width={SCREEN.w} />
      </div>
      <div style={{ position: 'absolute', top: HOME.posterTop, left: HOME.posterLeft, opacity: posterIn, transform: `translateY(${(1 - posterRise) * 12}px) perspective(1100px) rotateX(${(1 - posterRise) * 18}deg)`, transformOrigin: '50% 100%' }}>
        <HeroPoster c={c} title="Pagkatapos ng bagyo" mood="Dahan-dahang bumangon." pop={pop} mascot={mascot ? <MascotSlot phase="after" size={HOME.mascotSlot.size} /> : null} />
      </div>
      <div style={{ position: 'absolute', top: HOME.selectorTop, left: HOME.posterLeft, opacity: selectorIn, transform: `translateY(${selectorDrop}px)` }}>
        <PhaseSelector c={c} at={at} />
        <Txt role="bodySmall" color={c.textMuted} style={{ marginTop: space.sm, paddingLeft: space.xs, ...fade }}>Manwal na pinili.</Txt>
      </div>
      <div style={{ position: 'absolute', top: 765, left: space.gutter, width: 392, ...fade }}>
        <Tile c={c} title="Mga dapat gawin" wash={palette.blue['200']} tilt={0.8}><div style={{ height: 60 }} /></Tile>
      </div>
      <div style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: space.gutter, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', borderRadius: radius.pill, border: `${border.control}px solid ${c.stroke}`, backgroundColor: c.surface, boxShadow: shadow.sticker, ...fade }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 34px', borderRadius: radius.pill, border: `${border.control}px solid ${c.stroke}`, backgroundColor: c.wash }}>
          <Icon name="home" size={20} color={c.ink} /><Txt role="label" color={c.ink}>Bahay</Txt>
        </div>
        {(['chatbubble-ellipses-outline', 'book-outline', 'call-outline', 'people-outline'] as const).map((n) => (
          <Icon key={n} name={n} size={22} color={c.ink} style={{ margin: '0 12px' }} />
        ))}
      </div>
    </div>
  );
}
