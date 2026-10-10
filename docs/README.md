# Sipat docs: start here

*v3 · 2026-10-09 · Stage: active development. App code lives in `app/`.*

## The idea in one paragraph

Sipat is an offline-first typhoon companion for Filipino households on budget Android phones. The main person sets up the family once, member by member, with a face photo of each. The app runs in one of three bagyo phases (before, during, after), and the phase changes the whole look of the app, the checklist and the answers. The phase can switch on its own: from the warning the family taps after hearing it on the radio (wind signal, rainfall, storm surge or gale), from what they tell the assistant, and, when the phone has signal, from how close the latest PAGASA bulletin puts the bagyo. They can ask questions in Taglish and get answers drawn only from official preparedness guides that ship inside the app, with the source one tap away. A small on-device model (Llama 3.2 1B) puts the matched passage in plain words, but the app works fully without it: the vetted summary shows first, the AI answer second. When signal is available, the app also fetches a signed feed from our own server (scraped PAGASA bulletins, nearby evacuation centers, hotline and guide updates) and keeps it for offline use. Households never pay. LGUs pay for a localized pack with their own evacuation centers, hotlines and advisories.

## Read in this order

| Doc | What it answers |
| :-- | :-- |
| [features.md](features.md) | Every feature by release, and the v3 decisions. The feature source of truth |
| [problem.md](problem.md) | Who gets hurt, when, the evidence, and why today's options fail |
| [solution.md](solution.md) | The user journey, screens, content guide, demo, 10-hour plan, evaluation |
| [system-design.md](system-design.md) | Architecture, data, retrieval, generation, safety, phases, feed and scraper, battery, updates, security |
| [api-layer.md](api-layer.md) | Module interfaces, data schemas, feed and pack format, update and LGU APIs |
| [BMC.md](BMC.md) | Business model canvas, pricing, how LGUs buy, go-to-market |

**Source of truth.** [idea-sipat.md](idea-sipat.md) and [Sipat-Product-Overview.md](Sipat-Product-Overview.md) are the v1 inputs, kept for history. Where they disagree with the docs above, the docs above win. Where those docs disagree on a feature, [features.md](features.md) wins. [proposal-cached-bulletins.md](proposal-cached-bulletins.md) is superseded by the v3 feed design.

**Conventions.** Linked figures are sourced. *Reasoning:* marks our own analysis. **Unverified** marks secondary figures. Every target is a proposal to measure, not a result. Release tags: **MVP** is the 10-hour hackathon build, **MVP stretch** is MVP if time allows (every online feature is here), **Pilot** is the first one or two LGUs, **Later** is the roadmap.

## What v3 changes (2026-10-09)

