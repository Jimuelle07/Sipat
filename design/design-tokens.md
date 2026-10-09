# Work Louder: Design Tokens

Token catalog for https://worklouder.cc/, extracted from the page source on 2026-10-09.

- **Tier 1 (primitive)**: raw values, named by what they are.
- **Tier 2 (semantic)**: named by what they do; reference primitives.
- **Tier 3 (component)**: per-component decisions; reference semantic tokens.

The `framer` column lists the original Framer token ID (first 8 chars of `--token-xxxxxxxx-…`) so every value is traceable. A dash means the value is hard-coded in the site's CSS rather than a Framer token. `(inferred)` marks values not present in the source.

---

## 1. Color primitives

| Token | Value | Framer ID(s) | Usage count / where |
|---|---|---|---|
| `color.black` | `#000000` | f885c881, 2d91bfb1, d77b16bb | Most-used token (text on light, page bg) |
| `color.white` | `#FFFFFF` | 30144fd1, 44bc4afc, 9811e40b, c16de519, d7522774 | Headlines on imagery |
| `color.yellow.500` | `#EDFF00` | 55f471a1 | Buttons, tags, selection |
| `color.yellow.400` | `#EEFF00` | ab8c0b50, f16f02c5 | Near-duplicate of accent |
| `color.gray.50` | `#F7F7F7` | 0456e135 | |
| `color.gray.100` | `#F5F5F5` | f0a831ba | Sky gradient end |
| `color.gray.200` | `#E2E2E2` | 36d6639a, 51101f1f, 6ad539be, aab30c64, b3271f77, cc65503f, cd64be87, ef565fcf | Light fills (8 aliases) |
| `color.gray.250` | `#D7D7D7` | - | Product card surface |
| `color.gray.300` | `#D4D4D4` | 4f22e721 | |
| `color.gray.400` | `#B2B2B2` | 5d57f9ff | Current-page link |
| `color.gray.450` | `#ADADAD` | 1c038b66, 61c78570 | |
| `color.gray.500` | `#A8A8A8` | - | Muted text on dark |
| `color.gray.550` | `#808080` | efe2e479 | |
| `color.gray.600` | `#777777` | e6089487 | |
| `color.gray.650` | `#707070` | 61969a04 | |
| `color.gray.700` | `#444444` | - | Dark tag pill |
| `color.gray.800` | `#333333` | 49408c1d, 52c87b77 | |
| `color.gray.850` | `#2D2D2D` | f52cc4ea | Border on dark |
| `color.gray.900` | `#161616` | a099af4a | |
| `color.gray.950` | `#121212` | - | Dark card |
| `color.blue.500` | `#065BFF` | 21cb775f, 3bce1cda, e3b0e4d3, ef78faf6 | Glow gradient |
| `color.blue.600` | `#000DFF` | 290cfde7 | |
| `color.blue.900` | `#00056E` | 0b514973 | |
| `color.sky.300` | `#87C7FF` | - | Sky gradient start |
| `color.orange.600` | `#FF4D00` | 1a465ae6 | |
| `color.orange.500` | `#FF5E2B` | 57fdb807 | |
| `color.orange.tint` | `#FF5E2B1A` | 7ac71914 | 10% tint |
| `color.green.500` | `#0BDB00` | 80c76d4c | Status |
| `color.slate.500` | `#6079A3` | - | Secondary link |
| `color.gray.alpha20` | `#BBBBBB33` | 01c07c7e | |
| `color.black.alpha6` | `#0000000F` | a44bc734 | |

## 2. Color semantic

