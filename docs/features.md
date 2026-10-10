# Features: Sipat

What the app does, grouped by area and tagged by release. This is the feature source of truth: [solution.md](solution.md) tells the story around it, [system-design.md](system-design.md) explains how each feature works and [api-layer.md](api-layer.md) has the data shapes. Where they disagree, this file wins.

## How to read this

**Main features** are the reason the app exists: the household, the bagyo phase, and the offline Taglish assistant. **Other features** support them.

**Release tags.** **MVP (core)**: the demo depends on it; build first. **MVP**: next, once the core works end to end. **MVP stretch**: only after every MVP row is green (hour 7 feature freeze, [solution.md](solution.md#10-the-10-hour-build-plan)); every online feature sits here. **Pilot**: the first one or two LGUs harden it. If time runs short, cut plain MVP rows before core rows.

**Hybrid, offline first.** The app is a hybrid of a local core and a cloud data feed:

| Works with no signal (local) | Needs signal once, then works offline from the cache (cloud) |
| :-- | :-- |
| Household setup and photos, bagyo phases and themes, warning picker, Ask in Taglish (on-device model or summaries), checklists, hotlines, safety rules, the bundled guide, member cards, the static sign-up, login and forgot-password screens | Latest PAGASA bulletin and forecast around the household, recommended evacuation centers, guide and hotline updates, damage reports to the LGU (Pilot), profile backup after sign-in (Later) |

The phone talks to one host only: our own server, which runs the scraper ([section 10](#10-updates-scraper-and-lgu-packs)). The phone never contacts PAGASA or any other site directly. Every request shows in the on-screen network log. Nothing runs in the background: the app checks for new data only while it is open. Everything downloaded is cached, so the last bulletin and the centers stay readable after signal drops, with their age shown.

## Decisions (2026-10-09)

| # | Decision | Replaces |
| :-- | :-- | :-- |
| D1 | Every member needs a face photo. The photo step has no skip button; "Mamaya na" saves the member as pending and Home reminds until every member has one | Optional photo with "Laktawan" (MVP stretch) |
| D2 | The bagyo phase (Bago, Habang, Pagkatapos) is the app's main mode. Switching it changes the whole UI theme, not only the checklist | Phase as a checklist filter |
| D3 | The phase can switch automatically: from the warnings the user taps, from what they tell the assistant, and (online) from how close the latest PAGASA bulletin puts the bagyo to the household. Code decides; the user can always undo | Manual phase buttons only |
| D4 | The app is hybrid. Online features (bulletin feed, forecast, evacuation centers, cloud guide updates) are MVP stretch; the offline core never depends on them. The release build keeps the INTERNET permission: the AI model is downloaded once from Hugging Face on a Settings tap (owner-approved exception to the one pinned host) | MVP with no INTERNET permission; live data out of scope |
| D5 | A server-side scraper keeps bulletins, hotlines and evacuation centers current and publishes them as signed files on our one host | No scraping; LGU packs only |
| D6 | Household location comes from optional GPS (coarse, one-shot, asked only on tap) or a PSGC area list. It never leaves the phone | No location permission; PSGC list in the Pilot |
| D7 | The mascot character is still being designed. Each phase theme keeps a slot for it; no placeholder art decisions until it is ready | — |
| D8 | Dropped as unnecessary: group photo, "Bilangan" roll call, SMS "Ligtas kami" texts, printable plan and cards, go-bag amounts and "last checked" date, return-home checklist, multiple households, Bisaya synonyms, Cebuano guide, livelihood tags, embedding search, phone-to-phone pack sharing, barangay-shared installs, drill mode, read-aloud, iOS | Earlier catalog |
| D9 | The household gets an optional family account. The profile is cache-first and works with no account; the MVP ships static sign-up, login and forgot-password screens with no backend (nothing leaves the phone, nothing is blocked, the app stays demoable). The real account — sign-in, then profile backup sync while online — is Later, with photos and location never syncing | No account at all (H2) |
| D10 | A household can report storm damage to its LGU (Pilot). Structured fields plus photos, opt-in, cached until signal returns, sent only to the one pinned host. Damage photos are separate from member photos | No damage reporting |
| D11 | New guide content: LPG and gas safety (`gas` hazard), first aid, psychosocial support after a disaster, and damage documentation and assistance. Sources: BFP, DOH, DSWD, NDRRMC | Fire and health topics only |
| D12 | Screen capture protection: Android FLAG_SECURE blocks screenshots, screen recording and the recents preview app-wide, like streaming apps, so member photos cannot be captured. On in release builds; debug builds stay mirrorable for the demo | Screenshots allowed |
| D13 | Later roadmap: one-turn follow-ups in Ask reusing the retrieved passages; voice input through a separate on-device speech-to-text (the LLM is text-only); AI-assisted content drafting with a cloud model (e.g., DeepSeek), always human-reviewed and validated before shipping. Languages stay Tagalog and English | — |

# Main features

## 1. Household and family setup

| Feature | Release | Details |
| :-- | :-- | :-- |
| Works with no account | MVP (core) | The household lives on this phone and nothing is blocked without an account; an account is optional (rows below) |
| Family account: static screens | MVP | Sign-up, login and forgot-password screens render the forms only: no backend, no storage, nothing leaves the phone and nothing is blocked. Judges can walk through them and then use the app without logging in (D9) |
| Family account: real sync | Later | Optional account. The profile is cache-first and syncs to our server only after sign-in while online, and the sync can be turned off in Settings. Photos and location never sync; names and notes sync only after opt-in sign-in |
| Main person first | MVP (core) | Name or nickname, age group, needs, phone number; relation `self`. Their number goes on every member card |
| Per-member details | MVP (core) | Name (required), relation (asawa, anak, magulang, lolo o lola, apo, kapatid, kamag-anak, iba pa), age group (sanggol, bata, teen, adult, senior), needs (buntis, may kapansanan, may maintenance na gamot), note up to 80 characters, optional phone |
| Required face photo | MVP (core) | Every member, the main person included. "Kunan ng litrato" (camera permission asked only on this tap) or "Pumili sa gallery", then the user crops to the face by hand and confirms it is the right person. No skip button. The consent line shows before the camera opens. *Reasoning:* if a member gets separated, a recent face photo is what rescuers and evacuation staff can act on |
| "Mamaya na" and pending reminder | MVP (core) | Saves the member without a photo as pending, for a person who is away, refuses for now, or a phone with a broken camera. Home shows "Kulang pa ang litrato ni {name}" until every member has a photo. Setup counts as done; nothing else is blocked |
| Automatic face check | MVP | On-device face detection confirms exactly one face and suggests the crop. No face or several faces: the manual crop from the row above. Boxes are discarded after cropping |
| "Hinahanap" member card | MVP | Full-screen photo, name, age group, needs, the main person's number and the household's evacuation center, for showing to rescuers or evacuation staff. Works with no signal. Leaves the phone only when the user shares it |
| Pets and home | MVP (core) | Pet count; near a river, near the sea, on a slope, low-lying, light materials or concrete, upper floor available |
| Derived tags and headcount | MVP (core) | Checklists name people, e.g. "Ilagay sa go-bag ang maintenance na gamot ni Lolo Ben"; nobody types a headcount |
| Household location | MVP (core): area list; MVP stretch: GPS | Pick province, municipality and barangay from the PSGC list, or tap "Gamitin ang lokasyon ng telepono" for one coarse GPS reading (permission asked only on that tap, never in the background). Used only on the phone, to measure the bagyo's distance and rank evacuation centers |
| Per-member medicine list | Pilot | Each medicine as its own line with a "nakaimpake na?" tick on the go-bag list. Names only; the app never shows doses |

## 2. Bagyo phases and warnings

The phase is the app's mode. Everything on screen follows it.

| Feature | Release | Details |
| :-- | :-- | :-- |
| Three phases | MVP (core) | "Bago ang bagyo", "Habang may bagyo", "Pagkatapos ng bagyo" as a selector at the top of Home, always one tap away |
| Recommended phase | MVP (core) | The selector highlights the phase that fits the current inputs and says why ("Signal No. 2 ang aktibo"), so the user knows which one to pick even before any automatic switch |
| Phase themes | MVP (core) | Each phase has its own theme across every screen: colors, Home layout and what comes first, illustrations and icons. `before` is calm and focused on preparing; `during` is high-contrast and stripped to essentials (warnings, "Gawin ngayon", hotlines, Ask); `after` is about recovery and checking the house. Each theme has a dark variant and must keep large-text and contrast rules |
| Mascot slot | MVP stretch | The character is still in development. Each theme reserves a slot for it; art and behavior are added when the design is final |
| Automatic phase switch | MVP (core): warnings and Ask; MVP stretch: bulletin distance | Code (`decidePhase`) switches the phase from three inputs: the warnings the user tapped, phase cues in what they ask (section 3), and, when a cached bulletin exists, the bagyo's distance from the household now and along its forecast track. A banner shows "Lumipat sa {phase}." with "Ibalik" (undo) |
| Phase switch rules | MVP (core) | Automatic switches only move toward caution: to `during` (an active warning, the user saying the storm is here, or the bagyo inside the near band or a signal raised for the household's area) and to `before` (a new bagyo whose forecast track comes inside the approach band while the app is in `after`). Moving to `after` is always the user's tap; Home recommends it when the user says the storm has passed or the bulletin shows the bagyo has left. After an undo or a manual pick, the same input never switches again; a new warning, cue or bulletin can. When inputs disagree, the more cautious phase wins |
| Phase thresholds | MVP (core) | `phase_rules.json` holds the warning-to-phase rule (our product rule: any active warning means `during`), the approach and near distance bands, and the evacuation-center threshold. The bands and threshold need a cited source and reviewer, never numbers in code. Until then they are marked placeholders, distance-based switching stays off, and only warnings and the user's own words drive the switch |
| Warning picker ("Ano ang narinig mo?") | MVP (core) | Wind signal 1 to 5, rainfall (yellow, orange, red), storm surge (yellow, orange, red), gale (on or off); several can be active at once |
| Barangay evacuation order | MVP | "Pinapalikas na kami ng barangay" as its own choice. The evacuate group comes first and "Gawin ngayon" leads with leaving. Wording only from a reviewed source |
| Warning cards without the model | MVP (core) | Official meaning from the cited source; a signal describes wind, not rain, and floods can come at any level. Unconfirmed thresholds show "(i-check sa PAGASA)" |
| Active warnings and their age | MVP (core) | Chips on Home with the time set ("Signal No. 3 · 2 oras na"); tap to open or clear |
| Stale-warning prompt | MVP (core) | After 3 hours, per warning: "Makinig muli sa radyo. Baka nagbago na ang signal." with "Pareho pa rin" to keep it and reset its age. Never predicts wind arrival time |
| Undo after "Pagkatapos" | MVP | Moving to `after` clears every warning; "Ibalik ang mga babala" stays for a few seconds |

## 3. Ask in Taglish (the offline assistant)

The heart of the app: a localized assistant that runs on the phone with no internet. Llama 3.2 1B rewords matched guide passages for this household; it never answers from its own knowledge, and there is no cloud model.

| Feature | Release | Details |
| :-- | :-- | :-- |
| Works with no signal | MVP (core) | Search, routing, the verifier and the model all run on the phone. Airplane mode changes nothing |
| Summary first | MVP (core) | Vetted one-sentence summary of the best passage in under a second |
| AI answer second | MVP (core) | 2 to 4 short Tagalog sentences fitted to the household and the current phase, streamed, grounded only in retrieved passages |
| Phase-aware answers | MVP (core) | The current phase and active warnings boost matching passages and go into the prompt's context line, so "ano ang gagawin namin?" answers differently before, during and after |
| Changes the phase for the user | MVP (core) | The router (code) spots phase cues in the question ("Signal 3 na dito", "lumalakas na ang hangin", "humupa na ang bagyo"). With AI on, the model also returns a `phase_hint` from a fixed list. `decidePhase` accepts a hint only when the user's words, the warnings or the bulletin back it. It then switches the phase and theme with the undo banner, or, for `after`, recommends it for one tap (section 2) |
| Phase from bulletin distance | MVP stretch | When a cached bulletin puts the bagyo inside the near band, or a new bagyo's track inside the approach band, the phase switches on the next app open or question, even if the user never asked |
| "Saan galing ito?" | MVP (core) | Full passage with agency, document and date |
| Closing line | MVP (core) | Code appends "Sundin ang utos ng barangay at ng mga awtoridad." to every answer |
| Refusal with topic buttons | MVP (core) | "Wala ito sa gabay." plus the closest topics; the model is not called |
| Taglish synonyms and tag boosts | MVP (core) | MiniSearch BM25+ with Tagalog verb forms and English terms |
| One follow-up turn | Later | A single clarifying turn ("bakit?", "paano kung wala kaming sasakyan?") that reuses the same retrieved passages, so it stays grounded, gated and verified like any answer (D13) |
| Voice input | Later | On-device speech-to-text turns a spoken question into text before the router runs. A separate recognizer, never the LLM: Llama 3.2 1B is text-only (D13) |

# Other features

## 4. Hotlines and family contacts

One simple screen for every number the family may need.

| Feature | Release | Details |
| :-- | :-- | :-- |
| Hotlines screen | MVP (core) | National hotlines from `hotlines.json`, each with a call button that opens the dialer. Rendered from data, never from the model; each carries a source and a verified date |
| Family contacts and meeting place | MVP | Up to 5 emergency contacts, the meeting place and the household's evacuation center, on the same screen |
| Updated hotlines | MVP stretch | New or changed national hotlines arrive through the feed (section 10) after review; the screen shows the verified date |
| LGU hotlines | Pilot | From the LGU pack |

## 5. Checklists

Recommended by phase first, then fitted to the household and active warnings.

| Feature | Release | Details |
| :-- | :-- | :-- |
| Checklist per phase | MVP (core) | `before`: go-bag and home preparation. `during`: what to do now, evacuation. `after`: house check, electrical safety, generators and candles, safe water, avoiding floodwater |
| "Gawin ngayon" | MVP (core) | Top items for this household in the current phase and warnings, then the full list |
| Household-fitted | MVP (core) | Filtered by phase, active warnings and profile tags; no model needed |
| Go-bag ticks and progress | MVP (core) | Ticks saved per household, survive restarts; progress bar; reset for a new season |

## 6. Safety (enforced in code)

| Feature | Release | Details |
| :-- | :-- | :-- |
| Emergency intent | MVP (core) | "lumulubog", "may naipit", "hindi makahinga" show the emergency card first: higher ground, barangay and hotlines from stored data |
| Live-data intent | MVP (core) | "Nasaan na ang bagyo?", "may pasok ba?": the model is never called. With a cached bulletin, its card shows with its age and "Makinig pa rin sa radyo"; without one, "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Medicine-dose intent | MVP (core) | Points to the health center or hotlines, without the model |
| Family-plan intent | MVP | Evacuation center and contacts answered from data, never from the model |
| Verifier | MVP (core) | Checks citations, numbers and phone-like strings; a failing AI answer is replaced by the vetted summary |
| Critical-passage pinning | MVP (core) | Vetted summary always above AI text on critical topics |
| Phase hint check | MVP (core) | The model's `phase_hint` is only a suggestion; code accepts or drops it (section 3) |
| Health pointers | MVP | Floodwater wound or fever questions get the guide's leptospirosis warning signs and a pointer to the health center |
| Bulletins stay out of the model | MVP stretch | Bulletin text and numbers are rendered from data; the model never sees or restates them |

## 7. Evacuation and bagyo forecast

| Feature | Release | Details |
| :-- | :-- | :-- |
| Household evacuation center | MVP (core) | Typed in at setup; shown on Home in `during`, on the hotlines screen and on member cards |
| Latest PAGASA bulletin card | MVP stretch | When the phone is online it fetches the latest bulletin from our server and caches it. The card shows the bagyo's name, category, position, movement, the wind signal areas, the issued time ("Inilabas ng PAGASA: {time}") and the fetched time, plus the source link. Rendered from data; never computes an arrival time |
| Bagyo around the household | MVP stretch | The phone measures the distance and direction from the household location to the bagyo's current and forecast positions, on the phone. Shown as a simple track view without map tiles: home, the bagyo, its forecast points and the distance |
| Recommended evacuation centers | MVP stretch | Nearby centers ranked by distance from the household, from the feed. Shown first when the bulletin's category or the household's signal crosses the threshold in `phase_rules.json` (a placeholder until sourced). "Ang barangay ang magsasabi kung kailan lilikas." stays above the list: the app recommends where, never orders when |
| Offline after download | MVP stretch | Bulletin, forecast and centers stay readable from the cache with no signal. After 3 hours from the issued time, the stale prompt shows |
| LGU-verified centers | Pilot | The LGU pack replaces scraped centers with the LGU's own list |
| Document the damage | MVP stretch | `after` guide topics on what to photograph, what not to touch, and what to report to the barangay; passages only, with sources (DSWD, NDRRMC) |
| Damage report to the LGU | Pilot | Opt-in `DamageReporter`: the household fills structured fields (what was damaged, how badly) and attaches damage photos — separate from member photos — then taps send. The report is cached until signal returns and sent only to the one pinned host; the LGU sees it in the Bantay portal. Photos leave the phone only on the user's send tap (D10) |

## 8. Guide content

| Feature | Release | Details |
| :-- | :-- | :-- |
| Built-in official guide | MVP (core) | 120 passages in the MVP (about 300 planned) from PAGASA, NDRRMC and OCD, DOH, PHIVOLCS, BFP; ships inside the app so it works offline. The 30 demo-critical passages are written and reviewed first |
| Gas, first aid, psychosocial and damage topics | MVP (core, content); damage topics MVP stretch | `gas_safety` (LPG leaks, storing gas, after a flood; BFP), `first_aid` and `psychosocial` (DOH) join the MVP passages. `damage_report` and `assistance` (documenting damage, DSWD assistance; DSWD, NDRRMC) join with the online stretch. Tagged with the `gas` and `health` hazards (D11) |
| Traceable passages | MVP (core) | Source (agency, title, date, URL), reviewer and review date on each; the content build fails without them |
| Browse by topic and phase | MVP | Topic groups, filtered by the current phase, without the model |
| Cloud guide updates | MVP stretch | New and corrected passages arrive as signed packs from our server; the bundled guide stays as the offline fallback. Only reviewed passages ship |
| Scraped source watch | Pilot | The scraper flags new or changed official documents for writers. A flagged document never becomes a passage until a person writes and reviews it |
| LGU DRRMO review | Pilot | |
| Passage feedback | Later | A "may mali dito?" flag on a passage or answer, cached locally and sent only with the opt-in topic report, so content errors reach the writers. Light, not needed for the MVP |

## 9. Power, devices and accessibility

| Feature | Release | Details |
| :-- | :-- | :-- |
| Offline core | MVP (core) | Every main feature works in airplane mode. The release build keeps the INTERNET permission, but the network is used only on a user action, only while the app is open, and every request shows in the network log |
| Low-battery mode | MVP (core) | Below 15% or battery saver on: model off; checklists, cards, search and summaries keep working |
| Manual low-battery switch | MVP (core) | Settings and Home toggle that turns low-battery mode on right away |
| Device tiers | MVP (core) | `none` tier skips the model and loses only the AI wording |
| AI on or off | MVP (core) | |
| Download the model in Settings | MVP | "I-download ang AI (0.81 GB)" downloads the GGUF once from Hugging Face, only on that tap, never in the background. Size and SHA-256 must match or the file is deleted. The request shows in the network log. Until it succeeds, AI is unavailable and answers use vetted summaries. On a `none` tier phone only the tier message shows |
| Install the model from a file | MVP | "Mula sa file sa telepono": pick the GGUF from storage; size and SHA-256 checked before use. No network needed |
| Model load and unload | MVP | Loads when Ask opens and AI is allowed; unloads after 2 minutes idle, in the background, or when AI stops being allowed. One retry per session, then summaries |
| Large text, icons, dark variants | MVP | Applies to every phase theme |
| Screen capture blocked | MVP | Android FLAG_SECURE on the whole app, like streaming apps: screenshots, screen recording and the recents preview are blacked out, so member photos and cards cannot be captured. Release builds only; debug builds stay mirrorable for the demo (D12) |
| Offline light and SOS screen | MVP stretch | Full-screen white light and a large "TULONG" screen to signal rescuers. Screen only; no camera or flash permission |
| Model from Google Play AI pack | Pilot | May replace the Hugging Face download and file install for most users |

## 10. Updates, scraper and LGU packs

| Feature | Release | Details |
| :-- | :-- | :-- |
| Bagyo scraper | MVP stretch | A scheduled job on our server reads PAGASA's public tropical cyclone bulletins and warnings, parses the fields the app shows, keeps the verbatim text, source URL and issued time, and publishes a signed feed file. A parse failure keeps the previous feed and marks it stale; the scraper never guesses a field. Confirm PAGASA's terms and ask for a data feed before the Pilot |
| Hotline and evacuation-center scraping | MVP stretch | The scraper collects public hotline and evacuation-center lists into a review queue. Nothing reaches phones until a reviewer approves it (structured facts need a source, reviewer and date) |
| Feed sync on the phone | MVP stretch | On app open and pull to refresh, when online: fetch the small signed feed from the one pinned host, check the signature, cache it. Works on mobile data because the file is small. Can be turned off in Settings. No background fetch, no push |
| Smart Update for packs | MVP stretch | Guide packs: asks first, Wi-Fi by default, signed, from the same host. The model is not part of it (see "Download the model in Settings") |
| Network log | MVP (model download), MVP stretch (feed and packs) | Every request with time, URL and size, on screen |
| Import a signed pack from a file | MVP stretch | Offline path for the same packs |
| LGU pack (Bantay tier) | Pilot | Local evacuation centers, hotlines and advisories; paid by the LGU ([BMC.md](BMC.md)) |
| Opt-in topic reports and DRRM dashboard | Pilot | Off by default; topic counts only, never household data or location |

## 11. About, settings and evaluation

| Feature | Release | Details |
| :-- | :-- | :-- |
| About screen | MVP (core) | Guide date, sources, reviewers, "Built with Llama"; feed fetched time and network log once online |
| Preparedness-aid notice | MVP (core) | The app is a preparedness aid, not an emergency service or a forecast |
| Settings | MVP | AI on or off, low-battery switch, household location, clear question history; feed on or off and update settings with the online stretch |
| On-phone evaluation screen | MVP (core, demo tool) | Retrieval, refusal, faithfulness, phase-switch and latency numbers on this phone. Shown to judges |

## 12. Privacy guarantees

- The household profile, member names, notes, photos and location never enter the model prompt, packs, topic reports or logs, and never leave the phone by default. With the optional family account (Later), the profile syncs to our server only after the user signs in while online, and only when the sync is on in Settings; photos and location never sync. The MVP ships static sign-up, login and forgot-password screens with no backend, so nothing leaves the phone in the MVP.
- The bulletin feed is the same file for everyone. Evacuation centers come in province bundles, so a request reveals at most the province, never the household or its exact location. Distances are worked out on the phone.
- Photos are re-encoded without EXIF, stored in app-private storage and excluded from cloud backup. They leave the phone only when the user shares a member card or attaches damage photos to a report sent to the LGU (Pilot). Screenshots and screen recording of the app are blocked by Android FLAG_SECURE (D12).
- Face detection only, never recognition: boxes crop the photo and are discarded. The model is text-only.
- Location: coarse GPS, one reading per tap, never in the background; or a PSGC area picked from a list.
- No analytics SDKs, no background services. The account is optional and the app works fully without it.

## 13. Out of scope

Not planned in any release, because they break the offline, privacy or safety rules: a cloud chatbot or cloud model, sending location or household data to a server outside the signed-in account sync, background location, push alerts, background sync, face recognition, ads, map tiles, and predicting when the bagyo arrives. Languages beyond Tagalog and English stay dropped for the MVP (D8).
