# Sipat showreel — music and SFX cue sheet

The films carry an **original score** synthesised in code by [scripts/score.py](scripts/score.py) (felt-piano, pad and
mallet tones, rain bed and UI sounds, all generated with NumPy; no samples, no third-party audio, nothing pulled from
the internet). It follows this sheet frame for frame, so a composer replacing it can work from the same table.
Picture is cut to **100 BPM** (one beat = 0.600 s = 36 frames at 60 fps). Times are from the first frame of
`sipat-showreel-30.mp4` (29.80 s, 1788 frames).

**Music.** Warm, hopeful, steady at 100 BPM; felt piano or soft mallets over a low pad. Not dramatic: no risers,
booms, sirens or EDM drops. Enters with the daylight at 2.43 s, drops out completely for the refusal beat, returns
for the exhale, and resolves on the wordmark.

| Time (s) | Frame | Picture | Sound |
| --: | --: | :-- | :-- |
| 0.00 | 0 | Macro status bar on night navy | Soft rain bed, low and close (gone by 2.6 s). No music. |
| 0.40 / 0.67 / 0.93 / 1.20 | 24 / 40 / 56 / 72 | Signal bars drop, tallest first | Four tiny descending glass ticks; the last lands on beat 2 (1.20 s). |
| 1.47–1.90 | 88–114 | Airplane glyph slides in | One soft click as it settles. |
| 1.60 | 96 | "Walang signal." | Rain only. |
| 2.10 | 126 | Camera pulls back; the status bar docks | — |
| 2.43 | 146 | Daylight grows from the airplane glyph | Music enters: warm pad + first piano chord. |
| 2.60–3.30 | 156–198 | "Bago ang bagyo", household cards, coin | Light piano roll (the cards are 40 ms apart: one gesture, not five hits). |
| 6.73 | 404 | Home scrolls to "Ano ang narinig mo?" | — |
| 7.33 | 440 | Camera punches in on Signal No. 3 | Faint air swell. |
| **7.80** | **468** | **Tap on Signal No. 3** (beat 13) | **Restrained tactile tick.** |
| 8.40–9.00 | 504–540 | Tile stretches into the switch banner | Music thins to the pad. |
| **9.00** | **540** | **Banner lands; orange floods out of it** (beat 15) | **Single low, soft impact** (felt thump, short tail). Music turns plainer and tighter. |
| 9.17 | 550 | Mascot swaps to the raincoat | Optional fabric rustle, very low. |
| 11.50 | 690 | Checklist scrolls in under the banner | — |
| 12.80 | 768 | Camera punches in on the Go bag rows | Faint air swell. |
| **13.20 / 13.80 / 14.40** | **792 / 828 / 864** | **Three rows tick** (beats 22, 23, 24) | **Three tactile UI ticks**, same pitch, dry. |
| 16.33 | 980 | "Go bag" lifts into the question bubble | Tiny lift tone. |
| 16.80–17.38 | 1008–1043 | Question types | Keys optional, almost inaudible. |
| **17.40** | **1044** | **Vetted summary card lands** | **Light, warm tonal chime.** |
| 17.90–19.07 | 1074–1144 | AI answer streams under "Sinusuri pa" | Faint soft shimmer under the words; stops at 19.17. |
| 19.07 | 1144 | Camera punches in on "Saan galing ito?" | Faint air swell. |
| 19.47 | 1168 | Tap on "Saan galing ito?" | Soft tick. |
| 19.60 | 1176 | "Saan galing ito?" opens the source | Soft paper slide. |
| 21.97 | 1318 | Conversation scrolls up | — |
| 22.33–22.88 | 1340–1373 | "Magkano ang bigas ngayon?" types | Music fades out by 22.9 s. |
| **22.88–23.40** | **1373–1404** | **Nothing is generated** | **Clean silence.** |
| **23.40** | **1404** | **"Wala ito sa gabay." resolves** (beat 39) | One low, plain piano note; no chime. |
| 23.57 | 1414 | Camera punches in on the refusal | Faint air swell, under the note. |
| 24.67 | 1480 | Refusal leaves; phase selector rises | Music returns, softer. |
| 25.07 | 1504 | Tap on Pagkatapos; the selector slides | Soft click. |
| 25.43 | 1526 | Lavender floods out of the selector | Exhale: slow pad swell, no impact. |
| 26.40 | 1584 | "Sundin ang utos ng barangay at ng mga awtoridad." | Melody rests. |
| 27.33 | 1640 | Frame pulls back into the phone | Music begins its cadence. |
| **28.00–28.57** | **1680–1714** | **App icon and "Sipat" resolve** | **Resolved final chord, landing at 28.57.** |
| 28.70–29.80 | 1722–1788 | Final frame holds still | Chord rings out; silence by 29.8 s. |
