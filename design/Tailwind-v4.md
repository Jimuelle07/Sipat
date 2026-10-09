# Work Louder: Tailwind CSS v4 setup

Tailwind v4 is CSS-first: no `tailwind.config.js`, everything lives in `@theme`. Values come from https://worklouder.cc/ (extracted 2026-10-09). See `DESIGN.md` for usage rules.

## 1. `app.css`

```css
@import "tailwindcss";

/* Free fallbacks for the commercial faces (swap in licensed HK Nova / PP NeueBit if you have them) */
@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;700&family=Pixelify+Sans&family=Silkscreen&family=Space+Mono&display=swap");

/* Reset the default palette so only brand colors exist */
@theme {
  --color-*: initial;

  /* Core */
  --color-black: #000000;
  --color-white: #ffffff;
  --color-transparent: transparent;
  --color-current: currentColor;
  --color-yellow: #edff00;          /* highlighter accent */

  /* Neutrals */
  --color-gray-50:  #f7f7f7;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #e2e2e2;
  --color-gray-250: #d7d7d7;        /* product card */
  --color-gray-300: #d4d4d4;
  --color-gray-400: #b2b2b2;
  --color-gray-450: #adadad;
  --color-gray-500: #a8a8a8;        /* muted on dark */
  --color-gray-550: #808080;
  --color-gray-600: #777777;
  --color-gray-650: #707070;
  --color-gray-700: #444444;        /* dark tag */
  --color-gray-800: #333333;
  --color-gray-850: #2d2d2d;        /* dark border */
  --color-gray-900: #161616;
  --color-gray-950: #121212;        /* dark card */

  /* Secondary accents */
  --color-blue: #065bff;
  --color-ultramarine: #000dff;
  --color-navy: #00056e;
  --color-sky: #87c7ff;
  --color-orange: #ff4d00;
  --color-orange-soft: #ff5e2b;
  --color-green: #0bdb00;
  --color-slate: #6079a3;

  /* Glass */
  --color-glass: #ffffff47;
  --color-glass-blue: #9eb8d947;
  --color-glass-dark: rgb(255 255 255 / 0.04);
  --color-hairline: rgb(255 255 255 / 0.14);
  --color-scrim: #000000cc;

  /* Fonts */
  --font-sans: "HK Nova Regular", "HK Nova Regular Placeholder", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-display: "HK Nova Medium", "HK Nova Medium Placeholder", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-bitmap: "PP NeueBit Regular", "Silkscreen", "Pixelify Sans", monospace;
  --font-pixel: "Pixelify Sans", monospace;
  --font-mono: "Necto Mono", "Space Mono", ui-monospace, monospace;
  --font-heavy: "Utara Variable", "Hanken Grotesk", sans-serif;
  --font-ui: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  /* Type scale (size + default line-height + tracking) */
  --text-xs: 12px;     --text-xs--line-height: 1.4;
  --text-sm: 13px;
  --text-nav: 14px;    --text-nav--letter-spacing: -0.03em;
  --text-body: 15px;   --text-body--letter-spacing: -0.03em;
  --text-lg: 18px;     --text-lg--letter-spacing: -0.03em;
  --text-lead: 19px;   --text-lead--letter-spacing: -0.03em;
  --text-xl: 22px;     --text-xl--letter-spacing: -0.03em;
  --text-2xl: 24px;    --text-2xl--letter-spacing: -0.03em;
  --text-rail: 28px;   --text-rail--line-height: 1.1;  --text-rail--letter-spacing: -0.07em;
  --text-3xl: 32px;    --text-3xl--line-height: 1.1;   --text-3xl--letter-spacing: -0.03em;
  --text-h2: 38px;     --text-h2--letter-spacing: -0.03em;
  --text-h1: 46px;     --text-h1--line-height: 1.1;    --text-h1--letter-spacing: -0.03em;
  --text-display: 56px; --text-display--line-height: 1.1; --text-display--letter-spacing: -0.03em;
  --text-marquee-sm: 44px; --text-marquee-sm--line-height: 0.8;
  --text-marquee-md: 65px; --text-marquee-md--line-height: 0.8;
  --text-marquee-lg: 75px; --text-marquee-lg--line-height: 0.8;

  --tracking-wl: -0.03em;
  --tracking-wl-tight: -0.05em;
  --tracking-wl-tighter: -0.07em;
  --leading-marquee: 0.8;

  /* Radius */
  --radius-form: 10px;
  --radius-media: 14px;
  --radius-menu: 16px;
  --radius-panel: 20px;
  --radius-capsule: 36px;
  --radius-pill: 80px;

  /* Spacing: keep Tailwind's 4px multiplier; 10px gutter = p-2.5 */
  --spacing: 4px;

  /* Layout */
  --container-page: 1600px;
  --container-wide: 1400px;
  --container-content: 1200px;
  --container-nav: 1128px;

  /* Breakpoints (Framer's) */
  --breakpoint-*: initial;
  --breakpoint-md: 810px;
  --breakpoint-lg: 1200px;
  --breakpoint-xl: 1600px;

  /* Effects */
  --blur-glass: 8px;
  --shadow-form: 0 1px 1px rgb(255 255 255 / .03) inset, 0 12px 40px rgb(0 0 0 / .35);
  --shadow-glow: 0 0 0 1px rgb(255 255 255 / .16) inset, 0 8px 28px rgb(255 255 255 / .14);

  /* Motion */
  --animate-marquee: marquee 40s linear infinite;   /* duration inferred */
  --animate-reveal: reveal 0.6s ease both;           /* duration inferred */

  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes reveal {
    from { opacity: 0.001; filter: blur(10px); transform: translateY(40px); }
    to   { opacity: 1;     filter: blur(0);    transform: translateY(0); }
  }
}

@layer base {
  html { background: var(--color-black); }
  body {
    @apply bg-black text-white font-sans text-nav antialiased;
  }
  h1, h2, h3 {
    @apply font-display font-medium tracking-wl leading-[1.1] text-balance;
    font-feature-settings: "ss07" on;
  }
  ::selection { @apply bg-yellow text-black; }
}

/* Gradients (v4 can't hold these in @theme as colors) */
@utility bg-sky-panel   { background-image: linear-gradient(#87c7ff 0%, #f5f5f5 100%); }
@utility bg-blue-glow   { background-image: linear-gradient(180deg, var(--color-blue) -40%, #0000 100%); }
@utility ss07           { font-feature-settings: "ss07" on; }

/* Components */
@utility panel {
  height: 100vh;
  padding: 10px;
}
@utility capsule {
  display: flex;
  align-items: center;
  gap: 14px;
  width: min-content;
  padding: 10px;
  border-radius: var(--radius-capsule);
  background: var(--color-glass);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass));
  white-space: nowrap;
}
@utility btn-yellow {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;              /* inferred */
  border-radius: var(--radius-pill);
  background: var(--color-yellow);
  color: var(--color-black);
  font-family: var(--font-sans);
  font-size: var(--text-nav);
  letter-spacing: var(--tracking-wl-tight);
  line-height: 1;
  text-transform: lowercase;
  transition: opacity .2s ease;
  &:hover { opacity: .85; }       /* inferred */
}
```

