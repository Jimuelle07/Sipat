# Work Louder: CSS Variables

Drop-in custom properties extracted from https://worklouder.cc/ (2026-10-09). Framer ships tokens as opaque IDs (`--token-55f471a1-…`); here they are renamed semantically. The original ID is noted in comments so you can trace any value back to the source.

> Font note: HK Nova and PP NeueBit are commercial. The stack below falls back to **Hanken Grotesk** (free, same foundry) and **Silkscreen**. Load your licensed files with the `@font-face` block at the bottom, or the Google Fonts link for the free fallbacks.

```css
:root {
  /* ───────── Color: core ───────── */
  --wl-black:            #000000; /* token-f885c881, token-2d91bfb1, token-d77b16bb */
  --wl-white:            #ffffff; /* token-30144fd1, token-44bc4afc, token-9811e40b, token-c16de519, token-d7522774 */
  --wl-yellow:           #edff00; /* token-55f471a1  (accent / highlighter) */
  --wl-yellow-alt:       #eeff00; /* token-ab8c0b50, token-f16f02c5 (#ef0) */

  /* ───────── Color: neutrals ───────── */
  --wl-gray-50:          #f7f7f7; /* token-0456e135 */
  --wl-gray-100:         #f5f5f5; /* token-f0a831ba */
  --wl-gray-200:         #e2e2e2; /* token-36d6639a (+6 aliases) */
  --wl-gray-250:         #d7d7d7; /* product card surface */
  --wl-gray-300:         #d4d4d4; /* token-4f22e721 */
  --wl-gray-400:         #b2b2b2; /* token-5d57f9ff */
  --wl-gray-450:         #adadad; /* token-1c038b66, token-61c78570 */
  --wl-gray-500:         #a8a8a8; /* muted text on dark */
  --wl-gray-550:         #808080; /* token-efe2e479 (gray) */
  --wl-gray-600:         #777777; /* token-e6089487 */
  --wl-gray-650:         #707070; /* token-61969a04 */
  --wl-gray-700:         #444444; /* dark tag pill */
  --wl-gray-800:         #333333; /* token-49408c1d, token-52c87b77 */
  --wl-gray-850:         #2d2d2d; /* token-f52cc4ea (dark border) */
  --wl-gray-900:         #161616; /* token-a099af4a */
  --wl-gray-950:         #121212; /* dark card */

  /* ───────── Color: secondary accents ───────── */
  --wl-blue:             #065bff; /* token-21cb775f, token-3bce1cda, token-e3b0e4d3, token-ef78faf6 */
  --wl-ultramarine:      #000dff; /* token-290cfde7 */
  --wl-navy:             #00056e; /* token-0b514973 */
  --wl-sky:              #87c7ff;
  --wl-orange:           #ff4d00; /* token-1a465ae6 */
  --wl-orange-soft:      #ff5e2b; /* token-57fdb807 */
  --wl-orange-tint:      #ff5e2b1a; /* token-7ac71914 (10%) */
  --wl-green:            #0bdb00; /* token-80c76d4c (status) */
  --wl-slate-link:       #6079a3;
  --wl-gray-a20:         #bbbbbb33; /* token-01c07c7e */
  --wl-shadow-tint:      #0000000f; /* token-a44bc734 */

  /* ───────── Color: semantic ───────── */
  --wl-bg:               var(--wl-black);
  --wl-surface-light:    var(--wl-gray-250);
  --wl-surface-dark:     var(--wl-gray-950);
  --wl-border-dark:      var(--wl-gray-850);
  --wl-text-on-dark:     var(--wl-white);
  --wl-text-on-light:    var(--wl-black);
  --wl-text-muted-dark:  var(--wl-gray-500);
  --wl-text-muted-light: rgba(0, 0, 0, 0.3);
  --wl-text-faint-light: rgba(0, 0, 0, 0.2);
  --wl-link-on-dark:     rgba(255, 255, 255, 0.7);
  --wl-action:           var(--wl-yellow);
  --wl-action-text:      var(--wl-black);
  --wl-selection-bg:     var(--wl-yellow);
  --wl-selection-text:   var(--wl-black);

  /* ───────── Glass / overlays ───────── */
  --wl-glass-light:      #ffffff47;           /* white @ 28% */
  --wl-glass-blue:       #9eb8d947;
  --wl-glass-dark:       rgba(255, 255, 255, 0.04);
  --wl-hairline-dark:    rgba(255, 255, 255, 0.14);
  --wl-scrim:            #000000cc;           /* menu overlay */
  --wl-rule:             #ffffffb3;
  --wl-pattern-stripe:   rgba(136, 136, 136, 0.2);
  --wl-blur:             8px;
  --wl-blur-md:          10px;
  --wl-blur-lg:          12px;

  /* ───────── Gradients ───────── */
  --wl-grad-sky:         linear-gradient(#87c7ff 0%, #f5f5f5 100%);
  --wl-grad-blue-glow:   linear-gradient(180deg, var(--wl-blue) -40%, #0000 100%);
  --wl-grad-fade-top:    linear-gradient(to bottom,
                           rgb(240 240 240 / 1) 0%, rgb(240 240 240 / .95) 10%,
                           rgb(240 240 240 / .8) 25%, rgb(240 240 240 / .5) 50%,
                           rgb(240 240 240 / .2) 75%, rgb(240 240 240 / .05) 90%,
                           rgb(240 240 240 / .02) 99%, transparent 100%);

  /* ───────── Typography: families ───────── */
  --wl-font-sans:        "HK Nova Regular", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  --wl-font-sans-medium: "HK Nova Medium", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  --wl-font-bitmap:      "PP NeueBit Regular", "Silkscreen", "Pixelify Sans", monospace;
  --wl-font-pixel:       "Pixelify Sans", monospace;
  --wl-font-mono:        "Necto Mono", "Space Mono", ui-monospace, monospace;
  --wl-font-heavy:       "Utara Variable", "Hanken Grotesk", sans-serif;
  --wl-font-ornament:    "Fleuron", serif;
  --wl-font-ui:          Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --wl-font-features:    "ss07" on;

  /* ───────── Typography: sizes ───────── */
  --wl-text-xs:          12px;
  --wl-text-sm:          13px;
  --wl-text-nav:         14px;
  --wl-text-body:        15px;
  --wl-text-lg:          18px;
  --wl-text-lead:        19px;
  --wl-text-xl:          22px;
  --wl-text-2xl:         24px;
  --wl-text-rail:        28px;
  --wl-text-3xl:         32px;
  --wl-text-4xl:         34px;
  --wl-text-h2:          38px;
  --wl-text-marquee-sm:  44px;
  --wl-text-h1:          46px;
  --wl-text-display:     56px;
  --wl-text-marquee-md:  65px;
  --wl-text-marquee-lg:  75px;

  /* ───────── Typography: tracking / leading ───────── */
  --wl-tracking:         -0.03em;
  --wl-tracking-tight:   -0.05em;  /* buttons */
  --wl-tracking-tighter: -0.07em;  /* rail title */
  --wl-tracking-snug:    -0.01em;
  --wl-leading-marquee:  0.8;
  --wl-leading-none:     1;
  --wl-leading-tight:    1.1;
  --wl-leading-snug:     1.2;
  --wl-leading-normal:   1.4;
  --wl-weight-light:     300;
  --wl-weight-regular:   400;
  --wl-weight-medium:    500;
  --wl-weight-semibold:  600;
  --wl-weight-bold:      700;

  /* ───────── Radius ───────── */
  --wl-radius-form:      10px;
  --wl-radius-media:     14px;
  --wl-radius-menu:      16px;
  --wl-radius-panel:     20px;
  --wl-radius-capsule:   36px;
  --wl-radius-pill:      80px;
  --wl-radius-full:      999px;

  /* ───────── Spacing ───────── */
  --wl-space-0_5:        2px;
  --wl-space-1:          4px;
  --wl-space-1_5:        6px;
  --wl-space-2:          8px;
  --wl-space-2_5:        10px;  /* base gutter, most-used gap */
  --wl-space-3_5:        14px;
  --wl-space-4:          16px;
  --wl-space-5:          20px;
  --wl-space-6:          24px;
  --wl-space-7_5:        30px;
  --wl-space-9:          35px;
  --wl-space-10:         40px;
  --wl-space-11:         45px;  /* section padding */
  --wl-gutter:           var(--wl-space-2_5);

  /* ───────── Layout ───────── */
  --wl-max-page:         1600px;
  --wl-max-wide:         1400px;
  --wl-max-content:      1200px;
  --wl-max-nav:          1128px;
  --wl-max-narrow:       600px;
  --wl-nav-top:          24px;

  /* ───────── Effects ───────── */
  --wl-shadow-form:      0 1px 1px rgba(255,255,255,.03) inset, 0 12px 40px rgba(0,0,0,.35);
  --wl-shadow-glow:      0 0 0 1px rgba(255,255,255,.16) inset, 0 8px 28px rgba(255,255,255,.14);

  /* ───────── Motion ───────── */
  --wl-ease:             ease;
  --wl-dur-fast:         0.2s;
  --wl-dur-base:         0.3s;
  --wl-reveal-y:         40px;
  --wl-reveal-blur:      10px;

  /* ───────── Z-index ───────── */
  --wl-z-nav:            9;
  --wl-z-menu:           10;
  --wl-z-fade:           9999;
}

/* Breakpoints (use in @media, custom props can't be used there):
   mobile  max-width: 809.98px
   tablet  810px to 1199.98px
   desktop 1200px to 1599.98px
   wide    min-width: 1600px */
```

