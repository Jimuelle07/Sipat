# Solution: Bagyo Buddy

Bagyo Buddy turns the warning a family hears on the radio into steps fitted to their household. It answers their Taglish questions only from official guides that ship inside the app, and it works with no signal.

Related: [README.md](README.md) (shared names) · [features.md](features.md) (feature source of truth) · [problem.md](problem.md) · [system-design.md](system-design.md) · [api-layer.md](api-layer.md) · [BMC.md](BMC.md)

## 1. One-liner and pitch

**One-liner.** Tap the warning you heard on the radio and see what your household should do now, even with no signal.

**30-second pitch.** When a typhoon takes out power and signal, the guidance a family needs is online or buried in a long PDF. Bagyo Buddy puts it on the phone. The family sets up a profile once: who is at home, what kind of house it is, and whether a river or the sea is close. During the storm they tap the warning they heard (wind signal, rainfall, storm surge or gale) and get a checklist for their household. They can ask "kailangan na ba naming lumikas kung malapit kami sa ilog?" and get a short answer drawn only from PAGASA, NDRRMC, OCD and DOH guidance, with the source one tap away. A small model on the phone puts the answer in plain words. When the battery runs low, the app keeps working without it. Alerts tell you a storm is coming. Bagyo Buddy tells your household what to do, even with no signal.

## 2. Design principles

These seven rules hold in every release. When a feature conflicts with one, the rule wins.

