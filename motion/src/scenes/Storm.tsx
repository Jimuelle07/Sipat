// 3 The switch (warning picker → banner → orange flood) and 4 Mga dapat gawin (checklist fitted to the household).
import { border, ease, palette, radius, roles, shadow, warningTones } from '../theme';
import { lerp, mix, prog, tilt } from '../lib/anim';
import { F } from '../timeline';
import type { Layout } from '../layout';
import { Fill, growRect } from '../stage';
import { ChecklistRow, MenuHead, SwitchBanner, WarningOption } from '../ui/components';
import { ProgressBar, Tag, Tile, Txt, Zoom } from '../ui/primitives';

const before = roles('before');
const during = roles('during');

// Warning picker tile ("Ano ang narinig mo?") laid out in dp exactly as HomeScreen stacks it.
const PICK = { w: 392, inner: 349, tileW: 171.5, tileH: 96 };
const OPTIONS = [1, 2, 3, 4, 5] as const;
const optionPos = (i: number) => ({ x: 20 + (i % 2) * (PICK.tileW + 6), y: 108 + Math.floor(i / 2) * (PICK.tileH + 6) });
export function signal3(L: Layout) {
  const p = optionPos(2);
  const { x, y, k } = L.pick;
  return { x: x + (border.control + p.x) * k, y: y + (border.control + p.y) * k, w: PICK.tileW * k, h: PICK.tileH * k };
}

// The switch banner in dp; it lands at L.banner, then the checklist screen (L.left, L.right) scrolls in under it.
const BANNER = { w: 392, h: 174 };

export function Picker({ f, L }: { f: number; L: Layout }) {
  if (f < F.scrollToPicker || f > F.morph + 30) return null;
  const arrive = prog(f, F.scrollToPicker, 48, ease.calm);
  const rise = (1 - arrive) * L.household.scroll;
  const out = prog(f, F.morph, 20, ease.exit);
  const press = 1 - 0.03 * Math.sin(Math.PI * prog(f, F.tap, 10, ease.calm));
  const chosen = prog(f, F.tap + 6, 12, ease.enter);
  const heads = ['Babala sa ulan', 'Storm surge', 'Gale warning', 'Utos ng barangay'];
  return (
    <Zoom k={L.pick.k} x={L.pick.x} y={L.pick.y} w={PICK.w} style={{ transform: `translateY(${rise + out * 24}px) scale(${L.pick.k})`, opacity: 1 - out }}>
      <div style={{ ...tilt(arrive, 'X', 16, '50% 0%'), position: 'relative', height: 676, backgroundColor: before.surface, border: `${border.control}px solid ${before.controlBorder}`, borderRadius: radius.panel, boxShadow: shadow.sticker }}>
        <Txt role="title" color={before.text} style={{ position: 'absolute', left: 20, top: 20 }}>Ano ang narinig mo?</Txt>
        <div style={{ position: 'absolute', left: 20, top: 56, width: PICK.inner }}><MenuHead c={before} label="Signal ng hangin" open /></div>
        {OPTIONS.map((level, i) => {
          const p = optionPos(i);
          const isThree = level === 3;
          return (
            <div key={level} style={{ position: 'absolute', left: p.x, top: p.y, width: PICK.tileW, transform: isThree ? `scale(${press})` : undefined, opacity: isThree && f >= F.morph ? 0 : 1 }}>
              <WarningOption label={`Signal No. ${level}`} tone={warningTones.tcws[level]} selected={isThree ? chosen : 0} />
            </div>
          );
        })}
        {heads.map((h, i) => (
          <div key={h} style={{ position: 'absolute', left: 20, top: 422 + i * 62, width: PICK.inner }}><MenuHead c={before} label={h} open={false} /></div>
        ))}
      </div>
    </Zoom>
  );
}

function bannerRect(f: number, L: Layout) {
  const at = L.banner;
  const s3 = signal3(L);
  const m = prog(f, F.morph, 36, ease.enter);
  const push = 1 + 0.025 * prog(f, F.flood, F.toChecklist - F.flood, ease.calm);
  // On the checklist screen the banner stays on top, so scrolling down the screen carries it up and out.
  const scrollUp = prog(f, F.toChecklist, 30, ease.calm) * -L.H * 0.84;
  const k = at.k * push;
  const x = at.x - (BANNER.w * (k - at.k)) / 2;
  const y = at.y - (BANNER.h * (k - at.k)) / 2 + scrollUp;
  // Before the banner exists it is the Signal No. 3 tile stretching.
  return {
    m,
    x: lerp(m, s3.x, x),
    y: lerp(m, s3.y, y),
    w: lerp(m, s3.w, BANNER.w * k),
    h: lerp(m, s3.h, BANNER.h * k),
    k: lerp(m, L.pick.k, k),
  };
}

/** The Signal No. 3 tile lifts and stretches into the switch banner, which then rides to the checklist's top. */
export function BannerActor({ f, L }: { f: number; L: Layout }) {
  if (f < F.morph || f > F.toChecklist + 32) return null;
  const r = bannerRect(f, L);
  const tone = warningTones.tcws[3];
  const face = 1 - prog(f, F.morph, 14, ease.exit);
  const content = prog(f, F.morph + 8, 18, ease.enter);
  return (
    <div
      style={{
        position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden',
        borderRadius: radius.menu * r.k, backgroundColor: mix(prog(f, F.morph + 4, 16, ease.calm), tone.fill, during.surface),
        boxShadow: `inset 0 0 0 ${border.emphasis * r.k}px ${mix(r.m, tone.ink, during.danger.fill)}, ${shadow.float}`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: face }}>
        <Txt role="label" color={tone.ink} style={{ fontSize: 15 * r.k, lineHeight: `${18 * r.k}px` }}>Signal No. 3</Txt>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: BANNER.w, transform: `scale(${r.w / BANNER.w})`, transformOrigin: '0 0', opacity: content }}>
        <SwitchBanner
          c={during}
          sender="Babala · Sipat"
          time="9:12 AM"
          text="Lumipat sa Habang may bagyo."
          reason="Signal No. 3 ang aktibo."
          undoLabel="Ibalik"
          style={{ border: 'none', borderRadius: 0, boxShadow: 'none', backgroundColor: 'transparent' }}
        />
      </div>
    </div>
  );
}

