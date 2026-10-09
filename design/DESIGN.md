# Work Louder: Design System (reverse engineered)

Source: https://worklouder.cc/ (Framer site, generator `Framer 7788242`), extracted from the page source on 2026-10-09.
Every value below was read from the shipped CSS unless marked *(inferred)*.

Companion files:

- `design-tokens.md`: the token catalog (DTCG JSON + tables), with the original Framer token IDs
- `css-variables.md`: a drop-in `:root` stylesheet
- `Tailwind-v4.md`: a Tailwind v4 `@theme` config and component recipes

---

## 1. Visual identity in one paragraph

A **black canvas** with **rounded, full-viewport photo panels** floating on it (10px inset, 20px radius). Product renders do the heavy lifting; type stays quiet: a single grotesk (**HK Nova**, Regular and Medium) set tight at `-0.03em`, white on imagery, black on light cards. Calls to action live inside **frosted-glass capsules** that pair a product name with a **highlighter-yellow pill** (`#EDFF00`). Personality comes from a **marquee of mismatched display fonts** (pixel, bitmap, mono, ornamental) and emoji, the "all work and no play" voice.

## 2. Principles

1. **Product first, chrome last.** Sections are full-bleed images or videos; UI sits in small glass islands on top.
2. **One accent, used like a highlighter.** `#EDFF00` marks the single action per section, text selection and "new/in-stock" tags. Nothing else is that loud.
3. **Tight, calm type, loud specimens.** Body and headlines are one grotesk with negative tracking. Playfulness is quarantined to marquees.
4. **Everything is a pill or a soft rectangle.** Radii are 999px (pills), 36px (glass capsules), 20px (panels/cards), 14-16px (media, menu items), 10px (form card).
5. **Dark by default.** The page root is `#000`; light surfaces (`#D7D7D7` cards, sky gradient panel) are islands inside it.

## 3. Color

### Core

| Role | Value | Notes |
|---|---|---|
| Canvas | `#000000` | Root page background |
| Ink (on light) | `#000000` | Primary text on cards and yellow buttons |
| Ink (on dark) | `#FFFFFF` | Headlines over imagery |
| Accent / Highlighter | `#EDFF00` | Primary button, tags, `::selection` bg (selection text `#000`) |

### Neutrals (all used in tokens)

`#F7F7F7` `#F5F5F5` `#E2E2E2` `#D7D7D7` `#D4D4D4` `#B2B2B2` `#ADADAD` `#A8A8A8` `#808080` `#777777` `#707070` `#444444` `#333333` `#2D2D2D` `#161616` `#121212`

- `#D7D7D7`: product card surface
- `#E2E2E2`: most-reused light neutral (7 tokens point at it), dividers and light fills
- `#121212`: dark card (newsletter shell), with `#2D2D2D` 1px border
- `#444444`: dark tag pill
- `#A8A8A8`: muted text on dark (form labels, helper copy)

### Secondary accents (sparingly used, per product)

| Name | Value | Seen as |
|---|---|---|
| Electric blue | `#065BFF` | Glow gradient behind product (`#065BFF -40% → transparent`) |
| Ultramarine | `#000DFF` | Token, product theming |
| Navy | `#00056E` | Token, product theming |
| Sky | `#87C7FF` | Top of the sky panel gradient (`#87C7FF → #F5F5F5`) |
| Orange | `#FF4D00` / `#FF5E2B` | Alerts, product accent; `#FF5E2B1A` as 10% tint |
| Signal green | `#0BDB00` | Status ("in stock", "complete") |
| Slate link | `#6079A3` | Underlined secondary link ("…sold out") |
| Framer blue | `#0099FF` | Framer's default link color (platform default, not brand) |

### Alpha / overlay values

| Use | Value |
|---|---|
| Glass capsule (light) | `#FFFFFF47` (white @ 28%) + `blur(8px)` |
| Glass capsule (blue tint) | `#9EB8D947` + `blur(8px)` |
| Muted text on light | `rgba(0,0,0,.3)` (prices, "explore"), `rgba(0,0,0,.2)` (credits) |
| Muted text on dark | `rgba(255,255,255,.7)` (footer links) |
| Hairline on dark | `rgba(255,255,255,.14)` |
| Glass fill on dark | `rgba(255,255,255,.04)` / `.05` |
| Menu overlay | `#000000CC` (black @ 80%) |
| Marquee edge fade | `rgb(240,240,240)` stepping 1 → .95 → .8 → .5 → .2 → .05 → .02 → 0 |
| Subtle shadow tint | `#0000000F` |
| Underline rule | `#FFFFFFB3` (72×1px) |

## 4. Typography

### Families