## 2. Component recipes

### Floating nav
```html
<nav class="fixed top-6 left-1/2 z-[9] w-[min(var(--container-nav),calc(100vw-20px))] -translate-x-1/2">
  <ul class="flex items-center gap-1 text-nav">
    <li><a class="rounded-pill px-3.5 py-2 transition-colors hover:bg-glass" href="#">Keyboards</a></li>
    <li><a class="rounded-pill px-3.5 py-2 transition-colors hover:bg-glass" href="#">Accessories</a></li>
    <li><a class="rounded-pill px-3.5 py-2 transition-colors hover:bg-glass" href="#">Support</a></li>
  </ul>
</nav>
```
Dropdown item: `rounded-menu px-3 py-2 text-nav hover:bg-white/5`. Open menu scrim: `fixed inset-0 z-[9] bg-scrim`.

### Hero / product panel with glass CTA
```html
<section class="panel">
  <div class="relative h-full overflow-hidden rounded-panel">
    <img src="hero.webp" alt="" class="absolute inset-0 size-full object-cover">
    <div class="relative flex h-full flex-col justify-between p-[45px]">
      <h1 class="text-display text-white ss07">More Talking,<br>More Doing.</h1>

      <div class="capsule">
        <span class="px-1.5 font-display font-medium text-lead text-white">Creator Micro 2</span>
        <a href="#" class="btn-yellow">more</a>
      </div>
    </div>
  </div>
</section>
```
Blue scene variant: replace `capsule`'s background with `bg-glass-blue`. Sky variant: `bg-sky-panel` on the inner div and `text-black` headings.