| Token | → | Value |
|---|---|---|
| `bg.canvas` | color.black | `#000` |
| `bg.surface.light` | color.gray.250 | `#D7D7D7` |
| `bg.surface.dark` | color.gray.950 | `#121212` |
| `bg.glass` | - | `#FFFFFF47` |
| `bg.glass.blue` | - | `#9EB8D947` |
| `bg.glass.dark` | - | `rgba(255,255,255,.04)` |
| `bg.scrim` | - | `#000000CC` |
| `text.onDark` | color.white | `#FFF` |
| `text.onDark.muted` | color.gray.500 | `#A8A8A8` |
| `text.onDark.subtle` | - | `rgba(255,255,255,.7)` |
| `text.onLight` | color.black | `#000` |
| `text.onLight.muted` | - | `rgba(0,0,0,.3)` |
| `text.onLight.faint` | - | `rgba(0,0,0,.2)` |
| `text.link.secondary` | color.slate.500 | `#6079A3` |
| `text.link.current` | color.gray.400 | `#B2B2B2` |
| `border.dark` | color.gray.850 | `#2D2D2D` |
| `border.hairline.dark` | - | `rgba(255,255,255,.14)` |
| `action.primary.bg` | color.yellow.500 | `#EDFF00` |
| `action.primary.fg` | color.black | `#000` |
| `action.inverse.bg` | color.white | `#FFF` |
| `action.inverse.fg` | color.black | `#000` |
| `selection.bg` / `.fg` | yellow.500 / black | |
| `status.success` | color.green.500 | `#0BDB00` |
| `status.warning` | color.orange.600 | `#FF4D00` |

## 3. Gradients

| Token | Value |
|---|---|
| `gradient.sky` | `linear-gradient(#87C7FF 0%, #F5F5F5 100%)` |
| `gradient.blueGlow` | `linear-gradient(180deg, #065BFF -40%, #0000 100%)` (260px tall) |
| `gradient.edgeFade` | `rgb(240,240,240)` at 1 / .95 / .8 / .5 / .2 / .05 / .02 / 0 over 0 / 10 / 25 / 50 / 75 / 90 / 99 / 100% |

## 4. Typography

### Families
| Token | Value |
|---|---|
| `font.family.sans` | HK Nova Regular (400) → fallback Hanken Grotesk |
| `font.family.sansMedium` | HK Nova Medium (500) |
| `font.family.sansLight` | HK Nova Light (300), loaded, rarely used |
| `font.family.sansBold` | HK Nova Bold (700), loaded, rarely used |
| `font.family.bitmap` | PP NeueBit Regular |
| `font.family.pixel` | Pixelify Sans |
| `font.family.mono` | Necto Mono |
| `font.family.heavy` | Utara Variable (weight up to 1000) |
| `font.family.ornament` | Fleuron |
| `font.family.ui` | Inter, system stack (newsletter form) |
| `font.features.display` | `"ss07" on` |

### Size
| Token | px | Role |
|---|---|---|
| `font.size.2xs` | 10 | Legal |
| `font.size.xs` | 12 | Tag, caption |
| `font.size.sm` | 13 | Form label |
| `font.size.base` | 14 | Nav, body S, links, buttons (most used: 50+) |
| `font.size.md` | 15 | Body |
| `font.size.lg` | 18 | Price / meta |
| `font.size.lead` | 19 | Capsule label, specs |
| `font.size.xl` | 22 | Card title, form title, mobile nav |
| `font.size.2xl` | 24 | |
| `font.size.rail` | 28 | Rail header |
| `font.size.3xl` | 32 | |
| `font.size.4xl` | 34 | |
| `font.size.h2` | 38 | |
| `font.size.marquee.sm` | 44 | |
| `font.size.h1` | 46 | |
| `font.size.display` | 56 | |
| `font.size.marquee.md` | 65 | |
| `font.size.marquee.lg` | 75 | |

### Tracking / leading / weight
| Token | Value |
|---|---|
| `font.tracking.default` | `-0.03em` (81 uses) |
| `font.tracking.tight` | `-0.05em` (buttons) |
| `font.tracking.tighter` | `-0.07em` (rail title) |
| `font.tracking.snug` | `-0.01em` |
| `font.leading.marquee` | `0.8` |
| `font.leading.none` | `1` |
| `font.leading.tight` | `1.1` |
| `font.leading.snug` | `1.2` |
| `font.leading.normal` | `1.4` |
| `font.weight.light/regular/medium/semibold/bold/black` | `300 / 400 / 500 / 600 / 700 / 1000` |

