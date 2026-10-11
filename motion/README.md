# Sipat — product film (Remotion)

A separate Remotion project for the 30-second Sipat showreel. It does not touch the Expo app: it has its own
`package.json` and `node_modules`, the app's `tsconfig.json` and Vitest config do not include this folder, and it
only *reads* brand assets from `../assets`. Storyboard: [STORYBOARD.md](STORYBOARD.md). Sound: [CUE-SHEET.md](CUE-SHEET.md).

## Reproduce

```bash
cd motion
npm install
python scripts/prepare_assets.py          # trims the mascots, copies Ionicons + the header icon, bakes grain
python scripts/score.py                   # synthesises the original score → public/audio/sipat-score.wav
npm run typecheck
npm run render                             # → out/showreel-30/sipat-showreel-30.mp4 (1920×1080, 60 fps, H.264 + AAC; ~15 min with motion blur)
npm run render:vertical                    # → out/showreel-30/sipat-showreel-30-vertical.mp4 (1080×1920)
node scripts/stills.mjs out/dev 0 8s 29.8s # any frames (number or seconds) as PNG stills; COMP=SipatShowreel30Vertical for 9:16
python scripts/decode.py out/showreel-30/sipat-showreel-30.mp4 out/frames 0 0 1787   # exact frames decoded from the MP4
python scripts/sheet.py out/sheet.png 4 out/frames/*.png                               # contact sheet
npm run studio                             # live preview
```

`prepare_assets.py` needs Python with Pillow and NumPy; `score.py` needs NumPy. Fonts (Bowlby One, Inter, Libre Baskerville) load through
`@remotion/google-fonts` at render time, so the first render needs a network connection.

## Layout

| Path | What |
| :-- | :-- |
| `src/theme.ts` | `palette.json` imported directly, plus the light-scheme colour roles, type scale, radii, shadows and motion curves mirrored from `app/ui/theme/themes.ts`. |
| `src/ui/` | Web reconstructions of the app's components (Tile, Tag, Chip, WarningOption, SwitchBanner, ChecklistRow, SummaryCard, RefusalCard, PhaseSelector, the Home hero poster, Marquee, the status bar and the after-phase Home). |
| `src/scenes/` | The eight scenes, plus the elements that cross scenes (status bar, mascot). |
| `src/timeline.ts` | One frame clock (60 fps, 100 BPM, 36 frames a beat) and the shared geometry. |
| `src/stage.tsx` | The canvas, key light, vignette, grain and the rounded-rect flood masks. |
| `src/effects.tsx` | Camera punch-ins, touch indicators, sticker-label captions and the motion-blur windows. |
| `scripts/score.py` | The original score and SFX, synthesised with NumPy and timed to the cue sheet. |
| `scripts/` | Asset prep, multi-frame stills, contact sheets. |

## Real sources the film uses

Nothing on screen is invented; where the film needed a value, it was taken from, or computed by, the app.

| On screen | Source |
| :-- | :-- |
| Colours, phase canvases, washes, warning tones, shadows, radii, type scale, motion curves | `assets/color-palette/palette.json`, `app/ui/theme/themes.ts` |
| Mascots (before, during, after), trimmed to their silhouette | `assets/character/*.png` |
| App icon (header and end card) | `assets/agi-sipat-logo.png` |
| Icons | Ionicons font from `@expo/vector-icons`, as the app renders them |
| Phase names and moods, "Ibalik", relation and age labels, "Babala · Sipat" | `app/ui/strings/common.ts` |
| "Ano ang narinig mo?", "Signal ng hangin", menu heads, "Tahanan", "Mga dapat gawin" tile | `app/ui/strings/home.ts` |
| Signal No. 1–5 labels and tones | `content/warnings.json`, `buildWarningTones()` |
| "Lumipat sa Habang may bagyo.", "Signal No. 3 ang aktibo." | `copy.ts` `phase_switched`, `decidePhase.ts` reason text |
| Checklist rows, "Para sa: …", "Tapos na ang 4 → 7 sa 26" | `content/checklist.json` run through `app/core/checklist.ts` for the DEMO household with Signal No. 3 |
| "Ano ang ilalagay sa go bag?" | `app/ui/strings/ask.ts` `example_go_bag` |
| Summary card title and text | passage `before-gobag-01` in `content/guide.tl.json` (the real search's top hit, gate passed) |
| AI answer | first sentence of the sample answer in `app/engine/mock.ts` |
| Source tile | `qc-guide-go-bag` in `content/sources.json`; labels from `app/ui/strings/guide.ts` |
| "Magkano ang bigas ngayon?", "Wala ito sa gabay.", chips | eval `o001`; `copy.ts` `refusal`; the real search's suggestions (flood, home_prep, pets) |
| "Sundin ang utos ng barangay at ng mga awtoridad." | `copy.ts` `closing` |
| Household | `app/engine/demoSeed.ts` (DEMO names, shown without the "(DEMO)" suffix; illustrated portraits, no faces) |
| "Walang signal.", "Gabay kahit walang signal." | Film lines, from the positioning in `docs/solution.md` ("…what to do, even with no signal") |