The full decision table (D1 to D8) is in [features.md](features.md#decisions-2026-10-09). In short:

- **Required face photos** (D1). Every member needs one; "Mamaya na" saves the member as pending.
- **Phase is the app's mode** (D2, D3). Each phase has its own UI theme. `decidePhase` switches it automatically from warnings, the user's own words in Ask (plus the model's checked `phase_hint`) and, online, the bagyo's distance from the household. The user can always undo.
- **Hybrid** (D4, D5). The offline core is unchanged. A server-side scraper publishes a signed feed of PAGASA bulletins, evacuation centers and hotline updates on our one host; the phone fetches it only while open and caches it. All online features are MVP stretch.
- **Optional location** (D6). One coarse GPS reading on tap, or a PSGC area from a list. It never leaves the phone.
- **Mascot pending** (D7). Each theme keeps a slot until the character is designed.
- **Trimmed** (D8). Features that did not serve the core were dropped; see features.md.

## What v4 changes (2026-10-09)

Follow-ups to the v3 review; the full table is in [features.md](features.md#decisions-2026-10-09).

- **Family account, static first** (D9). The household profile stays cache-first and works with no account. The MVP ships static sign-up, login and forgot-password screens with no backend: nothing leaves the phone, nothing is blocked, and the app stays demoable. The real optional account (sign-in, then profile backup sync while online) is Later.
- **Damage reports to the LGU** (D10, D11). New `after` guide topics cover documenting storm damage and getting assistance. A Pilot opt-in lets a household send a structured damage report with photos to its LGU, cached until signal returns. Screenshots are blocked app-wide so member photos stay private (D12).
- **Wider guide** (D11). New topics: LPG and gas safety (`gas` hazard), first aid, psychosocial support after a disaster, and damage documentation and assistance. Sources: BFP, DOH, DSWD, NDRRMC.
- **Roadmap** (D13). Later: one-turn follow-ups in Ask, voice input through a separate on-device speech-to-text (Llama 3.2 1B is text-only), and AI-assisted content drafting with a cloud model (e.g., DeepSeek) that is always human-reviewed before it ships. Languages stay Tagalog and English; Bisaya remains dropped (D8).

## What v2 changed, and why

These are the enhancements to the v1 idea, updated for v3.

### 1. Contradictions in v1, resolved

| # | v1 said | Decision | Why |
| :-- | :-- | :-- | :-- |
| F1 | The idea doc: "no internet permission after install." The overview: Smart Update downloads over the internet. | The release build keeps the INTERNET permission. The network is used only on a user action and only while the app is open, and every request is listed in an on-screen network log. Allowed connections: `UpdateClient` to one pinned host (our server) for the feed and packs (MVP stretch), plus the one-time AI model download from Hugging Face when the user taps "I-download ang AI" in Settings (MVP; owner-approved exception to the one host, verified by size and SHA-256). The offline core never waits on either. | Android grants INTERNET at install and most phones give users no switch to deny it, so the limit has to be in our code and visible. |
| F2 | "Nothing downloads without a tap," but "the LGU pack downloads automatically." | The small bulletin feed is checked when the app opens with signal (can be turned off). Packs and the model wait for a tap, Wi-Fi by default. | Bulletins are only useful if fresh; packs are large. |
| F3 | "The profile never leaves the phone," but a DRRM dashboard shows the most-asked questions. | The dashboard is a separate opt-in, off by default. Phones send weekly counts of topic groups only, never question text, profile data or location. Cells with fewer than 10 households are hidden. | Health and disability details are sensitive personal information under the Data Privacy Act (RA 10173). |
| F4 | Updates "picked by the household profile." | The bulletin feed is one file for everyone. Area data (evacuation centers, LGU packs) comes as a whole province bundle, filtered on the device. | Otherwise what a phone fetches reveals who lives in the house and where. |
| F5 | Polar for LGU licenses and invoices. | LGUs buy through government procurement (RA 12009): a registered Philippine business, PhilGEPS, official invoices, and at least three quotations for small value procurement. Polar, which pays out to the Philippines through Stripe Connect Express, stays for NGOs, schools and sponsors who pay by card. | LGU purchases follow procurement rules, not card checkouts. |
| F6 | Mentions of "Listahan" and "round one." | Removed. | Leftovers from another idea. |

### 2. Safer answers

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| S1 | The warning picker covers wind signals 1 to 5 **and** rainfall warnings (yellow, orange, red), storm surge warnings and gale warnings. | MVP | Wind signals describe wind only. Kristine (Oct 2024) was a severe tropical storm, a category below typhoon, yet Naga City got over 700 mm of rain in 24 hours, about 2.5 months' worth ([GMA](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story)). |
| S2 | An intent router runs before search. Emergency words show the emergency card; live-data questions ("nasaan na ang bagyo?", "may pasok ba bukas?") get the cached bulletin card if there is one, else a fixed reply, and never the model; questions about the family plan are answered from the plan; medicine-dose questions go to the health center; phase cues ("Signal 3 na dito", "humupa na") feed `decidePhase`. | MVP | Keeps the riskiest questions away from the model. |
| S3 | Hotlines, evacuation centers, bulletin data, names and phone numbers come only from structured data, never from the model. The verifier rejects any number or phone-like string not in the cited passages, including Tagalog and Spanish number words ("labindalawa", "dose"). | MVP | A made-up hotline is worse than none. |
| S4 | Passages tagged `critical` (evacuation, electricity, floodwater, generators, medicine) always show the human-written summary first; the AI text sits below it. | MVP | A life-safety sentence is never only AI-written. |
| S5 | Active warnings and cached bulletins show their age. After 3 hours the app asks the user to listen to the radio again. It never computes an arrival time. | MVP | Signals change, and lead times count from the bulletin, not from the tap. |
| S6 | Every passage, hotline and evacuation center records who reviewed it and when; the content and feed builds fail without it. | MVP (team review), Pilot (LGU DRRMO review) | The content is the product; review is how it earns trust. |

### 3. Fast enough on a budget phone

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| P1 | Answers come in two steps: the matched passage's vetted summary appears in under a second, then the AI answer streams in below it. | MVP | A budget phone may need several seconds just to read a 600-token prompt. The user never waits with nothing on screen. |
| P2 | The output JSON lists `used`, `in_guide` and `phase_hint` before `answer`, so the answer text can stream while the citation and phase hint are already known. | MVP | Streaming, citation and phase hint in one call. |
| P3 | Device tiers decide whether AI runs (rules below). The model is an optional pack; the app is complete without it. | MVP | Many budget phones cannot hold a 0.81 GB model next to the OS. |
| P4 | Search is MiniSearch (BM25+), indexed at startup, so there is no prebuilt index file. Tag boosts (profile, warnings and the current phase) use `boostDocument`; fuzzy and prefix matching absorb typos; synonyms list Tagalog verb forms (lumikas, lilikas, paglikas, mag-evacuate, bakwit). One or two passages go to the model, depending on scores. | MVP | Fewer moving parts and shorter prompts. |
| P5 | The fixed instruction prefix is cached (llama.rn `saveSession`/`loadSession`). The model warms up when the Ask screen opens and unloads after 2 minutes idle or when the app goes to the background. | MVP | Less waiting, no new dependencies. |
| P6 | The core logic (router, search, verifier, checklist, `decidePhase`, distance math) is pure TypeScript that also runs in Node, so the 120-question evaluation and the phase-switch cases run on a laptop in seconds. The phone is for latency, memory and battery numbers. | MVP | Faster iteration in a 10-hour build. |

### 4. More useful for the family

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| U3 | Guide packs are signed files. They arrive from our server, or the user can import a pack file already on the phone; the app checks the signature, not the channel. | MVP stretch | Updates still reach phones that are offline. |
| U6 | Large text, icons and a dark variant of every phase theme. | MVP | Elders, low light, low literacy. |

U1 (SMS texts), U2 (go-bag amounts), U4 (Bisaya, Cebuano) and U5 (livelihood tags) were dropped in v3 (D8).

### 5. A sharper business

| # | Change | Why |
| :-- | :-- | :-- |
| B1 | Sell into the Local DRRM Fund: by law at least 5% of an LGU's estimated regular revenue, with 30% of it set aside as the Quick Response Fund (RA 10121, Sec. 21). | The buyer already has a mandated budget line for preparedness. |
| B2 | Tie the pitch to the Seal of Good Local Governance: disaster preparedness is one of the ten areas an LGU must pass (RA 11292; DILG MC 2023-086). | Gives the mayor a reason to care. |
| B3 | Add CSR-sponsored licenses (telcos, electric cooperatives, banks, insurers), credited on the About screen. Never ads. | A second revenue stream that keeps households free. |
| B4 | Model bytes come from Hugging Face in the MVP (downloaded once on a Settings tap and checked by size and SHA-256), and may come from Google Play (an AI pack) in the Pilot; never from our CDN. Our servers host only KB-size feed files and guide packs; the scraper runs as a scheduled job. | Cost to serve stays near zero. |
| B5 | Report outcomes LGUs care about: the share of pilot households with a packed go-bag, a family plan and photos of every member (before and after survey), not app opens. | Outcomes renew contracts. |

### 6. Family profiles and photos

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| H1 | Setup starts with the main person (the phone's owner), who enters their own details, then adds each family member one by one: name or nickname, relation, age group, needs (pregnant, disability, maintenance medicine), an optional short note such as medicine names, an optional phone number, and a required face photo (H3). Household tags and headcount are derived from these members, so nobody types a headcount. | MVP | Per-person details make the checklist name the person ("gamot ni Lolo Ben") and remove a field families get wrong. |
| H2 | There is no online account. The "family account" is the household profile on this phone: no sign-up, no password, no server copy. | The household profile lives on this phone and works with no account. The MVP ships static sign-up, login and forgot-password screens (demo only, no backend, nothing blocked). The real optional family account is Later: the profile is cache-first and syncs after sign-in while online; photos and location never sync and the sync can be turned off in Settings (D9). | MVP keeps the offline and privacy promises (F1, F3); judges can walk through the auth screens and then use the app without logging in. |
| H3 | Every member needs a face photo, from the camera or the gallery. There is no skip button; "Mamaya na" saves the member as `pending` and Home reminds until every member has one. | MVP (core) | If someone is separated, a face photo is what rescuers and evacuation staff can act on. |
| H4 | Face detection uses a separate on-device detector, Google ML Kit's bundled face detection model (about 6.9 MB, works offline; [ML Kit](https://developers.google.com/ml-kit/vision/face-detection/android)). It only finds where faces are, to check a photo has one face and crop it; when it finds none or several, the user crops by hand. It never recognizes who someone is, compares faces or stores face data. Llama 3.2 1B is text-only and never sees photos. | MVP | The language model cannot read images. The detector is small, offline and limited to cropping. |
| H5 | Photos stay in app-private storage, re-encoded without location metadata, excluded from Android cloud backup, and never go into the model prompt, packs, topic reports, logs or network requests. They leave the phone only when the user shares a member's card. | MVP (core) | Photos of children and elders are the most personal data the app holds. |
| H6 | A "Hinahanap" card per member (photo, name, age group, needs, the main person's number, the evacuation center) for showing to rescuers or evacuation staff if someone gets separated. | MVP | Family members get separated during evacuations; a photo card works with no signal. |

**Positioning.** Alerts tell you a storm is coming. Sipat tells your household what to do, even with no signal, and shows the latest PAGASA bulletin it saw while it still had one. It complements the free cell-broadcast alerts (RA 10639), PAGASA bulletins, Project NOAH and HazardHunterPH rather than competing with them.

## Shared names

Use these exact names in every doc and in code. Full types are in [api-layer.md](api-layer.md).

**Phases:** `before`, `during`, `after`. Each phase is also a UI theme key.

**Phase sources** (what made the current phase): `manual` (the user picked it), `warning` (an active warning), `ask` (a phase cue in a question, optionally backed by the model's `phase_hint`), `bulletin` (the cached bulletin's distance band).

**Warnings** (the "Ano ang narinig mo?" picker)

| Kind | Levels | Meaning |
| :-- | :-- | :-- |
| `tcws` | 1 to 5 | PAGASA Tropical Cyclone Wind Signal |
| `rainfall` | `yellow`, `orange`, `red` | PAGASA heavy rainfall warning |
| `surge` | `yellow`, `orange`, `red` | PAGASA storm surge warning |
| `gale` | on or off | PAGASA gale warning (sea travel, fisherfolk) |
| `barangay_order` | on or off | The household's barangay has ordered evacuation ("Pinapalikas na kami ng barangay"); our own choice, not a PAGASA warning |

**Profile tags**

- Members: `infant`, `child`, `pregnant`, `senior`, `pwd`, `maintenance_meds`, `pets`
- Home: `near_river`, `near_sea`, `slope`, `low_lying`, `light_materials`, `concrete`, `upper_floor`

**Family members** (H1). Each `Member` has an `ageGroup` (`infant` under 1, `child` 1 to 12, `teen` 13 to 17, `adult` 18 to 59, `senior` 60 and over), a `relation` (`self` for the main person, `spouse`, `child`, `parent`, `grandparent`, `grandchild`, `sibling`, `relative`, `other`) and `needs` (`pregnant`, `pwd`, `maintenance_meds`). The household's member tags are derived: `infant`, `child` and `senior` from age groups; `pregnant`, `pwd` and `maintenance_meds` from needs; `pets` from the pet count. A member's `photoStatus` is `done` or `pending`. A saved photo's `faceCheck` is `one_face` (detector found exactly one) or `manual` (the user cropped by hand); `no_face` and `many_faces` are detector results that send the user to manual crop.

**Household location:** `psgc` (barangay code, always set) and optional `coords` (one coarse GPS reading with its time). Stored in the profile; never leaves the phone.

**Hazard tags:** `wind`, `flood`, `surge`, `landslide`, `electrical`, `water`, `health`, `fire`, `gas`.

**Topic groups** (refusal suggestions and opt-in reports): `signals`, `go_bag`, `home_prep`, `evacuation`, `flood`, `surge`, `landslide`, `infant`, `senior`, `pregnancy`, `disability`, `pets`, `water_food`, `electrical`, `generator_fire`, `gas_safety`, `cleanup`, `health_after_flood`, `first_aid`, `psychosocial`, `damage_report`, `assistance`, `out_of_guide`.

**Checklist groups:** `now` ("Gawin ngayon"), `go_bag`, `home`, `evacuate`, `after`.

**Bundled content files** (`content/`): `guide.tl.json`, `checklist.json`, `warnings.json`, `synonyms.json`, `intents.json`, `sources.json`, `hotlines.json`, `phase_rules.json` (warning-to-phase mapping, distance bands and the evacuation-center threshold, each sourced or marked placeholder) and `places.json` (PSGC list). Province bundles add `evacuation_centers.json` (scraped and reviewed, MVP stretch); LGU packs replace it and add `advisories.json` and `hazard_notes.json` (Pilot). The model file is `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (0.81 GB).

**Feed** (MVP stretch): `bulletins.json`, built by the scraper. Each `Bulletin` has `id`, `source` (agency, title, URL), `issuedAt`, `scrapedAt`, the parsed fields the app shows (name, category, position, movement, forecast positions, signal areas as PSGC codes) and `text` (verbatim). The phone adds `fetchedAt`.

**Modules.** The pure core lives in `app/core/` with no React Native imports: `normalize`, `route`, `createIndex`, `search`, `gate`, `buildPrompt`, `verify`, `buildChecklist`, `verifyPack`, `decidePhase`, `measureStorm` (distance and direction from the household to bulletin positions), `rankCenters`. Services live in `app/services/`: `ModelManager`, `PowerPolicy`, `Store`, `PackManager`, `ShareService`, `PhotoService`, `LocationService` (MVP stretch), `UpdateClient` (MVP stretch: feed and packs), `TopicReporter` (Pilot). The scraper and feed builder live in `scripts/scrape/` and run as a scheduled job on the server side. The `ask()` orchestrator, built with `createAsk(deps)` so tests can pass fakes, emits `AnswerEvent`s. Screens talk only to the `Engine` facade in `app/engine/` (`createEngine()`, plus `createMockEngine()` so the UI can start before the engine exists). That facade is the frontend–backend boundary; [api-layer.md, section 3](api-layer.md#3-frontendbackend-handoff) has the full handoff.

**Routes:** `emergency` (a flag that can combine with another route), `live_data`, `plan`, `medical_dose`, `guide`. `phaseCue` is a second flag that can combine with any route.

**Answer events:** `emergency_card`, `fixed_reply`, `bulletin_card`, `plan_answer`, `refusal`, `summary`, `ai_status`, `ai_partial`, `ai_final`, `ai_rejected`, `phase_change`, `closing`, `done`.

**Verifier failure codes:** `schema`, `not_in_guide`, `bad_citation`, `unknown_number`, `phone_number`, `too_long`, `wrong_language`.

**Device tiers** (physical RAM as Android reports it; "extended RAM" does not count)

| Tier | Rule | AI |
| :-- | :-- | :-- |
| `full` | ≥ 3.5 GB reported (sold as 4 GB or more) and ≥ 1.5 GB free storage | On, up to 2 passages |
| `lite` | 2.5 to 3.5 GB reported (sold as 3 GB) | On, 1 passage, shorter output |
| `none` | < 2.5 GB, or not enough storage for the model | Off: summaries only |

**Default numbers** (proposals to measure)

- Low-battery mode below 15%, or whenever the phone's battery saver is on.
- Unload the model after 2 minutes idle or when the app goes to the background.
- Stale prompt 3 hours after a warning was set or a bulletin was issued.
- Feed checked when the app opens with signal and on pull to refresh; never in the background.
- Phase distance bands and the evacuation-center threshold: placeholders in `phase_rules.json` until sourced. No default numbers.
- Context 1,024 tokens; output at most 110 tokens; temperature 0.2.
- Dashboard cells hidden below 10 households.
- Summary on screen in ≤ 1 s. First AI words in ≤ 5 s and the full AI answer in ≤ 10 s, median on a 4 GB phone. v1's 6-second full answer stays the stretch goal.

**Updates, feed and packs.** A pack file is `*.bagyopack`. CDN paths: `/v1/keys.json`, `/v1/feed/manifest.json`, `/v1/core/manifest.json`, `/v1/areas/{provinceCode}/manifest.json`, `/v1/blobs/{sha256}.json.gz`. Manifests are signed with Ed25519 over RFC 8785 canonical JSON. Place codes are PSGC codes. The model is not on the CDN: the MVP downloads it from Hugging Face.

**On-device stores (MMKV keys):** `profiles` (members and location included), `activeProfileId`, `context` (phase, phase source, warnings), `checklist:{profileId}`, `questionLog`, `settings`, `packs`, `feed` (MVP stretch), `networkLog` (MVP: model download; MVP stretch: feed and packs), `topicCounts` (Pilot), `damageReports` (Pilot), `account` (Later).

**Fixed Tagalog copy**

| Key | Text |
| :-- | :-- |
| Phase buttons (`before`, `during`, `after`) | "Bago ang bagyo", "Habang may bagyo", "Pagkatapos ng bagyo" (short forms: "Bago", "Habang", "Pagkatapos") |
| Phase switched (draft) | "Lumipat sa {phase}." with the button "Ibalik" |
| Warning picker title | "Ano ang narinig mo?" |
| Closing line on every answer | "Sundin ang utos ng barangay at ng mga awtoridad." |
| Refusal | "Wala ito sa gabay." |
| Source link | "Saan galing ito?" |
| No live data | "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Bulletin age (draft) | "Inilabas ng PAGASA: {issuedAt}. Na-download: {fetchedAt}. Makinig pa rin sa radyo." |
| Stale warning | "Makinig muli sa radyo. Baka nagbago na ang signal." |
| Evacuation is the barangay's call (draft) | "Ang barangay ang magsasabi kung kailan lilikas." |
| Photo consent line (draft) | "Siguraduhing pumayag ang tao bago kunan ng litrato." |
| Photo is required (draft) | "Kailangan ang litrato ng mukha para makilala kung sakaling mawalay. Puwedeng mamaya na." |
| Photo pending (draft) | "Kulang pa ang litrato ni {name}." |
| Location button (draft) | "Gamitin ang lokasyon ng telepono" |
| Medicine-dose reply (draft) | "Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor." |

## Glossary

| Term | Meaning |
| :-- | :-- |
| Bagyo | Typhoon or tropical cyclone (Tagalog) |
| Barangay | The smallest unit of local government; it issues local evacuation orders |
| LGU | Local government unit: province, city, municipality or barangay |
| DRRMO | An LGU's Disaster Risk Reduction and Management Office; our buyer |
| LDRRMF, QRF | Local DRRM Fund (at least 5% of regular revenue); its 30% Quick Response Fund |
| NDRRMC, OCD | National DRRM Council; the Office of Civil Defense, its secretariat and executive arm |
| PAGASA | The national weather agency, under DOST |
| TCWS | Tropical Cyclone Wind Signal, levels 1 to 5 |
| Bulletin | A PAGASA tropical cyclone bulletin: the bagyo's position, strength, movement, forecast and signal areas |
| Feed | The signed file of scraped bulletins our server publishes for phones to fetch |
| Phase theme | The look of the whole app for one phase: colors, Home layout, illustrations, mascot slot |
| PHIVOLCS | The volcano and earthquake institute; runs HazardHunterPH |
| DOH, BFP, DILG | Department of Health; Bureau of Fire Protection; Department of the Interior and Local Government |
| BHW | Barangay health worker |
| PSGC | Philippine Standard Geographic Code: official codes for regions, provinces, cities, municipalities and barangays |
| SGLG | Seal of Good Local Governance (RA 11292) |
| ECBS | Emergency Cell Broadcast System: free disaster alerts to phones (RA 10639) |
| PhilGEPS, SVP | The government e-procurement system; small value procurement |
| Taglish | Tagalog mixed with English |
| Go-bag | A bag packed ahead, ready to grab when evacuating |
| Gabay, lumikas, ligtas, tulong | Guide, evacuate, safe, help |
| Ambon, Bantay | Free household tier ("drizzle"); paid LGU tier ("watch") |
| Pack | A signed bundle of guide data: core or area (LGU). The model is downloaded separately |