### Composite text styles
| Token | Family | Size | Weight | Tracking | Leading |
|---|---|---|---|---|---|
| `type.display` | sansMedium + ss07 | 56 | 500 | -0.03em | 1.1 |
| `type.h1` | sansMedium + ss07 | 46 | 500 | -0.03em | 1.1 |
| `type.h2` | sansMedium | 38 | 500 | -0.03em | normal |
| `type.rail` | sansMedium | 28 | 500 | -0.07em | 1.1 |
| `type.cardTitle` | sansMedium | 22 | 500 | -0.03em | normal |
| `type.lead` | sansMedium | 19 | 500 | -0.03em | normal |
| `type.meta` | sans | 18 | 400 | -0.03em | normal |
| `type.body` | sans | 15 | 400 | -0.03em | normal |
| `type.nav` | sans | 14 | 400 | -0.03em | normal |
| `type.button` | sans | 14 | 400 | -0.05em | 1 |
| `type.tag` | sans | 12 | 400 | 0 | 1.4 |
| `type.marquee` | bitmap / mono / pixel / heavy | 44 → 75 | 400-1000 | 0 to -1em | 0.8 |

## 5. Spacing

| Token | px | Notes |
|---|---|---|
| `space.0` | 0 | |
| `space.0_5` | 2 | |
| `space.1` | 4 | Tag padding-y |
| `space.1_5` | 6 | Label gap |
| `space.2` | 8 | |
| `space.2_5` | 10 | **Base gutter**, most-used gap (37 uses) |
| `space.3_5` | 14 | Capsule gap, nav item padding-x, form gap |
| `space.4` | 16 | |
| `space.5` | 20 | Card / newsletter padding |
| `space.6` | 24 | Form padding, nav top offset |
| `space.7_5` | 30 | |
| `space.9` | 35 | |
| `space.10` | 40 | |
| `space.11` | 45 | Section padding |

## 6. Radius

| Token | px | Used on |
|---|---|---|
| `radius.form` | 10 | Form card |
| `radius.media` | 14 | Image frames in cards |
| `radius.menu` | 16 | Dropdown items |
| `radius.panel` | 20 | Section tiles, cards, dark card |
| `radius.capsule` | 36 | Glass CTA capsule |
| `radius.pill` | 80 | Buttons, nav items |
| `radius.full` | 999 (site also uses 189) | Tags, inverse button |

## 7. Effects

| Token | Value |
|---|---|
| `blur.glass` | 8px |
| `blur.md` | 10px |
| `blur.lg` | 12px |
| `shadow.form` | `0 1px 1px rgba(255,255,255,.03) inset, 0 12px 40px rgba(0,0,0,.35)` |
| `shadow.glow` | `0 0 0 1px rgba(255,255,255,.16) inset, 0 8px 28px rgba(255,255,255,.14)` |

## 8. Layout & breakpoints

| Token | Value |
|---|---|
| `breakpoint.tablet` | 810px |
| `breakpoint.desktop` | 1200px |
| `breakpoint.wide` | 1600px |
| `size.container.page` | 1600px |
| `size.container.wide` | 1400px |
| `size.container.content` | 1200px |
| `size.container.nav` | 1128px |
| `size.container.narrow` | 600px |
| `size.container.mobile` | 500px |
| `size.card.product` | 311px wide |
| `size.panel.height` | 100vh |
| `z.nav` / `z.menu` / `z.fade` | 9 / 10 / 9999 |

## 9. Motion

| Token | Value |
|---|---|
| `motion.duration.fast` | 0.2s |
| `motion.duration.base` | 0.3s |
| `motion.easing.default` | ease |
| `motion.reveal.from` | `opacity .001, blur(10px), translateY(40px)` |
| `motion.reveal.to` | `opacity 1, blur(0), translateY(0)` |
| `motion.reveal.duration` | 0.6s (inferred) |
| `motion.marquee.duration` | 40s linear (inferred) |