| Role | Family | Weights | Source |
|---|---|---|---|
| **Primary (all UI + headlines)** | HK Nova | Light 300, Regular 400, Medium 500, Bold 700 | Custom upload (Hanken Design Co., commercial) |
| Bitmap display | PP NeueBit | Regular | Pangram Pangram (commercial) |
| Mono display | Necto Mono | Regular | Framer built-in |
| Pixel display | Pixelify Sans | 400 | Google Fonts (free) |
| Heavy display | Utara Variable | up to 1000 | Framer built-in |
| Ornament | Fleuron | Regular | Framer built-in |
| Form widget | Inter / system | 400, 600 | Embedded newsletter form only |
| Also loaded | Satoshi, Inter Display | | Present but not prominent |

HK Nova always runs with OpenType **`'ss07' on`** on headlines (stylistic set 7).

**Free substitutes** *(inferred, closest look)*: HK Nova → *Hanken Grotesk* (same foundry, free on Google Fonts); PP NeueBit → *Silkscreen* or *Pixelify Sans*; Necto Mono → *Space Mono*.

### Scale (desktop)

| Style | Family | Size | Weight | Tracking | Leading | Example |
|---|---|---|---|---|---|---|
| Marquee XL | Necto Mono / NeueBit / Fleuron | 75px | 400 / 1000 | 0 to -1em | 0.8 | "Know Productivity ⚡" |
| Marquee | NeueBit / Necto Mono | 65px / 44px | 400 | -0.01em to -0.3em | 0.8 | "Human after all 👋" |
| Display | HK Nova Medium | 56px | 500 | -0.03em | 1.1 | Section hero (h1/h2) |
| H1 alt | HK Nova Medium | 46px | 500 | -0.03em | 1.1 | Product section title |
| H2 | HK Nova Medium | 38px | 500 | -0.03em | default | "get Input", "wrk.shop" |
| H3 | HK Nova Medium | 32-34px | 500 | -0.03em | 1.1 | |
| Rail title | HK Nova Medium | 28px | 500 | **-0.07em** | 1.1 | "Explore our best seller" |
| Card title | HK Nova Medium | 22px | 500 | -0.03em | default | Product name in card |
| Lead | HK Nova Medium | 19px | 500 | -0.03em | default | Product label in CTA capsule, specs |
| Body L | HK Nova Regular | 18px | 400 | -0.03em | default | Price, "explore" |
| Body | HK Nova Regular | 15px | 400 | -0.03em | default | Card descriptions |
| Body S / Nav | HK Nova Regular | 14px | 400 | -0.03em | default | Nav, footer links, menu items |
| Button | HK Nova Regular | 14px *(inherited)* | 400 | **-0.05em** | 1.0 | "more", "download", "in-stock" |
| Caption / Tag | HK Nova Regular | 12px | 400 | 0 | 1.4 | "keyboard", "keycaps" |

Mobile nav items scale up to **22px**.

**Rules**: negative tracking everywhere (`-0.03em` default, `-0.05em` on buttons, `-0.07em` on the rail title). Text is mostly left-aligned; specs blocks on the right side of a panel align right. Headline wraps use `text-wrap: balance`.

## 5. Layout

| Item | Value |
|---|---|
| Breakpoints | Mobile `< 810px`, Tablet `810-1199px`, Desktop `1200-1599px`, Wide `>= 1600px` |
| Max widths | 1600px (page), 1400px, 1200px (content/newsletter), 600px, 500px (mobile frame) |
| Section panel | `height: 100vh`, `padding: 10px`, inner panel radius 20px |
| Panel gutter | 10px all round (panels read as tiles on black) |
| Section padding | 45px common (`45px 45px 45px 35px`, `30px 30px 0`) |
| Floating nav | `position: fixed; top: 24px; width: 1128px; left: 50%; translateX(-50%); z-index: 9` |
| Gap scale | 2, 4, 5, 6, 8, **10** (most used), 14, 16, 20, 24, 30, 40 |

Two-up product panels split as `max((100vw - 30px) / 2, 1px)`: two columns separated by 10px plus outer 10px gutters.

## 6. Components

### 6.1 Floating navigation
- Fixed, centered, 24px from top, 1128px wide on desktop.
- Items are text pills: `padding: 0 14px`, radius 80px, transparent until hover.
- Dropdown items: radius 16px, transparent bg, HK Nova Regular 14px.
- Menu opens over a full-screen `#000000CC` scrim.
- Mobile: collapses to a menu; items set at 22px.

### 6.2 Section panel (hero / product spotlight)
- Full-viewport tile, 20px radius, image/video `object-fit: cover`.
- Variants: photo/render background; sky gradient `linear-gradient(#87C7FF, #F5F5F5)`; flat `#D7D7D7`.
- Optional glow: `linear-gradient(180deg, #065BFF -40%, transparent 100%)`, 260px tall.
- Optional subtle diagonal-stripe SVG pattern in `rgba(136,136,136,.2)`.
- Headline top-left (56px white Medium), secondary copy and specs on the opposite side.