## Base styles

```css
html, body { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--wl-bg);
  color: var(--wl-text-on-dark);
  font-family: var(--wl-font-sans);
  font-size: var(--wl-text-nav);
  letter-spacing: var(--wl-tracking);
  -webkit-font-smoothing: antialiased;
}

::selection { background: var(--wl-selection-bg); color: var(--wl-selection-text); }

h1, h2, h3 {
  font-family: var(--wl-font-sans-medium);
  font-weight: var(--wl-weight-medium);
  font-feature-settings: var(--wl-font-features);
  letter-spacing: var(--wl-tracking);
  line-height: var(--wl-leading-tight);
  text-wrap: balance;
  margin: 0;
}
h1 { font-size: var(--wl-text-display); }
h2 { font-size: var(--wl-text-h1); }
h3 { font-size: var(--wl-text-h2); }
```

## Component snippets

```css
/* Full-viewport panel tile */
.wl-panel {
  height: 100vh;
  padding: var(--wl-gutter);
}
.wl-panel__inner {
  position: relative;
  height: 100%;
  border-radius: var(--wl-radius-panel);
  overflow: hidden;
}
.wl-panel__inner--sky { background: var(--wl-grad-sky); }

/* Glass CTA capsule */
.wl-capsule {
  display: flex;
  align-items: center;
  gap: var(--wl-space-3_5);
  width: min-content;
  padding: var(--wl-space-2_5);
  border-radius: var(--wl-radius-capsule);
  background: var(--wl-glass-light);
  -webkit-backdrop-filter: blur(var(--wl-blur));
  backdrop-filter: blur(var(--wl-blur));
  white-space: nowrap;
}
.wl-capsule--blue { background: var(--wl-glass-blue); }
.wl-capsule__label {
  font-family: var(--wl-font-sans-medium);
  font-size: var(--wl-text-lead);
  color: var(--wl-white);
  padding-inline: var(--wl-space-1_5);
}

/* Primary highlighter button */
.wl-btn {
  display: inline-flex;
  align-items: center;
  padding: var(--wl-space-2) var(--wl-space-3_5); /* inferred */
  border-radius: var(--wl-radius-pill);
  background: var(--wl-action);
  color: var(--wl-action-text);
  font-family: var(--wl-font-sans);
  font-size: var(--wl-text-nav);
  letter-spacing: var(--wl-tracking-tight);
  line-height: var(--wl-leading-none);
  text-transform: lowercase;
  text-decoration: none;
  transition: opacity var(--wl-dur-fast) var(--wl-ease);
}
.wl-btn:hover { opacity: .85; } /* inferred */

/* Inverse button (on dark) */
.wl-btn--inverse {
  border-radius: var(--wl-radius-full);
  padding: 12px 16px;
  background: var(--wl-white);
  font-family: var(--wl-font-ui);
  font-weight: var(--wl-weight-semibold);
  letter-spacing: normal;
  text-transform: none;
  box-shadow: var(--wl-shadow-glow);
}

/* Product card */
.wl-card {
  display: flex;
  flex-direction: column;
  gap: 29px;
  border-radius: var(--wl-radius-panel);
  background: var(--wl-surface-light);
  color: var(--wl-text-on-light);
  overflow: hidden;
}
.wl-card__media { border-radius: var(--wl-radius-media); overflow: hidden; }
.wl-card__title { font-family: var(--wl-font-sans-medium); font-size: var(--wl-text-xl); }
.wl-card__meta  { font-size: var(--wl-text-lg); color: var(--wl-text-muted-light); }

/* Tag pill */
.wl-tag {
  display: inline-flex;
  padding: var(--wl-space-1) 11px;
  border-radius: var(--wl-radius-full);
  font-size: var(--wl-text-xs);
  line-height: var(--wl-leading-normal);
  letter-spacing: 0;
  background: var(--wl-yellow);
  color: var(--wl-black);
}
.wl-tag--dark { background: var(--wl-gray-700); color: var(--wl-white); }

/* Floating nav */
.wl-nav {
  position: fixed;
  top: var(--wl-nav-top);
  left: 50%;
  transform: translateX(-50%);
  width: min(var(--wl-max-nav), calc(100vw - 2 * var(--wl-gutter)));
  z-index: var(--wl-z-nav);
}
.wl-nav__item {
  padding: 0 var(--wl-space-3_5);
  border-radius: var(--wl-radius-pill);
  background: transparent;
  transition: background var(--wl-dur-fast) var(--wl-ease);
}
.wl-nav__item:hover { background: var(--wl-glass-light); } /* inferred */

/* Newsletter */
.wl-newsletter {
  max-width: var(--wl-max-content);
  padding: var(--wl-space-5);
  border: 1px solid var(--wl-border-dark);
  border-radius: var(--wl-radius-panel);
  background: var(--wl-surface-dark);
}
.wl-form {
  display: flex; flex-direction: column; gap: var(--wl-space-3_5);
  padding: var(--wl-space-6);
  border: 1px solid var(--wl-hairline-dark);
  border-radius: var(--wl-radius-form);
  background: var(--wl-glass-dark);
  box-shadow: var(--wl-shadow-form);
  -webkit-backdrop-filter: blur(var(--wl-blur));
  backdrop-filter: blur(var(--wl-blur));
  font-family: var(--wl-font-ui);
}

/* Marquee line */
.wl-marquee {
  color: var(--wl-white);
  line-height: var(--wl-leading-marquee);
  font-size: var(--wl-text-marquee-sm);
  white-space: nowrap;
}
@media (min-width: 810px) { .wl-marquee { font-size: var(--wl-text-marquee-lg); } }

/* Word reveal */
.wl-word {
  display: inline-block;
  opacity: 0.001;
  filter: blur(var(--wl-reveal-blur));
  transform: translateY(var(--wl-reveal-y));
  transition: opacity .6s ease, filter .6s ease, transform .6s ease; /* timing inferred */
}
.is-visible .wl-word { opacity: 1; filter: none; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .wl-word { filter: none; transform: none; }
}
```

## Fonts

```html
<!-- Free fallbacks -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;700&family=Pixelify+Sans&family=Silkscreen&family=Space+Mono&display=swap" rel="stylesheet">
```

```css
/* Licensed files (point at your own copies) */
@font-face { font-family: "HK Nova Regular"; src: url("/fonts/hk-nova-regular.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "HK Nova Medium";  src: url("/fonts/hk-nova-medium.woff2")  format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "PP NeueBit Regular"; src: url("/fonts/pp-neuebit.woff2") format("woff2"); font-weight: 400; font-display: swap; }

/* Metric-matched Arial fallbacks, copied from the site to cut layout shift */
@font-face { font-family: "HK Nova Regular Placeholder"; src: local("Arial"); ascent-override: 87.90%; descent-override: 27.16%; line-gap-override: 0%; size-adjust: 110.38%; }
@font-face { font-family: "HK Nova Medium Placeholder";  src: local("Arial"); ascent-override: 86.04%; descent-override: 26.59%; line-gap-override: 0%; size-adjust: 112.76%; }
@font-face { font-family: "PP NeueBit Regular Placeholder"; src: local("Arial"); ascent-override: 81.13%; descent-override: 21.63%; line-gap-override: 5.40%; size-adjust: 66.02%; }
```