## 10. Component tokens

| Token | Value |
|---|---|
| `nav.top` | space.6 (24px) |
| `nav.width` | container.nav |
| `nav.item.padding` | `0 space.3_5` |
| `nav.item.radius` | radius.pill |
| `nav.subitem.radius` | radius.menu |
| `panel.padding` | space.2_5 |
| `panel.radius` | radius.panel |
| `capsule.bg` | bg.glass |
| `capsule.blur` | blur.glass |
| `capsule.radius` | radius.capsule |
| `capsule.padding` / `.gap` | space.2_5 / space.3_5 |
| `capsule.label` | type.lead, text.onDark |
| `button.primary.bg` / `.fg` | action.primary.bg / .fg |
| `button.primary.radius` | radius.pill |
| `button.primary.type` | type.button, lowercase |
| `button.inverse.radius` | radius.full |
| `button.inverse.padding` | 12px 16px |
| `button.inverse.shadow` | shadow.glow |
| `card.product.bg` | bg.surface.light |
| `card.product.radius` | radius.panel |
| `card.product.gap` | 29px |
| `card.product.media.radius` | radius.media |
| `tag.padding` | 4px 11px |
| `tag.radius` | radius.full |
| `tag.bg` / `.fg` | yellow / black, or gray.700 / white |
| `newsletter.bg` | bg.surface.dark |
| `newsletter.border` | 1px border.dark |
| `newsletter.radius` / `.padding` | radius.panel / space.5 |
| `form.bg` / `.border` | bg.glass.dark / 1px border.hairline.dark |
| `form.radius` / `.padding` / `.gap` | radius.form / space.6 / space.3_5 |
| `footer.link` | type.nav, text.onDark.subtle |

---

## 11. DTCG JSON (W3C Design Tokens format)

Works with Style Dictionary v4, Tokens Studio and Figma variable importers.

