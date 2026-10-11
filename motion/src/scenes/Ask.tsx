// 5 Magtanong (grounded answer: summary first, AI second, source one tap away) and 6 Wala ito sa gabay.
import type { CSSProperties } from 'react';
import { border, ease, radius, roles, shadow, space, type } from '../theme';
import { lerp, mix, prog, tilt } from '../lib/anim';
import { F } from '../timeline';
import type { Layout } from '../layout';
import { RefusalCard, SourceTile, SummaryCard } from '../ui/components';
import { Tag, TextButton, Txt, Zoom } from '../ui/primitives';
import { goBagTitle } from './Storm';

const c = roles('during');
const COL_W = 392; // the Ask stream column in dp

const Q1 = 'Ano ang ilalagay sa go bag?';
const Q2 = 'Magkano ang bigas ngayon?';
// Passage before-gobag-01 (content/guide.tl.json): what the real search returns for Q1.
const SUMMARY_TITLE = 'Ano ang laman ng go bag';
const SUMMARY = 'Ihanda ang go bag na may tubig, pagkain, gamot, flashlight, damit, gamit sa kalinisan at mga dokumento, at suriin ito nang regular.';
// The mock engine's sample AI answer (app/engine/mock.ts), first sentence: grounded in the passage above.
const AI = 'Ayon sa gabay, ihanda ang go bag na may tubig, pagkain, gamot at mahahalagang dokumento.';

/** Measured text widths (dp) the bubbles need; see useAskWidths. */
export type AskWidths = { q1: number; q2: number; goBag: number };
export const ASK_TEXTS = { body: [Q1, Q2], title: ['Go bag'] };
const BODY_TRACK = -0.17; // body role letter-spacing in dp
const bubbleW = (textW: number, chars: number) => textW + BODY_TRACK * chars + 2 * space.xl + 2 * border.control;
const BUBBLE_H = 24 + 2 * space.md + 2 * border.control;

function typed(f: number, start: number, text: string, perChar = 1.3) {
  const n = Math.max(0, Math.min(text.length, Math.floor((f - start) / perChar) + 1));
  return { text: text.slice(0, f < start ? 0 : n), typing: f < start || n < text.length };
}

/** The asked question: body text in the selected tone, right-aligned, bottom-right corner tucked. */
function BubbleShell({ k, x, y, w, text, typing, title, fill = 1, style }: {
  k: number; x: number; y: number; w: number; text: string; typing: boolean; title?: { text: string; opacity: number }; fill?: number; style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w * k, height: BUBBLE_H * k, ...style }}>
      <div
        style={{
          position: 'absolute', inset: 0, opacity: fill, backgroundColor: c.selected.fill,
          border: `${border.control * k}px solid ${c.stroke}`, borderRadius: radius.panel * k, borderBottomRightRadius: (radius.form / 2) * k,
          boxShadow: shadow.sticker,
        }}
      />
      <div style={{ ...type('body', c.selected.ink), position: 'absolute', left: (space.xl + border.control) * k, top: (space.md + border.control) * k, fontSize: 17 * k, lineHeight: `${24 * k}px`, letterSpacing: -0.17 * k, whiteSpace: 'nowrap' }}>
        {text}
        {typing ? <span style={{ display: 'inline-block', width: 2 * k, height: 20 * k, marginLeft: 1 * k, verticalAlign: 'middle', backgroundColor: c.text }} /> : null}
      </div>
      {title ? (
        <div style={{ ...type('title', c.text), position: 'absolute', left: (space.xl + border.control) * k, top: (space.md + border.control + 1) * k, fontSize: 16 * k, lineHeight: `${22 * k}px`, opacity: title.opacity, whiteSpace: 'nowrap' }}>{title.text}</div>
      ) : null}
    </div>
  );
}

/** Origin of the Ask stream column: in 16:9 it starts centred and pans left as the source opens beside it; in 9:16
 * the question lands where the Go bag tile was and the conversation scrolls up on send. */
export function askColumn(f: number, L: Layout) {
  return {
    x: lerp(prog(f, F.source - 8, 32, ease.calm), L.ask.xStart, L.ask.x),
    y: lerp(prog(f, F.toAsk + 54, 28, ease.calm), L.ask.yStart, L.ask.y),
  };
}

/** The summary card's "Saan galing ito?" link (dp 88, 247.5 from the column origin, measured from a render). */
export function sourceLink(f: number, L: Layout) {
  const c = askColumn(f, L);
  return { x: c.x + 88 * L.ask.k, y: c.y + 247.5 * L.ask.k };
}

/** Centre of the refusal card. */
export const refusalCentre = (L: Layout) => ({ x: L.ask2.x + 196 * L.ask2.k, y: L.ask2.y + (BUBBLE_H + space.lg + 100) * L.ask2.k });