### Two-up panels
```html
<section class="grid h-screen grid-cols-1 gap-2.5 p-2.5 md:grid-cols-2">
  <div class="relative overflow-hidden rounded-panel bg-gray-250">…</div>
  <div class="relative overflow-hidden rounded-panel bg-sky-panel">…</div>
</section>
```

### Product card + tag
```html
<a href="#" class="flex w-[311px] shrink-0 flex-col gap-[29px] overflow-hidden rounded-panel bg-gray-250 p-5 text-black">
  <span class="w-fit rounded-full bg-yellow px-[11px] py-1 text-xs tracking-normal">keycaps</span>
  <div class="overflow-hidden rounded-media"><img src="knob-sans.png" alt="" class="w-full"></div>
  <div>
    <p class="font-display font-medium text-xl">Knob Sans</p>
    <p class="text-lg text-black/30">$74.98</p>
  </div>
</a>
```
Dark tag: `bg-gray-700 text-white`. Rail header: `font-display font-medium text-rail text-white`.

### Marquee
```html
<div class="overflow-hidden">
  <ul class="flex w-max animate-marquee gap-10 whitespace-nowrap text-marquee-sm leading-marquee text-white md:text-marquee-lg">
    <li class="font-pixel">Know productivity ⚡,</li>
    <li class="font-bitmap">Efficiency ⚙️,</li>
    <li class="font-heavy font-black">Passion ❤️‍🔥,</li>
    <li class="font-mono">Creativity 🎨 with no limits -</li>
    <!-- duplicate the list items once for a seamless loop -->
  </ul>
</div>
```

### Newsletter
```html
<section class="mx-auto max-w-content rounded-panel border border-gray-850 bg-gray-950 p-5">
  <form class="flex flex-col gap-3.5 rounded-form border border-hairline bg-glass-dark p-6 font-ui shadow-form backdrop-blur-[8px]">
    <div class="flex flex-col gap-1.5">
      <h3 class="m-0 text-[22px] leading-[1.2] tracking-[-0.01em] text-white">Hey! Interested in staying in the loop?</h3>
      <p class="m-0 text-[14px] leading-[1.4] text-gray-500">Get occasional updates about projects, writing, and launches.</p>
    </div>
    <div class="flex flex-wrap gap-2.5">
      <label class="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
        <span class="text-sm text-gray-500">First name</span>
        <input class="rounded-form border border-hairline bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/40">
      </label>
      <label class="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
        <span class="text-sm text-gray-500">Email</span>
        <input type="email" class="rounded-form border border-hairline bg-white/5 px-3 py-2.5 text-white outline-none focus:border-white/40">
      </label>
    </div>
    <button class="w-full rounded-full bg-white px-4 py-3 text-[14px] leading-none font-semibold text-black shadow-glow transition-opacity hover:opacity-90">Submit</button>
    <p class="m-0 text-[10px] text-gray-500">By submitting this form you agree to our Privacy Policy.</p>
  </form>
</section>
```
(Input styling is *inferred*; the site's form inherits browser defaults inside the glass card.)

### Footer
```html
<footer class="flex flex-wrap items-center gap-x-6 gap-y-2 px-[45px] py-10 text-nav text-white/70">
  <a href="#" class="hover:text-white">Terms of services</a>
  <a href="#" class="hover:text-white">Return policy</a>
  <a href="#" class="hover:text-white">Privacy policy</a>
  <span class="ml-auto">© 2026 Your Co.</span>
</footer>
```

### Word reveal
Wrap each word in `<span class="inline-block animate-reveal">` and stagger with `style="animation-delay: calc(var(--i) * 60ms)"`. Trigger on scroll by toggling the animation with an IntersectionObserver, and add `motion-reduce:animate-none` for reduced motion.

## 3. Class cheat-sheet

| Need | Classes |
|---|---|
| Page | `bg-black text-white font-sans` |
| Section tile | `panel` → inner `rounded-panel overflow-hidden` |
| Display headline | `font-display font-medium text-display ss07` |
| Primary action | `btn-yellow` |
| Glass group | `capsule` / `capsule bg-glass-blue` |
| Muted (light bg) | `text-black/30` |
| Muted (dark bg) | `text-gray-500` / `text-white/70` |
| Tag | `rounded-full px-[11px] py-1 text-xs bg-yellow text-black` |
| 10px gutter | `p-2.5` / `gap-2.5` |