| # | Principle | What it means in practice |
| :-- | :-- | :-- |
| 1 | Offline core, online extras | Setup, phases and themes, warnings, checklists, hotlines, the guide and Ask all work in airplane mode and never wait on the network. The online extras (bulletin feed, forecast, recommended evacuation centers, guide and hotline updates) are MVP stretch: fetched only while the app is open, from one host (our server), then read from the cache with their age shown. Until the stretch lands, the release build has no INTERNET permission ([features.md, hybrid](features.md#how-to-read-this)). |
| 2 | The guide is the product; the model only rephrases it | The model reads only the one or two passages that search found. It never answers from its own memory. If search finds no good passage, the model is never called. |
| 3 | Safety is enforced by code | Emergency words, live-data questions, medicine doses, numbers, phone numbers, phase switches and the closing line are handled by code rules, not by the prompt. |
| 4 | Every answer shows its source | "Saan galing ito?" opens the passage with its agency, document and date. A bulletin card shows PAGASA's issued time and source link. |
| 5 | Useful without AI | Checklists, warning cards, phase switching from warnings, guide search and vetted summaries all work with the model off: in low-battery mode, on phones too small for it, or when the user turns it off. |
| 6 | The household never leaves the phone by default | No mandatory account, no analytics, no background services. Member photos and the household location stay on the phone; GPS is optional, coarse and one-shot, asked only on tap. The feed is the same file for everyone. The optional family account (Later) backs up the profile only after sign-in while online; photos and location never sync. |
| 7 | Honest about limits | The app never predicts when the bagyo arrives, makes no forecasts of its own and dispatches no rescue. When online it shows PAGASA's latest bulletin verbatim with its age and "Makinig pa rin sa radyo"; offline it says it has no live data. It recommends where to evacuate; the barangay decides when. |

## 3. How the family uses it

The app has three phases, Bago, Habang and Pagkatapos ng bagyo, and the phase is the app's mode: each has its own theme and Home layout. Setup takes a few minutes on a calm day. Everything in the core works with no signal; the online moment below is an extra (MVP stretch). Feature details and release tags are in [features.md](features.md).

### Setup (once, before the storm)

1. **Install.** Get the app from Google Play. The guide ships inside the app. The model is an optional pack: a sideloaded file for the hackathon and a Google Play AI pack later ([Play for On-device AI](https://developer.android.com/google/play/on-device-ai)). Phones in the `none` tier skip the model and lose only the AI wording.
2. **Set up the family, starting with the main person.** There is no sign-up and no password; everything stays on this phone.
   - **The main person first.** Name or nickname, age group, needs, phone number. Their relation is "self", and their number goes on every member's card.
   - **Then each member, one at a time.** Name or nickname (required), relation (asawa, anak, magulang, lolo o lola, apo, kapatid, kamag-anak, iba pa), age group (sanggol, bata, teen, adult, senior), needs (buntis, may kapansanan, may maintenance na gamot), an optional note of up to 80 characters such as medicine names or allergies, and an optional phone number.
   - **A face photo for every member, the main person included (MVP (core)).** The consent line shows first. "Kunan ng litrato" opens the camera and asks for camera permission only at that moment; "Pumili sa gallery" uses the phone's own photo picker. There is no skip button. On-device face detection (MVP) checks there is exactly one face and crops to it; with no face or several faces, the user crops by hand and confirms it is the right person. If a member is away, refuses for now, or the camera is broken, **"Mamaya na"** saves them as pending. Home then shows "Kulang pa ang litrato ni {name}" until every member has a photo; nothing else is blocked. *Reasoning:* if someone gets separated, a recent face photo is what rescuers and evacuation staff can act on.
   - **Pets and home.** Pet count; home near a river, near the sea, on a slope, low-lying, light materials or concrete, upper floor available.
   - The household's tags and headcount come from the members, so the checklist says "Ilagay sa go-bag ang maintenance na gamot ni Lolo Ben" instead of a generic line.
3. **Household location.** Pick province, municipality and barangay from the PSGC list (MVP (core)), or tap "Gamitin ang lokasyon ng telepono" for one coarse GPS reading (MVP stretch; permission asked only on that tap, never in the background). It stays on the phone and is used only to measure the bagyo's distance and rank evacuation centers.
4. **Family plan and hotlines.** Type in the household's evacuation center (MVP (core)), a meeting place and up to 5 emergency contacts (MVP). They sit on the Hotlines screen next to the national hotlines.
5. **Go-bag checklist.** In `before`, Home leads with the go-bag list fitted to the household, and the family ticks items as they pack, with a progress bar.
6. **Family account (optional, static in the MVP).** The Account screen holds sign-up, login and forgot-password. In the MVP these are static screens with no backend: nothing is stored, nothing leaves the phone and nothing is blocked, so the app is fully usable without them. The real account is Later: sign in once, and the profile backs up to our server when the phone is online, with the sync toggleable in Settings. Photos and location never sync.

### Choosing the phase

- **The selector.** "Bago ang bagyo", "Habang may bagyo" and "Pagkatapos ng bagyo" sit at the top of Home, always one tap away. The selector highlights the recommended phase and says why ("Signal No. 2 ang aktibo").
- **Themes.** `before` is calm and focused on preparing; `during` is high-contrast and stripped to essentials (warnings, "Gawin ngayon", hotlines, Ask); `after` is about recovery and checking the house. Each has a dark variant and a reserved slot for the mascot, which is still being designed.
- **Automatic switching.** Code (`decidePhase`) switches the phase from the warnings the user taps and the phase cues in what they ask (MVP (core)), and, with a cached bulletin, from how close the bagyo is to the household (MVP stretch). A banner shows "Lumipat sa {phase}." with "Ibalik" (undo).
- **Only toward caution.** Automatic switches go to `during` or, when a new bagyo approaches while in `after`, back to `before`. `after` is always the user's tap. After an undo or a manual pick, the same input never switches again; a new warning, cue or bulletin can. When inputs disagree, the more cautious phase wins. The exact rules are in [features.md, section 2](features.md#2-bagyo-phases-and-warnings). Distance switching stays off until the bands in `phase_rules.json` have a cited source and a reviewer.

### During the storm

1. The parent hears on the radio: "Signal No. 3 sa inyong lugar," and maybe an orange rainfall warning. They open **"Ano ang narinig mo?"** and tap what they heard. More than one warning can be active. Tapping a warning while in `before` switches the app to `during` and its theme, with "Ibalik" on the banner.

   | Warning | Levels | What the card says | Source |
   | :-- | :-- | :-- | :-- |
   | Wind signal | 1 to 5 | Wind range and lead time, from 39 to 61 km/h within 36 hours (Signal 1) to 185 km/h or more within 12 hours (Signal 5) | [PAGASA](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) |
   | Rainfall | yellow, orange, red | 7.5 to 15, 15 to 30, and over 30 mm of rain in an hour; it goes from "flooding possible" to "evacuate" | [Varsitarian](https://varsitarian.net/sci-tech/20250724/explainer-how-do-pagasas-rainfall-warnings-and-weather-advisories-work), [Inquirer](https://newsinfo.inquirer.net/654913/pagasas-color-coded-warnings/amp); confirm with PAGASA |
   | Storm surge | yellow, orange, red | Recent bulletins: about 1 to 2 m, 2.1 to 3 m, and above 3 m. **Unverified**: the bands have changed since 2015, so confirm with PAGASA | [ABS-CBN](https://www.abs-cbn.com/news/2024/11/15/storm-surge-warning-up-in-areas-on-typhoon-pepito-s-path-2110) |
   | Gale | on or off | What the gale warning means for boats at sea | Passage still to be written from PAGASA |

2. **Warning card, no model.** For Signal 3, the card shows PAGASA's meaning: winds of 89 to 117 km/h expected within 18 hours. It also says plainly that a signal describes wind, not rain, and that floods can come at any signal level.
3. **"Gawin ngayon."** The `during` Home shows the top items for this household right now, then the full checklist. For example: secure the roof and windows, charge power banks, prepare the infant's milk and diapers, move the senior's medicines into the go-bag, and be ready to leave when the barangay says. The household's evacuation center is on Home.
4. **Ask in Taglish:** "kailangan na ba naming lumikas kung malapit kami sa ilog?"
   - In under a second, the vetted one-sentence summary of the best-matching passage appears.
   - The AI answer then streams in below it: 2 to 4 short Tagalog sentences, fitted to the household and the current phase.
   - **"Saan galing ito?"** opens the full passage with its agency, document and date.
   - Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad."
   - A phase cue such as "Signal 3 na dito" or "lumalakas na ang hangin" switches the app to `during` with the undo banner, even if the user never touched the selector.
5. **Emergency words.** Words like "lumulubog", "may naipit" or "hindi makahinga" show the emergency card first: move to higher ground, and call the barangay or an emergency hotline from the stored list. The answer follows.
6. **Hotlines.** One screen holds the national hotlines with call buttons, the family contacts, the meeting place and the evacuation center.
7. **Someone is missing.** Their "Hinahanap" card (MVP) shows the photo, name, age group, needs, the main person's number and the household's evacuation center, full screen, ready to show rescuers or evacuation staff with no signal.
8. **Stale warning.** Three hours after a warning is set, the app shows "Makinig muli sa radyo. Baka nagbago na ang signal." It never says when the wind will arrive, because PAGASA's lead times count from the bulletin, not from the tap.

### The online moment (MVP stretch)

When the phone gets signal and the app is open, it fetches the small signed feed from our server and caches it. Nothing runs in the background.

1. **Bulletin card.** The latest PAGASA bulletin shows verbatim: the bagyo's name, category, position, movement and wind signal areas, "Inilabas ng PAGASA: {time}", the fetched time and the source link, with "Makinig pa rin sa radyo". Three hours after the issued time it shows the stale prompt. The model never sees or restates it.
2. **Track view.** A simple view without map tiles shows home, the bagyo, its forecast points and the distance, all worked out on the phone. It never computes an arrival time.
3. **Recommended evacuation centers.** Nearby centers ranked by distance from the household, shown first when the bulletin crosses the threshold in `phase_rules.json` (a placeholder until sourced). "Ang barangay ang magsasabi kung kailan lilikas." stays above the list.
4. **Phase from the bulletin.** If the bagyo is inside the near band, or PAGASA raises a signal for the household's area, the app switches to `during` on the next open or question, with the undo banner.
5. After signal drops, the bulletin, track and centers stay readable from the cache with their age shown.

### After the storm

1. **The user taps "Pagkatapos ng bagyo".** The app never switches to `after` by itself. Home recommends it (highlight and reason) when the user says "humupa na ang bagyo" or the bulletin shows the bagyo has left. Moving to `after` clears the active warnings; "Ibalik ang mga babala" stays for a few seconds.
2. **Post-storm checklist.** Check the house, check electrical safety before turning the power back on, use generators and candles safely, find safe drinking water and stay out of floodwater.
3. Ask questions like "pwede bang inumin ang tubig sa gripo?" or "paano linisin ang bahay na binaha?" Answers come only from the guide. A question about a wound or fever after wading in floodwater gets the guide's leptospirosis warning signs and a pointer to the health center. A question about medicine doses goes straight to the health center.
4. The power is out and the battery is low. Below 15%, or whenever the phone's battery saver is on, the model stays off. Checklists, warning cards, guide search and summaries keep working.
5. **Document the damage.** Ask "ano ang kailangan para sa ayuda?" or open the guide's damage topics: what to photograph, what not to touch, what the barangay needs for its report, and how DSWD assistance works (MVP stretch content). In the Pilot, the household can attach damage photos and send the report to its LGU; it waits in the cache until signal returns.

## 4. Screens

| Screen | What it holds | Release |
| :-- | :-- | :-- |
| Home | Phase selector (Bago, Habang, Pagkatapos) with the recommended phase and its reason; the phase theme and layout; "Lumipat sa {phase}." banner with "Ibalik"; "Ano ang narinig mo?" picker; active warnings and their age; "Kulang pa ang litrato ni {name}" reminder; evacuation center in `during` | MVP (core) |
| Family setup | The main person's details, then each member; pets, home; household location (PSGC list; GPS button in MVP stretch) | MVP (core) |
| Member editor | Name, relation, age group, needs, note, phone; required photo: consent line, "Kunan ng litrato", "Pumili sa gallery", "Mamaya na", crop preview | MVP (core); face check: MVP |
| "Hinahanap" card | Full-screen photo, name, age group, needs, main person's number, evacuation center | MVP |
| Hotlines | National hotlines with call buttons; family contacts, meeting place, evacuation center | MVP (core); contacts and meeting place: MVP; updated hotlines: MVP stretch |
| Checklist | Phase checklist, warning cards, "Gawin ngayon", go-bag ticks, progress, reset | MVP (core) |
| Ask | Question box, instant summary, streamed AI answer, "Saan galing ito?", topic buttons on refusal, emergency card, bulletin card on live-data questions (MVP stretch) | MVP (core) |
| Account | Static sign-up, login and forgot-password forms (demo only, no backend). Later: real sign-in and the profile backup toggle | MVP (static); sync Later |
| Damage report | Structured fields and damage photos, cached until signal, sent to the LGU (Pilot) | Pilot |
| Evacuation and bagyo | Latest bulletin card, track view, recommended evacuation centers with "Ang barangay ang magsasabi kung kailan lilikas." | MVP stretch |
| Guide topics | Browse passages by topic group, filtered by phase, without the model | MVP |
| Settings | AI on or off, low-battery switch, household location, clear question history; feed on or off and update settings (MVP stretch); topic-sharing opt-in (Pilot) | MVP |
| About | Guide date, sources, reviewers, "Built with Llama", preparedness-aid notice; feed fetched time and network log (MVP stretch) | MVP (core) |
| Evaluation | Retrieval, refusal, faithfulness, phase-switch and latency numbers on this phone | MVP (core, demo tool) |

## 5. Features by release

The full catalog, with every row's release tag and details, is in [features.md](features.md). It is the source of truth; where this file disagrees, features.md wins. In short:

| Release | What it covers |
| :-- | :-- |
| MVP (core) | Household setup with a required face photo per member and "Mamaya na"; PSGC household location; three phases with full themes; automatic phase switching from warnings and Ask cues, with undo; warning picker and cards; stale-warning prompt; Ask in Taglish (summary first, AI second, phase-aware, sources, refusal); safety router and verifier; phase checklists, "Gawin ngayon", go-bag ticks; Hotlines screen; typed-in evacuation center; 120 reviewed passages (gas safety, first aid and psychosocial included); low-battery mode and device tiers; About and the evaluation screen; no INTERNET permission until the online stretch lands |
| MVP | Face check and crop; "Hinahanap" card; family contacts and meeting place; barangay evacuation order; health pointers; browse by topic; model install from a file and load/unload; large text and dark variants; FLAG_SECURE screen capture protection (release builds); static sign-up, login and forgot-password screens (no backend); Settings |
| MVP stretch | Online: bulletin feed and card, track view, phase from bulletin distance, recommended evacuation centers, scraper with hotline and center review queue, updated hotlines, cloud guide updates (Smart Update), network log, optional GPS. Offline: mascot slot, offline light and SOS screen, import a signed pack from a file. Content: damage documentation and assistance topics |
| Pilot | LGU pack (Bantay tier) with LGU hotlines and verified centers, scraped source watch, LGU DRRMO review, per-member medicine list, Google Play AI pack, opt-in topic reports and the DRRM dashboard, damage reports to the LGU |
| Later | The real optional family account (sign-in, profile backup sync while online, toggle in Settings), one-turn follow-ups in Ask, voice input through on-device speech-to-text, AI-assisted content drafting with a reviewed cloud model |

## 6. What makes it different

| Option | What it does well | What Bagyo Buddy adds |
| :-- | :-- | :-- |
| Cell-broadcast alerts ([RA 10639](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)) | Free alerts to every phone in the area | What this household should do next, even after the tower goes down |
| PAGASA bulletins | The official forecast and warnings | Turns the warning the family heard into steps for their household; when online, shows the latest bulletin verbatim with the bagyo's distance from home and the nearest evacuation centers, then keeps it readable offline |
| PDF and printed guides | Official and complete | Search in your own Taglish words; two to four sentences instead of pages |
| Online AI chatbots | Conversational | Works offline on the phone, answers only from official text, shows the source |

Offline preparedness guides and PAGASA bulletins already exist. The new part is asking in your own Taglish words and getting an answer fitted to your household, without signal, in an app whose whole mode follows the storm's phase. Pitch it as that, not as a forecasting tool: the app shows PAGASA's bulletin but never forecasts or predicts arrival. The evidence and the full comparison are in [problem.md](problem.md).

## 7. The guide content

The guide is the product's real asset (catalog rows in [features.md, section 8](features.md#8-guide-content)): about 300 short, tagged passages rewritten from official Philippine sources, each traceable to its origin. The MVP ships the 120 most demo-critical passages and says so. Writing them well matters more than any prompt.

### What it covers

| Topic group | Example passages | Main source to draw from |
| :-- | :-- | :-- |
| Wind signals 1 to 5 | Meaning, wind range, lead time, what to do at each | [PAGASA wind signal page](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) |
| Rainfall, storm surge and gale warnings | What yellow, orange and red mean; why a low signal can still flood | PAGASA (thresholds to confirm) |
| Before: the home and the go-bag | Securing roofs, storing water, documents in plastic | NDRRMC and OCD public advisories |
| Evacuation | When and how, what to bring, people with special needs | NDRRMC and local DRRM office guidance |
| Floods, storm surge, landslides | Warning signs, moving to higher ground | PAGASA, NDRRMC, PHIVOLCS |
| Infants, seniors, pregnancy, disability, pets | Specific items and precautions | DOH and NDRRMC advisories |
| After: water, food, electricity, cleanup | Safe water, spoiled food, electrical checks before the power comes back | DOH; electric cooperatives and DOE (sources still to collect) |
| Generators and candles | Carbon monoxide and fire risk during outages | BFP and DOH (sources still to collect) |
| LPG and gas safety | Checking connections before the storm, storing LPG, gas after a flood | BFP, DOE and LPG suppliers (sources still to collect) |
| First aid basics | Cuts, sprains, choking, when to call for help | DOH advisories (sources still to collect) |
| Psychosocial support | Stress after a disaster, children and elders, where to ask for help | DOH advisories (sources still to collect) |
| Documenting damage and assistance | What to photograph and report to the barangay, DSWD assistance | DSWD and NDRRMC advisories (sources still to collect) |
| Health after floods | Wounds, leptospirosis warning signs, when to seek care | DOH advisories |

*Reasoning:* the specific NDRRMC, OCD, DOH, BFP and DOE documents have not been pulled yet. Collecting them is a task for the first build hours. Each document's agency, title, date and URL goes in `sources.json`.

### How each passage is shaped

- 60 to 120 words on one topic, in plain Tagalog with the English term in parentheses where people use it ("storm surge"). *Reasoning:* v1 allowed up to 150 words; a lower ceiling keeps prompts short on budget phones.
- `summary`: one human-written sentence that tells the reader what to do. It is the first thing the user sees, the fallback answer, and the pinned line on critical passages.
- `critical`: true for evacuation decisions, electricity, floodwater, generators and medicine.
- Tags: phase, warnings, profile tags, hazards and topic group.
- Source: `source_id` points into `sources.json` (agency, title, date, URL), and `locator` gives the page or section.
- Review: `reviewed_by` and `reviewed_at`. The content build fails without them.
- `version`: goes up when the text changes, so updates ship only changed passages.

### Example passage

The exact schema is in [api-layer.md](api-layer.md).

```json
{
  "id": "during-flood-river-01",
  "lang": "tl",
  "title": "Kung malapit ang bahay sa ilog o sapa",
  "topic": "evacuation",
  "phase": ["during"],
  "warnings": { "tcws": [2, 3, 4, 5], "rainfall": ["orange", "red"], "surge": [], "gale": false },
  "profile_tags": ["near_river"],
  "hazards": ["flood"],
  "critical": true,
  "text": "Kung malapit ang bahay sa ilog o sapa, bantayan ang pagtaas ng tubig... Sundin agad ang utos ng barangay na lumikas...",
  "summary": "Kung malapit sa ilog, maghanda nang lumikas at sumunod agad sa utos ng barangay.",
  "source_id": "(fill in)",
  "locator": "(fill in)",
  "reviewed_by": "(fill in)",
  "reviewed_at": "(fill in)",
  "version": 1
}
```

The text above is a placeholder that shows the shape only. Write the real wording from the official source.

### Can we reuse government material?

Under the Intellectual Property Code, no copyright subsists in works of the Philippine government, but exploiting them for profit needs prior approval from the agency that made them ([RA 8293, Sec. 176, via ndvlaw](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)). The free household app credits every agency on the About screen and in each passage's source. Get each agency's approval before selling the paid Bantay LGU license. *Reasoning:* we are not lawyers; confirm before any commercial launch.

### How content is collected and reviewed

1. **Collect.** List each official document in `sources.json` before writing from it. From the Pilot, the scraper's source watch flags new or changed official documents for writers; a flagged document never becomes a passage until a person writes and reviews it.
2. **Write.** Rewrite it into passages. Never write a number from memory: every number must appear in the source.
   - **AI-assisted drafting (Later).** A cloud model (for example DeepSeek) may draft passages, summaries, synonyms and evaluation questions from the listed sources. This is a content-tool feature, not a runtime one: drafts must pass the same review and validation as hand-written text before they ship. The on-device model never changes. The MVP hand-writes everything, since the core product comes first.
3. **Tag and summarize.** Add tags, the one-sentence summary and the `critical` flag.
4. **Review passages.** A second teammate checks each passage against its source and fills in `reviewed_by` and `reviewed_at` (MVP). In the Pilot, the LGU's DRRMO also reviews the core guide and owns its local pack.
5. **Review hotlines and evacuation centers.** Hotlines and centers collected by the scraper land in a review queue (MVP stretch). Nothing reaches phones until a reviewer checks each entry against its source and records the reviewer and date. PAGASA bulletins are the exception: they are live data, not passages, so they publish automatically, shown verbatim with their source and issued time and never reworded.
6. **Validate.** The build script checks required fields, word counts, source links and unique IDs. It also checks that every number in a summary appears in its passage text.
7. **Ship.** The guide ships inside the app. With the online stretch, new and corrected reviewed passages also arrive as signed cloud guide updates (Smart Update, MVP stretch); the bundled guide stays as the offline fallback. The About screen shows the guide date and the reviewers.

## 8. Safety rules as the user sees them

Code enforces every rule below, not the prompt. How it works is in [system-design.md](system-design.md); the catalog rows are in [features.md, sections 2 and 6](features.md#6-safety-enforced-in-code).

| When the user... | The app... |
| :-- | :-- |
| Asks something the guide does not cover | Shows "Wala ito sa gabay." with the closest topics as buttons. The model is not called. |
| Asks where the storm is, whether classes are suspended or when power returns | Never calls the model. With a cached bulletin (MVP stretch), shows the bulletin card from data, with PAGASA's issued time, the fetched time and "Makinig pa rin sa radyo". Without one, shows "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Reads a bulletin | Sees PAGASA's text verbatim with its source link. Bulletin text and numbers never go through the model, and the app never computes when the bagyo arrives. Three hours after the issued time, the stale prompt shows. |
| Taps a warning, or says the storm is here | Sees the app switch to `during` with "Lumipat sa {phase}." and "Ibalik". Automatic switches only move toward caution. |
| Undoes a switch or picks a phase by hand | Keeps that phase: the same warning, question or bulletin never switches it again; only a new one can. |
| Says the storm has passed | Sees "Pagkatapos ng bagyo" recommended on the selector, never switched automatically. Moving to `after` is always the user's tap. |
| Gets an AI answer with a `phase_hint` | The hint is only a suggestion; code drops it unless the user's words, the warnings or the bulletin back it. |
| Sees recommended evacuation centers | Sees "Ang barangay ang magsasabi kung kailan lilikas." above the list: the app suggests where, never orders when. |
| Types emergency words | Shows the emergency card first, then the answer |
| Asks about medicine doses | Points to the health center or emergency hotlines, without the model |
| Asks about the family's evacuation center or contacts | Answers from the household data, not from the model |
| Asks about a critical topic | Sees the vetted summary first, with the AI text below it |
| Gets an AI answer that fails a check | Sees the vetted summary instead |
| Reads any answer | Sees "Sundin ang utos ng barangay at ng mga awtoridad." at the end |
| Leaves a warning set for hours | Sees "Makinig muli sa radyo. Baka nagbago na ang signal." after 3 hours |

The About screen states that Bagyo Buddy is a preparedness aid, not an emergency service or a forecast.

## 9. Live demo (about 4 minutes, budget phone mirrored to the projector)

*Reasoning:* FLAG_SECURE (D12) blackens screenshots, screen recording and the recents preview, and on most Android phones it also blackens the mirrored screen. Mirror the demo from a debug build (protection off) or turn the plugin off for the demo APK; the release build keeps protection on.

1. **Two storms (30 s).** On day one of Odette (Dec 2021), mobile service was disrupted in [369 areas](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette) and [281 cities and towns lost power](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc). Kristine (Oct 2024) was only a severe tropical storm, yet it dropped [over 700 mm of rain on Naga City in 24 hours](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story). Turn on airplane mode.
2. **Family (30 s).** Show the household set up by the main person: an infant, a senior on maintenance medicine, a house near a river, and a face photo on every member. Add one member with "Mamaya na" and show the "Kulang pa ang litrato ni {name}" reminder on Home, then take the photo and watch the face check crop it.
3. **Phase by warning (30 s).** Home is in the calm `before` theme with the go-bag list first. Tap Signal 3 and orange rainfall. The app switches to the high-contrast `during` theme with "Lumipat sa Habang may bagyo." The cards show PAGASA's meaning (89 to 117 km/h within 18 hours), explain that the signal is about wind, and that orange rain near a river means getting ready to evacuate. "Gawin ngayon" lists the infant's and the senior's items.
4. **Undo and phase by Ask (40 s).** Tap "Ibalik" to go back to `before`, and show the same warning does not switch it again. Then ask "lumalakas na ang hangin dito, ano ang gagawin namin?" The router spots the cue and the app switches to `during` again, with the undo banner.
5. **Ask (50 s).** Ask "kailangan na ba naming lumikas kung malapit kami sa ilog?" The vetted summary appears at once, and the AI answer streams in below it. Tap "Saan galing ito?" to show the passage, agency and date.
6. **No live data (15 s).** Ask "saan na ang bagyo ngayon?" The fixed reply says the app has no live data and to listen to PAGASA or ask the barangay.
7. **Emergency (15 s).** Type "lumulubog na ang bahay namin." The emergency card appears first. Open the "Hinahanap" card for the senior.
8. **Low battery (15 s).** Switch on low-battery mode and ask again. The summary appears with no model.
9. **Back online (30 s, only if the online stretch is done).** Turn airplane mode off and reopen the app. The bulletin card appears with PAGASA's issued time and source, then the track view and the recommended evacuation centers under "Ang barangay ang magsasabi kung kailan lilikas." Turn airplane mode back on and show they stay readable with their age. Ask "saan na ang bagyo?" again: the bulletin card, not the model.
10. **Close (20 s).** Tap "Pagkatapos ng bagyo" to show the recovery theme and the post-storm checklist, then open the evaluation screen: retrieval hit rate, correct refusals, faithfulness, phase-switch cases and median latency on this phone.

Keep a recorded video of the same run as a backup.

## 10. The 10-hour build plan

There are four tracks, one person each. The core logic is pure TypeScript in `app/core/`, so search, routing, `decidePhase` and evaluation can be built and tested on a laptop while the app is still taking shape. The offline core, including phase themes, `decidePhase` and the required photo flow, lands before the hour 7 freeze. Everything online is post-freeze stretch.

| Hours | App | AI | Content | Search + Eval |
| :-- | :-- | :-- | :-- | :-- |
| 0 to 1 | Expo development build with llama.rn running on the target phone; the three phase themes stubbed (colors, Home order) | Model loads; schema-valid JSON; tokens stream; prompt and generation speed measured | Official documents listed in `sources.json`; tag list agreed; `phase_rules.json` with the warning rule and placeholder bands | First 40 evaluation questions with their expected passage IDs; first `decidePhase` fixtures |
| 1 to 4 | Setup and member editor with the required photo (camera or gallery, manual crop, "Mamaya na", pending reminder); PSGC location picker; Home with phase selector, themes and undo banner; warning picker and checklist screens | Prompt; schema with `used`, `in_guide`, `phase_hint` before `answer`; prefix cache; Q4_K_M vs Q4_0; device tier check | The 30 demo-critical passages first, then on toward 120; phase checklist items; `warnings.json`; `hotlines.json`; `places.json` | `normalize`, synonyms, MiniSearch with tag boosts, `gate`; `decidePhase` from warnings and `phaseCue`; phase cue lists in `intents.json`; the Node evaluation runner |
| 4 to 7 | Ask screen (summary first, streaming, "Saan galing ito?"), emergency card, refusal with topic buttons, Hotlines screen, low-battery mode; face check and "Hinahanap" card (MVP); static Account screen (sign-up, login, forgot password, no backend); FLAG_SECURE plugin, release builds only | `verify` (citations, numbers including Tagalog number words, phone numbers), critical pinning, `phase_hint` check, fallbacks, load, warm-up and unload | Finish passages, summaries, critical flags and reviews; gas safety, first aid and psychosocial passages | Intent router rules; all 120 questions; phase-switch fixtures; tune the gate threshold; first metrics |
| 7 to 9 | About and evaluation screens; polish; confirm no INTERNET permission in the core build. Stretch: `UpdateClient`, bulletin card, track view, recommended centers, network log, GPS button | Latency, RAM and battery numbers on the phone | Fix the passages the evaluation flags. Stretch: scraper in `scripts/scrape/` publishing a signed feed; hotline and center review queue | Final metrics; blind test with 3 to 5 outsiders. Stretch: `measureStorm` and `rankCenters` fixtures |
| 9 to 10 | Everyone: rehearse the demo twice and record the backup video | | | |

**Sync points**

- **Hour 1:** the model runs on the phone, its speed is known and the tag list is frozen.
- **Hour 4:** one question goes end to end on the phone: route, search, summary, AI answer; a warning tap switches the phase and theme.
- **Hour 7: feature freeze.** Every MVP (core) and MVP row is done or cut. MVP stretch items, including every online feature, start only if every MVP row is green. The core build keeps no INTERNET permission unless the online stretch lands.
- **Hour 9:** code freeze; the release APK is built.

**With three people.** The AI owner also takes search (`normalize`, MiniSearch, `gate`). The Content owner also writes the evaluation questions and phase-switch fixtures. Whoever is free first after hour 4 builds the Node evaluation runner.

**With two people.** One person takes the App track (frontend). The other takes AI and Search + Eval (backend), including `decidePhase`. They meet at the `Engine` facade, and the frontend builds every screen against the mock engine from hour 1 ([api-layer.md, section 3](api-layer.md#3-frontendbackend-handoff)). Content is split: the backend person writes passages, and the frontend person writes checklist items and warning-card text. Write the 30 demo-critical passages first and add more only if time allows. Skip the online stretch.

**Out of scope for the hackathon:** the LGU portal, the DRRM dashboard, payments, languages beyond Tagalog and English, and the full 300-passage guide (ship 120 and say so). Never in any release: map tiles, push alerts, background sync or location, and predicting when the bagyo arrives ([features.md, section 13](features.md#13-out-of-scope)).

## 11. Evaluation

Test retrieval and refusal separately from answer quality, because a wrong passage guarantees a wrong answer no matter how good the model is. Test phase switching as pure code, because a wrong switch changes the whole app.

### The set

- 80 in-scope questions written by the team in Taglish, each labeled with the passage IDs that answer it.
- 25 out-of-scope questions, at least 10 of them about live data ("saan na ang bagyo?", "may pasok ba bukas?", "kailan babalik ang kuryente?"), plus others such as "magkano ang bigas?".
- 15 questions with emergency wording.
- 20 of the in-scope questions rephrased by 3 to 5 people outside the team, so the test is not only our own wording.
- 10 test household profiles, each with the checklist items it must include. For example, a profile with `infant` must get milk and diapers, and a member with `maintenance_meds` must appear by name on the medicine item.
- `decidePhase` fixtures, each an input set with its expected phase, source and banner:
  - **Cautious only:** a warning or a "storm is here" cue moves `before` to `during`; a new bagyo approaching moves `after` to `before`; no input ever moves the app to a less cautious phase; disagreeing inputs give the more cautious phase.
  - **Undo suppression:** after "Ibalik" or a manual pick, the same warning, question or bulletin does not switch again; a new one does.
  - **After never automatic:** "humupa na ang bagyo", a departed bagyo or a cleared warning only recommends `after`; the phase stays until the user taps.
  - **Hint rejection:** a model `phase_hint` with no backing from the user's words, the warnings or the bulletin is dropped; a backed hint is accepted.
  - **Placeholder bands:** while `phase_rules.json` is marked placeholder, bulletin distance never switches the phase.
- 8 test photos for the face check (MVP): no face, one face, three faces, a dark photo, a rotated photo, a child, an elder, and one carrying GPS metadata that must be gone after saving.

### Metrics and targets

| Metric | Target (proposal) | How measured |
| :-- | :-- | :-- |
| Retrieval hit@2 | ≥ 85% of in-scope questions | A labeled passage is in the top two; Node runner |
| Correct refusal | ≥ 90% of out-of-scope questions | No AI answer shown: a refusal, a fixed reply or a bulletin card instead |
| Emergency trigger | 100% of the 15 emergency questions | The emergency card appears first |
| Live-data route | ≥ 95% of live-data questions | The fixed reply or bulletin card, not a guide answer; the model never called |
| Phase switching | 100% of `decidePhase` fixtures | Expected phase, source and banner; Node runner |
| Faithfulness | ≥ 90% of shown AI answers | Two teammates check each answer against its passages: no added facts, no flipped instructions |
| Number and phone check | 100% of shown answers | Code rule; any failure falls back to the summary |
| Checklist tailoring | 100% of required items | The 10 test profiles; Node runner |
| Summary on screen | ≤ 1 s median | Logged on the 4 GB phone |
| First AI words | ≤ 5 s median | Logged on the 4 GB phone |
| Full AI answer | ≤ 10 s median; 6 s stretch | Logged on the 4 GB phone |
| Checklist render | < 0.5 s | Logged on device; no model involved |
| Peak RAM | ≤ 1.2 GB | Android Studio profiler |

Retrieval, refusal, routing, phase switching and tailoring run on a laptop in seconds. Latency, RAM and battery come only from the phone.

**The blind test.** Show people outside the team the same answers in two forms: summary only, and summary plus AI. Put the numbers side by side for the judges. *Reasoning:* if people prefer summary plus AI, that is the evidence that the local model adds value beyond a static guide. If they do not, ship summary-first and say so honestly.

## 12. Risks and fallbacks

| Risk | Fallback |
| :-- | :-- |
| Writing good passages takes longer than planned | Start with the 30 passages the demo touches; label the rest as roadmap |
| Keyword search misses paraphrases | Grow `synonyms.json` from evaluation misses; show topic buttons on refusal |
| The app switches phase at the wrong time | Switches only move toward caution, `after` is always the user's tap, every switch has "Ibalik", and the `decidePhase` fixtures run on every change; distance switching stays off until the bands are sourced |
| The scraper misreads a PAGASA bulletin | Parse failure keeps the previous feed and marks it stale; fields are never guessed; the card shows PAGASA's verbatim text, source link and issued time |
| The model adds facts not in the passage | Number and phone checks, pinned critical summaries, fallback to the summary; faithfulness shown on the evaluation screen |
| A 1B model writes weak Tagalog. Tagalog is not among Llama 3.2's [official languages](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) | Benchmark Qwen3 1.7B or 0.6B, which [lists Tagalog](https://qwenlm.github.io/blog/qwen3/), if hackathon rules allow; otherwise ship summary-first |
| Answers are slow on budget phones | Summary first; device tiers; one passage on `lite`; passages near 100 words; output capped at 110 tokens; test Q4_0 |
| The user taps the wrong warning | Cards quote PAGASA's meaning so it can be checked against the radio; Home shows each active warning and its age |
| Old warnings stay active | The stale-warning prompt after 3 hours |
| Errors in the content | A source and locator on every passage, two-person review, the guide date on About; DRRMO review in the Pilot |
| Judges ask "why not just a PDF?" | Show a Taglish question answered in two sentences fitted to the household, against scrolling a long guide |
| Liability for safety advice | Every answer cites an official source and ends with the closing line; the app states it is a preparedness aid, not an emergency service |
| Commercial reuse of government text | Keep the household app free and credited; seek agency approval before any paid license (section 7) |
| Photos of family members, including children, leak | Photos stay in app-private storage without location metadata, are excluded from cloud backup, and never reach the model, packs, reports or logs; one tap deletes a photo or all photos ([system-design.md](system-design.md)). Screenshots and screen recording are blocked by FLAG_SECURE (D12) |
| Screenshots of member photos or cards are shared | FLAG_SECURE blocks screenshots, recording and the recents preview in release builds; the "Hinahanap" card is share-only through the share sheet |
| FLAG_SECURE blacks out the mirrored demo | Mirror from a debug build or disable the plugin for the demo APK (section 9) |
| The optional account exposes profile data (Later) | MVP has no backend at all. Later: sync only after sign-in, opt-out in Settings, TLS to the pinned host, hashed passwords, and photos and location never sync |
| A damage report exposes household data (Pilot) | Opt-in, sent only on the user's tap, cached until signal, structured fields plus the photos the user chose; the LGU side follows the portal's approval rules |
| People think the app "recognizes" faces | The setup screen says it only finds a face to crop the photo; there is no recognition or face matching |
| Face detection adds size and a native module late in the build | Photo capture and manual crop are MVP (core); the face check is MVP and can be cut without blocking setup |
| Families resist a required photo | "Mamaya na" saves the member as pending; nothing else is blocked; the consent line explains why |
| LGU account misuse (Pilot) | Structured fields only, two-person approval (author and approver), signing by the platform |
| Slow procurement (Pilot) | Start with pilots small enough for small value procurement; see [BMC.md](BMC.md) |

## 13. Roadmap

| Stage | When | Scope |
| :-- | :-- | :-- |
| Hackathon (MVP) | The 10-hour build | The offline core: household with required photos, phases with themes and automatic switching, warnings, checklists, hotlines, summary-first Q&A, safety router and verifier, low-battery mode, 120 passages, evaluation. Stretch: the online bulletin feed, track view, recommended centers and optional GPS |
| Pilot | 1 to 2 barangays or one municipality, before the next typhoon season | Hardening the online feed and scraper (PAGASA terms or a data feed), the LGU pack (evacuation centers, hotlines, advisories), scraped source watch, opt-in topic reports and the DRRM dashboard, damage reports to the LGU, DRRMO content review, the Google Play AI pack, the full 300-passage guide |
| Later | After the first season | To be decided from Pilot results. Candidates already listed: the real optional family account (profile backup sync after sign-in), one-turn follow-ups in Ask, voice input through on-device speech-to-text, and AI-assisted content drafting with a reviewed cloud model (D13) |

The Pilot's success measure is an outcome, not app opens: the share of pilot households with a packed go-bag and a family plan, from a survey before and after (README B5).

## Sources

- [PAGASA: Tropical Cyclone Wind Signals](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal)
- [Varsitarian: how PAGASA's rainfall warnings work (secondary)](https://varsitarian.net/sci-tech/20250724/explainer-how-do-pagasas-rainfall-warnings-and-weather-advisories-work)
- [Inquirer: PAGASA's color-coded warnings (secondary)](https://newsinfo.inquirer.net/654913/pagasas-color-coded-warnings/amp)
- [ABS-CBN: storm surge warning bands, Nov 2024 (secondary)](https://www.abs-cbn.com/news/2024/11/15/storm-surge-warning-up-in-areas-on-typhoon-pepito-s-path-2110)
- [GMA: Kristine rainfall on Naga City](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story)
- [New Straits Times: Odette day-one NDRRMC figures](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette)
- [DZRH: Odette power restoration, NDRRMC](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc)
- [Emergency Cell Broadcast System and RA 10639](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)
- [Google Play for On-device AI (beta)](https://developer.android.com/google/play/on-device-ai)
- [ndvlaw: RA 8293 Section 176, works of the government](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)
- [Meta Llama 3.2 1B Instruct model card](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)
- [Qwen3 announcement and language list](https://qwenlm.github.io/blog/qwen3/)