### 6.3 CTA capsule (glass)
The signature component.
```
[ Product name (19px Medium, white) ][ more ● yellow pill ]
```
- Container: `backdrop-filter: blur(8px)`, `background: #FFFFFF47` (or `#9EB8D947` on blue scenes), radius 36px, padding 10px, gap 14px, `width: min-content`.
- Button inside: `background: #EDFF00`, radius 80px, text black HK Nova Regular, tracking `-0.05em`, leading 1.0. Labels are lowercase: `more`, `download`, `explore`, `in-stock`.

### 6.4 Buttons

| Variant | Spec |
|---|---|
| Primary (highlighter) | bg `#EDFF00`, text `#000`, radius 80px, lowercase label, no border |
| Inverse (on dark) | bg `#FFF`, text `#000`, radius 999px, `padding: 12px 16px`, 14px/600, shadow `0 0 0 1px rgba(255,255,255,.16) inset, 0 8px 28px rgba(255,255,255,.14)` |
| Text link | underline; `#6079A3` slate on light, white on dark (hover stays white, current `#B2B2B2`) |

### 6.5 Product card (best-seller rail)
- Surface `#D7D7D7`, radius 20px, vertical flex, gap ~29px, product render clipped in a 14px-radius frame.
- Tag pill top-left: radius 189px (pill), `padding: 4px 11px`, 12px/1.4 text. Two styles: yellow `#EDFF00` + black text, or `#444` + white text. Labels: `keyboard`, `keycaps`, `accessory`.
- Title 22px Medium black, then price or `explore` in 18px Regular `rgba(0,0,0,.3)`.
- Rail header: "Explore our best seller", 28px Medium white, tracking -0.07em.

### 6.6 Marquee ticker
- Infinite horizontal list, white text, leading 0.8.
- Each word in a different display face (Pixelify Sans, PP NeueBit, Utara 1000, Necto Mono, Fleuron) at 44px (mobile) / 75px (desktop), with emoji between.
- Edges fade into `rgb(240,240,240)` with a stepped gradient.
- Footer variant: NeueBit 44px, "Work Louder Inc.© 2026 - 🌎 - all work & no play -".

### 6.7 Newsletter block
- Shell: `#121212`, 1px `#2D2D2D` border, radius 20px, padding 20px, gap 24px, max 1200px.
- Form card: `rgba(255,255,255,.04)`, 1px `rgba(255,255,255,.14)`, radius 10px, padding 24px, gap 14px, `blur(8px)`, shadow `0 1px 1px rgba(255,255,255,.03) inset, 0 12px 40px rgba(0,0,0,.35)`.
- Title 22px/1.2, -0.01em; helper 14px/1.4 `#A8A8A8`; labels 13px `#A8A8A8`; fields wrap at `flex: 1 1 220px`, gap 10px; legal 10px.
- Submit is the Inverse button, full width.

### 6.8 Footer
- On black. Links 14px HK Nova Regular, `rgba(255,255,255,.7)`, tracking -0.03em.
- Social icons (Discord, X, Instagram, TikTok), language select, © line.
- Decorative 72×1px rules in `#FFFFFFB3`.

## 7. Motion

| Pattern | Spec |
|---|---|
| Word-by-word reveal | Each word is an inline-block starting at `opacity: 0.001; filter: blur(10px); transform: translateY(40px)`, animating to `opacity 1; blur 0; translateY 0`, staggered per word (on scroll into view) |
| Fades | `opacity 0.3s ease` (marquee edges), `0.2s ease` (button press / busy) |
| Marquee | Continuous linear translateX loop |
| Hover (nav pills) | Background fades in from transparent |

Respect `prefers-reduced-motion`: drop blur and translate, keep a short opacity fade *(recommendation)*.

## 8. Voice and content

Lowercase product-y labels (`more`, `explore`, `get Input`, `wrk.shop`, `wrk. MX Delta`), short punchy headlines with periods ("Ready. Set. Publish."), friendly asides with emoji ("pinky promise 🤙", "Human after all 👋"). Product names use the `wrk.` prefix.

## 9. Do / Don't

**Do**
- Put UI in small glass capsules over full-bleed imagery.
- Use yellow for exactly one action per view.
- Keep HK Nova (or Hanken Grotesk) tight: -0.03em.
- Use 10px gutters so panels read as tiles on black.

**Don't**
- Use yellow as a background for large areas or for body text.
- Add drop shadows to panels; depth comes from blur and image, not shadow.
- Mix the display fonts into UI. They live only in marquees.
- Use square corners anywhere.

## 10. Accessibility notes *(recommendations)*
- `#EDFF00` on `#000` text: contrast ~19:1, fine. Never put white text on yellow (~1.1:1).
- `rgba(0,0,0,.3)` on `#D7D7D7` (prices) is roughly 2.1:1: too low for essential info. Use `rgba(0,0,0,.6)` (about 5:1) if you rebuild.
- Glass capsules over busy imagery can lose contrast; consider a darker tint fallback when `backdrop-filter` is unsupported.