export function Ask({ f, L, widths }: { f: number; L: Layout; widths: AskWidths }) {
  const ASK = L.ask;
  const SOURCE = L.source;
  const title = goBagTitle(L);
  if (f < F.toAsk - 12 || f > F.toRefusal + 40) return null;
  // The Go bag title lifts and becomes the question bubble.
  const lift = prog(f, F.toAsk - 10, 12, ease.enter);
  const m = prog(f, F.toAsk + 2, 34, ease.enter);
  const finalW = bubbleW(widths.q1, Q1.length);
  const k = lerp(m, title.k * (1 + 0.06 * lift), ASK.k);
  const startX = title.x - (space.xl + border.control) * title.k;
  const startY = title.y - (space.md + border.control) * title.k - 1;
  const titleOut = prog(f, F.toAsk + 8, 8, ease.exit);
  const q = typed(f, F.toAsk + 18, Q1);
  const { x: colX, y: colY } = askColumn(f, L);
  const w = lerp(m, widths.goBag + 2 * space.xl + 2 * border.control, finalW);

  const scroll = prog(f, F.toRefusal, 32, ease.enter);
  const sy = -scroll * L.askScroll;

  const summary = prog(f, F.summary, 18, ease.enter);
  const tag = prog(f, F.aiTag, 8, ease.enter);
  const words = AI.split(' ');
  const shown = Math.max(0, Math.min(words.length, Math.floor((f - F.aiTag - 6) / 5) + 1));
  const final = prog(f, F.aiFinal, 10, ease.enter);
  const source = prog(f, F.source, 26, ease.enter) * (1 - prog(f, F.toRefusal - 22, 16, ease.exit));
  const linkPress = 1 - 0.06 * Math.sin(Math.PI * prog(f, F.source - 8, 10, ease.calm));

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateY(${sy}px)`, opacity: 1 - scroll * 0.6 }}>
      <BubbleShell
        k={k} w={w} text={q.text} typing={q.typing && titleOut >= 1} title={titleOut < 1 ? { text: 'Go bag', opacity: 1 - titleOut } : undefined}
        x={lerp(m, startX, colX + COL_W * ASK.k - finalW * ASK.k)} y={lerp(m, startY, colY)} fill={prog(f, F.toAsk - 4, 16, ease.calm)}
        style={{ transform: `translateY(${-lift * 6}px)` }}
      />
      <Zoom k={ASK.k} x={colX} y={colY + (BUBBLE_H + space.lg) * ASK.k} w={COL_W}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
          <div style={{ opacity: summary, transform: `translateY(${(1 - summary) * 16}px) perspective(1100px) rotateX(${(1 - summary) * 16}deg)`, transformOrigin: '50% 0%' }}>
            <SummaryCard c={c} title={SUMMARY_TITLE} text={SUMMARY} sourceLabel="Saan galing ito?" linkStyle={{ transform: `scale(${linkPress})`, transformOrigin: '0 50%' }} />
          </div>
          <div style={{ opacity: tag, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ height: (1 - final) * (25 + space.sm), overflow: 'hidden', opacity: 1 - final }}>
              <Tag c={c} label="Sinusuri pa" icon="sparkles" />
            </div>
            <Txt role="body" color={mix(final, c.textMuted, c.text)}>{words.slice(0, shown).join(' ')}</Txt>
            <div style={{ opacity: final, marginTop: space.sm }}><TextButton c={c} label="Saan galing ito?" icon="document-text-outline" /></div>
          </div>
        </div>
      </Zoom>
      {source > 0 ? (
        <Zoom k={SOURCE.k} x={SOURCE.x} y={SOURCE.y} w={392} style={{ clipPath: `inset(${(1 - source) * 42}% ${(1 - source) * 80}% ${(1 - source) * 42}% 0 round ${24}px)`, transform: `translateX(${(1 - source) * -90}px) scale(${SOURCE.k})` }}>
          <div style={tilt(source, 'Y', -22, '0% 50%')}><SourceTile c={c} title="Pinagmulan" line="Quezon City Government · Preparing an Emergency Go Bag (QCitizen Guide) · 2025-12-10" locator="Lugar sa dokumento: Things to Pack in an Emergency Go Bag" /></div>
        </Zoom>
      ) : null}
    </div>
  );
}

/** Off-guide question: the search gate fails, the model is never called, the refusal resolves slowly. */
export function Refusal({ f, L, widths }: { f: number; L: Layout; widths: AskWidths }) {
  const ASK2 = L.ask2;
  if (f < F.toRefusal || f > F.toAfter + 30) return null;
  const rise = 1 - prog(f, F.toRefusal, 32, ease.enter);
  const q = typed(f, F.toRefusal + 22, Q2);
  const card = prog(f, F.refusal, 40, ease.calm);
  const push = 1 + 0.05 * prog(f, F.refusal, F.toAfter - F.refusal + 10, ease.calm);
  const leave = prog(f, F.toAfter, 16, ease.exit);
  const w = bubbleW(widths.q2, Q2.length);
  const cardTop = ASK2.y + (BUBBLE_H + space.lg) * ASK2.k;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateY(${rise * L.H * 0.65 - leave * 80}px) scale(${push})`, transformOrigin: `${L.W / 2}px ${cardTop + 90}px`, opacity: 1 - leave }}>
      <BubbleShell k={ASK2.k} w={w} text={q.text} typing={q.typing} x={ASK2.x + COL_W * ASK2.k - w * ASK2.k} y={ASK2.y} />
      <Zoom k={ASK2.k} x={ASK2.x} y={cardTop} w={COL_W} style={{ opacity: card, transform: `translateY(${(1 - card) * 8 * ASK2.k}px) scale(${ASK2.k})` }}>
        <div style={tilt(card, 'X', 14, '50% 0%')}><RefusalCard c={c} text="Wala ito sa gabay." suggestions={['Baha', 'Paghahanda sa bahay', 'Alagang hayop']} /></div>
      </Zoom>
    </div>
  );
}