```json
{
  "color": {
    "$type": "color",
    "black":  { "$value": "#000000" },
    "white":  { "$value": "#ffffff" },
    "yellow": { "500": { "$value": "#edff00" }, "400": { "$value": "#eeff00" } },
    "gray": {
      "50":  { "$value": "#f7f7f7" }, "100": { "$value": "#f5f5f5" },
      "200": { "$value": "#e2e2e2" }, "250": { "$value": "#d7d7d7" },
      "300": { "$value": "#d4d4d4" }, "400": { "$value": "#b2b2b2" },
      "450": { "$value": "#adadad" }, "500": { "$value": "#a8a8a8" },
      "550": { "$value": "#808080" }, "600": { "$value": "#777777" },
      "650": { "$value": "#707070" }, "700": { "$value": "#444444" },
      "800": { "$value": "#333333" }, "850": { "$value": "#2d2d2d" },
      "900": { "$value": "#161616" }, "950": { "$value": "#121212" }
    },
    "blue":   { "500": { "$value": "#065bff" }, "600": { "$value": "#000dff" }, "900": { "$value": "#00056e" } },
    "sky":    { "300": { "$value": "#87c7ff" } },
    "orange": { "500": { "$value": "#ff5e2b" }, "600": { "$value": "#ff4d00" }, "tint": { "$value": "#ff5e2b1a" } },
    "green":  { "500": { "$value": "#0bdb00" } },
    "slate":  { "500": { "$value": "#6079a3" } }
  },
  "semantic": {
    "$type": "color",
    "bg": {
      "canvas":       { "$value": "{color.black}" },
      "surfaceLight": { "$value": "{color.gray.250}" },
      "surfaceDark":  { "$value": "{color.gray.950}" },
      "glass":        { "$value": "#ffffff47" },
      "glassBlue":    { "$value": "#9eb8d947" },
      "glassDark":    { "$value": "#ffffff0a" },
      "scrim":        { "$value": "#000000cc" }
    },
    "text": {
      "onDark":        { "$value": "{color.white}" },
      "onDarkMuted":   { "$value": "{color.gray.500}" },
      "onDarkSubtle":  { "$value": "#ffffffb3" },
      "onLight":       { "$value": "{color.black}" },
      "onLightMuted":  { "$value": "#0000004d" },
      "onLightFaint":  { "$value": "#00000033" },
      "linkSecondary": { "$value": "{color.slate.500}" }
    },
    "border": {
      "dark":         { "$value": "{color.gray.850}" },
      "hairlineDark": { "$value": "#ffffff24" }
    },
    "action": {
      "primaryBg": { "$value": "{color.yellow.500}" },
      "primaryFg": { "$value": "{color.black}" },
      "inverseBg": { "$value": "{color.white}" },
      "inverseFg": { "$value": "{color.black}" }
    },
    "status": {
      "success": { "$value": "{color.green.500}" },
      "warning": { "$value": "{color.orange.600}" }
    }
  },
  "font": {
    "family": {
      "$type": "fontFamily",
      "sans":       { "$value": ["HK Nova Regular", "Hanken Grotesk", "system-ui", "sans-serif"] },
      "sansMedium": { "$value": ["HK Nova Medium", "Hanken Grotesk", "system-ui", "sans-serif"] },
      "bitmap":     { "$value": ["PP NeueBit Regular", "Silkscreen", "monospace"] },
      "pixel":      { "$value": ["Pixelify Sans", "monospace"] },
      "mono":       { "$value": ["Necto Mono", "Space Mono", "monospace"] },
      "heavy":      { "$value": ["Utara Variable", "sans-serif"] },
      "ui":         { "$value": ["Inter", "system-ui", "sans-serif"] }
    },
    "size": {
      "$type": "dimension",
      "2xs": { "$value": "10px" }, "xs": { "$value": "12px" }, "sm": { "$value": "13px" },
      "base": { "$value": "14px" }, "md": { "$value": "15px" }, "lg": { "$value": "18px" },
      "lead": { "$value": "19px" }, "xl": { "$value": "22px" }, "2xl": { "$value": "24px" },
      "rail": { "$value": "28px" }, "3xl": { "$value": "32px" }, "4xl": { "$value": "34px" },
      "h2": { "$value": "38px" }, "h1": { "$value": "46px" }, "display": { "$value": "56px" },
      "marqueeSm": { "$value": "44px" }, "marqueeMd": { "$value": "65px" }, "marqueeLg": { "$value": "75px" }
    },
    "weight": {
      "$type": "fontWeight",
      "light": { "$value": 300 }, "regular": { "$value": 400 }, "medium": { "$value": 500 },
      "semibold": { "$value": 600 }, "bold": { "$value": 700 }, "black": { "$value": 1000 }
    },
    "tracking": {
      "$type": "dimension",
      "default": { "$value": "-0.03em" }, "tight": { "$value": "-0.05em" },
      "tighter": { "$value": "-0.07em" }, "snug": { "$value": "-0.01em" }
    },
    "leading": {
      "$type": "number",
      "marquee": { "$value": 0.8 }, "none": { "$value": 1 }, "tight": { "$value": 1.1 },
      "snug": { "$value": 1.2 }, "normal": { "$value": 1.4 }
    }
  },
  "typography": {
    "$type": "typography",
    "display": { "$value": { "fontFamily": "{font.family.sansMedium}", "fontSize": "{font.size.display}", "fontWeight": "{font.weight.medium}", "letterSpacing": "{font.tracking.default}", "lineHeight": "{font.leading.tight}" } },
    "h1":      { "$value": { "fontFamily": "{font.family.sansMedium}", "fontSize": "{font.size.h1}", "fontWeight": "{font.weight.medium}", "letterSpacing": "{font.tracking.default}", "lineHeight": "{font.leading.tight}" } },
    "rail":    { "$value": { "fontFamily": "{font.family.sansMedium}", "fontSize": "{font.size.rail}", "fontWeight": "{font.weight.medium}", "letterSpacing": "{font.tracking.tighter}", "lineHeight": "{font.leading.tight}" } },
    "cardTitle": { "$value": { "fontFamily": "{font.family.sansMedium}", "fontSize": "{font.size.xl}", "fontWeight": "{font.weight.medium}", "letterSpacing": "{font.tracking.default}", "lineHeight": 1.2 } },
    "lead":    { "$value": { "fontFamily": "{font.family.sansMedium}", "fontSize": "{font.size.lead}", "fontWeight": "{font.weight.medium}", "letterSpacing": "{font.tracking.default}", "lineHeight": 1.2 } },
    "body":    { "$value": { "fontFamily": "{font.family.sans}", "fontSize": "{font.size.md}", "fontWeight": "{font.weight.regular}", "letterSpacing": "{font.tracking.default}", "lineHeight": 1.2 } },
    "nav":     { "$value": { "fontFamily": "{font.family.sans}", "fontSize": "{font.size.base}", "fontWeight": "{font.weight.regular}", "letterSpacing": "{font.tracking.default}", "lineHeight": 1.2 } },
    "button":  { "$value": { "fontFamily": "{font.family.sans}", "fontSize": "{font.size.base}", "fontWeight": "{font.weight.regular}", "letterSpacing": "{font.tracking.tight}", "lineHeight": "{font.leading.none}" } },
    "tag":     { "$value": { "fontFamily": "{font.family.sans}", "fontSize": "{font.size.xs}", "fontWeight": "{font.weight.regular}", "letterSpacing": "0em", "lineHeight": "{font.leading.normal}" } }
  },
  "space": {
    "$type": "dimension",
    "0": { "$value": "0px" }, "0_5": { "$value": "2px" }, "1": { "$value": "4px" },
    "1_5": { "$value": "6px" }, "2": { "$value": "8px" }, "2_5": { "$value": "10px" },
    "3_5": { "$value": "14px" }, "4": { "$value": "16px" }, "5": { "$value": "20px" },
    "6": { "$value": "24px" }, "7_5": { "$value": "30px" }, "9": { "$value": "35px" },
    "10": { "$value": "40px" }, "11": { "$value": "45px" }
  },
  "radius": {
    "$type": "dimension",
    "form": { "$value": "10px" }, "media": { "$value": "14px" }, "menu": { "$value": "16px" },
    "panel": { "$value": "20px" }, "capsule": { "$value": "36px" }, "pill": { "$value": "80px" },
    "full": { "$value": "999px" }
  },
  "blur": {
    "$type": "dimension",
    "glass": { "$value": "8px" }, "md": { "$value": "10px" }, "lg": { "$value": "12px" }
  },
  "shadow": {
    "$type": "shadow",
    "form": { "$value": [
      { "color": "#ffffff08", "offsetX": "0px", "offsetY": "1px", "blur": "1px", "spread": "0px", "inset": true },
      { "color": "#00000059", "offsetX": "0px", "offsetY": "12px", "blur": "40px", "spread": "0px" }
    ] },
    "glow": { "$value": [
      { "color": "#ffffff29", "offsetX": "0px", "offsetY": "0px", "blur": "0px", "spread": "1px", "inset": true },
      { "color": "#ffffff24", "offsetX": "0px", "offsetY": "8px", "blur": "28px", "spread": "0px" }
    ] }
  },
  "breakpoint": {
    "$type": "dimension",
    "tablet": { "$value": "810px" }, "desktop": { "$value": "1200px" }, "wide": { "$value": "1600px" }
  },
  "container": {
    "$type": "dimension",
    "page": { "$value": "1600px" }, "wide": { "$value": "1400px" }, "content": { "$value": "1200px" },
    "nav": { "$value": "1128px" }, "narrow": { "$value": "600px" }
  },
  "motion": {
    "duration": {
      "$type": "duration",
      "fast": { "$value": "200ms" }, "base": { "$value": "300ms" }, "reveal": { "$value": "600ms", "$description": "inferred" }
    },
    "easing": { "$type": "cubicBezier", "default": { "$value": [0.25, 0.1, 0.25, 1] } }
  }
}
```
