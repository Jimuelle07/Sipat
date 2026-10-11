# Sipat — 30-second showreel storyboard

Composition `SipatShowreel30`: 1920×1080, 60 fps, 1788 frames (**29.80 s**). The vertical cut `SipatShowreel30Vertical`
(1080×1920) runs on the same clock with its own layout ([src/layout.ts](src/layout.ts)). Cut to 100 BPM: one beat is
36 frames. All frame numbers live in [src/timeline.ts](src/timeline.ts).

**Idea.** The whole frame is the phone's screen canvas, seen from inside. The stage colour *is* the phase:
navy (signal lost) → mint `#BFEBE2` (Bago) → orange `#FFDDB8` (Habang) → lavender `#DDD4F8` (Pagkatapos). Each new
phase floods out of the UI object that caused it. The status bar, with its airplane glyph, is the through-line from the
first frame to the phone at the end.

| # | Frames (s) | Key visual | Transition in | Copy (repo source) | Rhythm |
|---|---|---|---|---|---|
| 1 Signal lost | 0–140 (0.00–2.33) | Macro (12×) on the status glyphs over night navy. Four signal bars drop away, tallest first; the airplane glyph slides into their place. | Opens composed on frame 0. | "Walang signal." (film line) | Last bar lands on beat 2 (1.20 s). |
| 2 Bago ang bagyo | 126–452 (2.10–7.53) | Calm pull back: the status bar docks to the top while mint daylight grows out of the airplane glyph. "BAGO ANG BAGYO" and five household cards settle (600 ms reveal, 40 ms stagger, 16 dp rise); the before mascot sits at the end of the row; the poster's sunburst coin pops. | Airplane glyph → daylight (pill mask). | `phase_before`, `mood_before` "Maghanda habang kalmado pa.", DEMO seed names, `relation_*` · `age_*` labels | Calm, breathing. |
| 3 Habang may bagyo | 404–720 (6.73–12.00) | Home scrolls to "Ano ang narinig mo?". Signal No. 3 is tapped (beat 13), lifts and stretches into the real switch banner, which lands on beat 15; orange floods out of the banner; the mascot swaps to the raincoat in place, then steps aside to the corner. | Scroll through Home; tile → banner → flood. | "Ano ang narinig mo?", "Signal ng hangin", "Signal No. 1–5" (`warnings.json`), "Babala · Sipat", "Lumipat sa Habang may bagyo.", "Signal No. 3 ang aktibo.", "Ibalik" | The film's one impact. During motion is tight: 150–200 ms, no stagger. |
| 4 Mga dapat gawin | 690–1034 (11.50–17.23) | The screen scrolls under the banner: left, "Mga dapat gawin", intro, the Signal No. 3 tag and "Tapos na ang 4 sa 26"; right, the Go bag group. Three rows tick on beats 22–24 (First aid kit, Baby Joy's supplies, Lola Ising's maintenance medicine); progress climbs to 7 of 26. | Banner rides up with the scroll. | `checklist.json` text verbatim; counts from `buildChecklist()` on the DEMO household with Signal No. 3 | Tick, tick, tick. |
| 5 Magtanong | 980–1340 (16.33–22.33) | The "Go bag" title lifts into the question bubble and "Ano ang ilalagay sa go bag?" types; on send, the vetted summary lands first, the AI answer streams second under "Sinusuri pa", and "Saan galing ito?" opens into the source tile while the column pans left. | Checklist title → question bubble. | `example_go_bag`; passage `before-gobag-01` title + summary (what the real search returns); AI text = first sentence of the mock engine's sample; source from `sources.json` | Chime on the summary. |
| 6 Wala ito sa gabay | 1318–1496 (21.97–24.93) | The conversation scrolls up; "Magkano ang bigas ngayon?" types. Nothing is generated. After a beat of stillness the RefusalCard resolves slowly, with the real suggestion chips; slow push in. | Ask stream scrolls. | eval `o001`; `refusal`; chips from the real search: Baha, Paghahanda sa bahay, Alagang hayop | Silence, then one plain note on beat 39. |
| 7 Pagkatapos ng bagyo | 1480–1650 (24.67–27.50) | Phase selector close-up; the thumb slides to Pagkatapos and lavender floods out of it; the camera eases out to the after poster as it rises; the mascot comes home into the poster, now with the towel; the closing line. | Selector thumb → lavender. | `phaseShort_*`, `phase_after`, `mood_after`, `closing` "Sundin ang utos ng barangay at ng mga awtoridad." | Exhale: 700 ms reveals. |
| 8 Sipat | 1640–1788 (27.33–29.80) | The frame contracts into the phone's screen as its body comes up around it: the real after-phase Home, airplane glyph in the status bar. App icon, "Sipat" and the line resolve; still from frame 1722 (66 frames, 1.10 s). | Frame → phone screen. | App icon (`assets/agi-sipat-logo.png`), "Sipat", "Gabay kahit walang signal." (film line) | Resolved chord. |

**Effects layer** ([src/effects.tsx](src/effects.tsx)), on top of the scenes above, all on existing beats:

| Effect | Where (frames) |
| :-- | :-- |
| Camera punch-ins (ease in, hold, ease out; the focus follows the action) | Signal No. 3 tap 440–524 (1.55×) · the three ticks, stepping row to row, then pulling out to "Tapos na ang 7 sa 26" 768–906 (1.45×) · "Saan galing ito?" into the source tile 1144–1240 (1.4×) · "Wala ito sa gabay." 1414–1498 (1.4×). In 9:16 the camera zooms straight in on the column at 0.4 of that scale, so no line is cut. |
| Touch indicator (ink dot, white rim, press dip, ripple; constant size on screen while zoomed) | Signal No. 3 (468) · checkboxes (792, 828, 864) · "Saan galing ito?" (1168) · Pagkatapos (1504) |
| Sticker-label captions (paper capsule, ink stroke, Bowlby One; pop and settle) | "Para sa buong pamilya." 236–392 · "Isang tap lang." 568–684 · "Angkop sa pamilya." 896–984 · "Mula sa opisyal na gabay." 1240–1312 · "Hindi nanghuhula." 1446–1474 |
| 3D arrival tilt (settles flat) | household cards, warning picker, checklist panels, summary card, source tile, refusal card, after poster |
| Motion blur (6 samples, 180° shutter) | only on fast moves: pull-backs, scrolls, punch-ins, the banner morph, the mascot moves, the bubble lift |

**Vertical cut.** Same beats, recomposed for 9:16:
- The title stacks onto two lines, and the household becomes a 3 + 2 grid with the mascot in the sixth place.
- The picker and banner run full width with the mascot on the floor below.
- The checklist stacks progress above the Go bag rows.
- The question lands where the Go bag tile was, and the conversation scrolls up on send, with the source below the answer.
- The closing line sits under the poster.
- The phone stands above the icon and wordmark.