/** The during canvas floods outward from the banner. */
export function OrangeFlood({ f, L }: { f: number; L: Layout }) {
  const p = prog(f, F.flood, 30, ease.enter);
  if (p <= 0 || p >= 1) return null;
  const r = bannerRect(f, L);
  return <Fill color={palette.phase.during.soft} clip={growRect(p, { x: r.x, y: r.y, w: r.w, h: r.h, r: radius.menu * r.k }, L.W, L.H)} />;
}

const GO_BAG = [
  { text: 'Inuming tubig', done: true },
  { text: 'Pagkaing hindi madaling mapanis tulad ng de-lata at biskwit, kasama ang kubyertos', done: true },
  { text: 'Flashlight, extra na baterya, power bank at charger', done: true },
  { text: 'First aid kit: band-aid, alcohol, gasa, medical tape at personal na gamot', tick: 0 },
  { text: 'Diaper, wet wipes, vitamins at gamot ng sanggol', tick: 1, tag: 'Para sa: Baby Joy' },
  { text: 'Personal at maintenance na gamot; i-check ang expiration date at palitan kung kailangan', tick: 2, tag: 'Para sa: Lola Ising' },
  { text: 'Pito (whistle), isa para sa bawat miyembro ng pamilya pati mga bata' },
];
// Real view for the DEMO household with Signal No. 3 (app/core/checklist.ts): 4 of 26 done before these ticks.
const DONE_BEFORE = 4;
const TOTAL = 26;

// Checkbox centres of the three rows that tick, in dp inside the Go bag tile (measured from a render).
export const checkbox = (L: Layout, row: 0 | 1 | 2) => ({ x: L.right.x + 33 * L.right.k, y: L.right.y + [323, 413, 529][row]! * L.right.k });

export const goBagTitle = (L: Layout) => ({ x: L.right.x + (border.control + 20) * L.right.k, y: L.right.y + (border.control + 20) * L.right.k, k: L.right.k });

/** Left: the top of the checklist screen under the banner. Right: the Go bag group, ticking on the beat. */
export function Checklist({ f, L }: { f: number; L: Layout }) {
  const { left: LEFT, right: RIGHT } = L;
  if (f < F.toChecklist || f > F.toAsk + 64) return null;
  // The screen scrolls up under the banner: one move, no stagger (during motion).
  const inn = prog(f, F.toChecklist, 30, ease.calm);
  const panel = inn;
  const ticks = F.ticks.map((t) => prog(f, t, 12, ease.enter));
  const done = DONE_BEFORE + ticks.filter((t) => t >= 0.5).length;
  const bar = (DONE_BEFORE + ticks.reduce((a, b) => a + b, 0)) / TOTAL;
  const leave = prog(f, F.toAsk + 44, 18, ease.exit); // holds while the question is typed, leaves on send
  const goBagOut = prog(f, F.toAsk + 4, 22, ease.exit); // makes room for the question as it lifts out
  const drift = 1 + 0.012 * prog(f, F.toChecklist, F.toAsk - F.toChecklist, ease.calm);
  return (
    <>
      <Zoom k={LEFT.k} x={LEFT.x} y={LEFT.y} w={392} style={{ opacity: inn * (1 - leave), transform: `translate(${-leave * 60}px, ${(1 - inn) * 420}px) scale(${LEFT.k})` }}>
        <div style={{ ...tilt(inn, 'Y', 14, '0% 50%'), display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Txt role="headline" color={during.text}>Mga dapat gawin</Txt>
          <Txt role="bodySmall" color={during.textMuted}>Ito ang mga hakbang na angkop sa inyong sambahayan ngayon.</Txt>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Txt role="label" color={during.textMuted}>Mga babalang nakatala</Txt>
            <Tag c={during} label="Signal No. 3" icon="warning" />
          </div>
          <Tile c={during}>
            <ProgressBar c={during} value={bar} label={`Tapos na ang ${done} sa ${TOTAL}`} />
          </Tile>
        </div>
      </Zoom>
      <Zoom k={RIGHT.k} x={RIGHT.x} y={RIGHT.y} w={392} style={{ opacity: panel * (1 - goBagOut), transform: `translateY(${(1 - panel) * 640 + goBagOut * 120}px) scale(${RIGHT.k * drift})` }}>
        <Tile c={during} style={{ ...tilt(panel, 'Y', -14, '100% 50%'), gap: 14 }}>
          <Txt role="title" color={during.text} style={{ opacity: f >= F.toAsk - 10 ? 0 : 1 }}>Go bag</Txt>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {GO_BAG.map((row) => (
              <ChecklistRow key={row.text} c={during} text={row.text} tick={row.done ? 1 : row.tick !== undefined ? ticks[row.tick]! : 0} tag={row.tag} />
            ))}
          </div>
        </Tile>
      </Zoom>
    </>
  );
}
