# Bagyo Buddy docs: start here

*v2 · 2026-10-09 · Stage: idea and design. No app code yet.*

## The idea in one paragraph

Bagyo Buddy is an offline typhoon companion for Filipino households on budget Android phones. The main person sets up the family once, member by member, with an optional photo of each. When a storm comes, they tap the warning they heard on the radio (wind signal, rainfall, storm surge or gale) and get a checklist fitted to their household. They can ask questions in Taglish and get answers drawn only from official preparedness guides that ship inside the app, with the source one tap away. A small on-device model (Llama 3.2 1B) puts the matched passage in plain words, but the app works fully without it: the vetted summary shows first, the AI answer second. Households never pay. LGUs pay for a localized pack with their own evacuation centers, hotlines and advisories, out of the disaster fund the law already requires them to keep.

## Read in this order

| Doc | What it answers |
| :-- | :-- |
| [problem.md](problem.md) | Who gets hurt, when, the evidence, and why today's options fail |
| [solution.md](solution.md) | What we build, the user journey, features by release, demo, 10-hour plan, evaluation |
| [system-design.md](system-design.md) | Architecture, data, retrieval, generation, safety, battery, updates, security |
| [api-layer.md](api-layer.md) | Module interfaces, data schemas, pack format, update and LGU APIs |
| [BMC.md](BMC.md) | Business model canvas, pricing, how LGUs buy, go-to-market |

**Source of truth.** [idea-bagyo-buddy.md](idea-bagyo-buddy.md) and [Bagyo-Buddy-Product-Overview.md](Bagyo-Buddy-Product-Overview.md) are the v1 inputs, kept for history. Where they disagree with the five docs above, the five docs win.

**Conventions.** Linked figures are sourced. *Reasoning:* marks our own analysis. **Unverified** marks secondary figures. Every target is a proposal to measure, not a result. Release tags: **MVP** is the 10-hour hackathon build, **MVP stretch** is MVP if time allows, **Pilot** is the first one or two LGUs, **Later** is the roadmap.

## What v2 changes, and why

These are the enhancements to the v1 idea. The five docs carry them through.

### 1. Contradictions in v1, resolved

| # | v1 said | v2 decision | Why |
| :-- | :-- | :-- | :-- |
| F1 | The idea doc: "no internet permission after install." The overview: Smart Update downloads over the internet. | The MVP APK has no INTERNET permission, so "offline" is provable. The Pilot build adds it for Smart Update only: one pinned host, guide data only, and every request listed in an on-screen network log. | One APK cannot keep both promises. Android grants INTERNET at install, and most phones give users no switch to deny it. |
| F2 | "Nothing downloads without a tap," but "the LGU pack downloads automatically." | The LGU pack rides inside the update the user approved. The app may check a tiny manifest automatically (Wi-Fi, at most once a day, can be turned off); downloads always wait for a tap. | Keeps the ask-first promise. |
| F3 | "The profile never leaves the phone," but a DRRM dashboard shows the most-asked questions. | The dashboard is a separate opt-in, off by default. Phones send weekly counts of topic groups only, never question text or profile data. Cells with fewer than 10 households are hidden. | Health and disability details are sensitive personal information under the Data Privacy Act (RA 10173). |
| F4 | Updates "picked by the household profile." | The phone downloads its whole province bundle (tens of KB) and filters by profile on the device. | Otherwise the pack a phone fetches reveals who lives in the house. |
| F5 | Polar for LGU licenses and invoices. | LGUs buy through government procurement (RA 12009): a registered Philippine business, PhilGEPS, official invoices, and at least three quotations for small value procurement. Polar, which pays out to the Philippines through Stripe Connect Express, stays for NGOs, schools and sponsors who pay by card. | LGU purchases follow procurement rules, not card checkouts. |
| F6 | Mentions of "Listahan" and "round one." | Removed. | Leftovers from another idea. |

### 2. Safer answers

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| S1 | The warning picker covers wind signals 1 to 5 **and** rainfall warnings (yellow, orange, red), storm surge warnings and gale warnings. | MVP | Wind signals describe wind only. Kristine (Oct 2024) was a severe tropical storm, a category below typhoon, yet Naga City got over 700 mm of rain in 24 hours, about 2.5 months' worth ([GMA](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story)). |
| S2 | An intent router runs before search. Emergency words show the emergency card; live-data questions ("nasaan na ang bagyo?", "may pasok ba bukas?") get a fixed reply; questions about the family plan are answered from the plan; medicine-dose questions go to the health center. | MVP | Keeps the riskiest questions away from the model. |
| S3 | Hotlines, evacuation centers, names and phone numbers come only from structured data, never from the model. The verifier rejects any number or phone-like string not in the cited passages, including Tagalog and Spanish number words ("labindalawa", "dose"). | MVP | A made-up hotline is worse than none. |
| S4 | Passages tagged `critical` (evacuation, electricity, floodwater, generators, medicine) always show the human-written summary first; the AI text sits below it. | MVP | A life-safety sentence is never only AI-written. |
| S5 | The active warning shows its age. After 3 hours the app asks the user to listen to the radio again. It never computes an arrival time. | MVP | Signals change, and lead times count from the bulletin, not from the tap. |
| S6 | Every passage records who reviewed it and when; the content build fails without it. | MVP (team review), Pilot (LGU DRRMO review) | The content is the product; review is how it earns trust. |

### 3. Fast enough on a budget phone

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| P1 | Answers come in two steps: the matched passage's vetted summary appears in under a second, then the AI answer streams in below it. | MVP | A budget phone may need several seconds just to read a 600-token prompt. The user never waits with nothing on screen. |
| P2 | The output JSON lists `used` and `in_guide` before `answer`, so the answer text can stream while the citation is already known. | MVP | Streaming and citation in one call. |
| P3 | Device tiers decide whether AI runs (rules below). The model is an optional pack; the app is complete without it. | MVP | Many budget phones cannot hold a 0.81 GB model next to the OS. |
| P4 | Search is MiniSearch (BM25+), indexed at startup, so there is no prebuilt index file. Tag boosts use `boostDocument`; fuzzy and prefix matching absorb typos; synonyms list Tagalog verb forms (lumikas, lilikas, paglikas, mag-evacuate, bakwit). One or two passages go to the model, depending on scores. | MVP | Fewer moving parts and shorter prompts. |
| P5 | The fixed instruction prefix is cached (llama.rn `saveSession`/`loadSession`). The model warms up when the Ask screen opens and unloads after 2 minutes idle or when the app goes to the background. | MVP | Less waiting, no new dependencies. |
| P6 | The core logic (router, search, verifier, checklist) is pure TypeScript that also runs in Node, so the 120-question evaluation runs on a laptop in seconds. The phone is for latency, memory and battery numbers. | MVP | Faster iteration in a 10-hour build. |

### 4. More useful for the family

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| U1 | "Ligtas kami" and "Kailangan namin ng tulong" buttons open the phone's SMS app with a message pre-filled from the profile: headcount, who is vulnerable, where the family is. The user presses send; the app needs no SMS permission. | MVP stretch | A one-minute call uses the bandwidth of about 800 short texts ([NC DPS](https://www.ncdps.gov/press-release/governor-mccrory-and-first-lady-encourage-texting-first-communication-between-loved)). *Reasoning:* a short text is the message most likely to get out on a damaged network. |
| U2 | The profile records household size; go-bag amounts multiply the official per-person figures. | MVP stretch | "Tubig para sa 5 tao" is easier to act on than "tubig." |
| U3 | Guide packs are signed files that also travel offline: Bluetooth, Quick Share, Messenger or a barangay laptop. The app checks the signature, not the channel. | MVP stretch, then Pilot | Barangay health workers can spread updates where there is no internet. |
| U4 | Bisaya synonyms in search now; a Cebuano guide becomes the first language pack. | MVP stretch, then Later | Odette's hardest-hit provinces are largely Bisaya-speaking. |
| U5 | Optional livelihood tags (fisherfolk, farmer) for gale warnings and pre-harvest advice. | Later | Coastal and farming households are among the most exposed. |
| U6 | Large text, icons and a dark theme now; read-aloud through the phone's text-to-speech when a Filipino voice is installed. | MVP, then Later (voice) | Elders, low light, low literacy. |

### 5. A sharper business

| # | Change | Why |
| :-- | :-- | :-- |
| B1 | Sell into the Local DRRM Fund: by law at least 5% of an LGU's estimated regular revenue, with 30% of it set aside as the Quick Response Fund (RA 10121, Sec. 21). | The buyer already has a mandated budget line for preparedness. |
| B2 | Tie the pitch to the Seal of Good Local Governance: disaster preparedness is one of the ten areas an LGU must pass (RA 11292; DILG MC 2023-086). | Gives the mayor a reason to care. |
| B3 | Add CSR-sponsored licenses (telcos, electric cooperatives, banks, insurers), credited on the About screen. Never ads. | A second revenue stream that keeps households free. |
| B4 | Model bytes come from Google Play (an AI pack) or a pinned public mirror checked by SHA-256, not from our CDN. Our servers host only KB-size guide packs. | Cost to serve stays near zero. |
| B5 | Report outcomes LGUs care about: the share of pilot households with a packed go-bag and a family plan (before and after survey), not app opens. | Outcomes renew contracts. |

### 6. Family profiles and photos

| # | Change | Release | Why |
| :-- | :-- | :-- | :-- |
| H1 | Setup starts with the main person (the phone's owner), who enters their own details, then adds each family member one by one: name or nickname, relation, age group, needs (pregnant, disability, maintenance medicine), an optional short note such as medicine names, and an optional phone number. Household tags and headcount are derived from these members, so nobody types a headcount. | MVP | Per-person details make the checklist name the person ("gamot ni Lolo Ben") and remove a field families get wrong. |
| H2 | There is no online account. The "family account" is the household profile on this phone: no sign-up, no password, no server copy. | MVP | Keeps the offline and privacy promises (F1, F3). |
| H3 | Each member may have an optional photo, from the camera or the gallery, with a "Laktawan" (skip) button that is always visible. The main person can also take one group photo; the app finds each face and lets the user tap which member it is. | MVP stretch | Photos help families and evacuation-center staff recognize who is missing. |
| H4 | Face detection uses a separate on-device detector, Google ML Kit's bundled face detection model (about 6.9 MB, works offline; [ML Kit](https://developers.google.com/ml-kit/vision/face-detection/android)). It only finds where faces are, to check a photo and crop it. It never recognizes who someone is, compares faces or stores face data. Llama 3.2 1B is text-only and never sees photos. | MVP stretch | The language model cannot read images. The detector is small, offline and limited to cropping. |
| H5 | Photos stay in app-private storage, re-encoded without location metadata, excluded from Android cloud backup, and never go into the model prompt, packs, topic reports, logs or texts. They leave the phone only when the user shares a member's card. | MVP stretch | Photos of children and elders are the most personal data the app holds. |
| H6 | A "Hinahanap" card per member (photo, name, age group, needs, the main person's number, the evacuation center) for showing to rescuers or evacuation staff if someone gets separated, plus a "Bilangan" roll call to tick off who is present when the family evacuates. | MVP stretch, printable in Pilot | Family members get separated during evacuations; a photo card works with no signal. |

**Positioning.** Alerts tell you a storm is coming. Bagyo Buddy tells your household what to do, even with no signal. It complements the free cell-broadcast alerts (RA 10639), PAGASA bulletins, Project NOAH and HazardHunterPH rather than competing with them.

## Shared names

Use these exact names in every doc and, later, in code. Full types are in [api-layer.md](api-layer.md).

**Phases:** `before`, `during`, `after`.

**Warnings** (the "Ano ang narinig mo?" picker)

| Kind | Levels | Meaning |
| :-- | :-- | :-- |
| `tcws` | 1 to 5 | PAGASA Tropical Cyclone Wind Signal |
| `rainfall` | `yellow`, `orange`, `red` | PAGASA heavy rainfall warning |
| `surge` | `yellow`, `orange`, `red` | PAGASA storm surge warning |
| `gale` | on or off | PAGASA gale warning (sea travel, fisherfolk) |

**Profile tags**

- Members: `infant`, `child`, `pregnant`, `senior`, `pwd`, `maintenance_meds`, `pets`
- Home: `near_river`, `near_sea`, `slope`, `low_lying`, `light_materials`, `concrete`, `upper_floor`
- Livelihood (Later): `fisherfolk`, `farmer`

**Family members** (H1). Each `Member` has an `ageGroup` (`infant` under 1, `child` 1 to 12, `teen` 13 to 17, `adult` 18 to 59, `senior` 60 and over), a `relation` (`self` for the main person, `spouse`, `child`, `parent`, `grandparent`, `grandchild`, `sibling`, `relative`, `other`) and `needs` (`pregnant`, `pwd`, `maintenance_meds`). The household's member tags are derived: `infant`, `child` and `senior` from age groups; `pregnant`, `pwd` and `maintenance_meds` from needs; `pets` from the pet count. A photo's `faceCheck` is `one_face`, `no_face`, `many_faces` or `skipped`.

**Hazard tags:** `wind`, `flood`, `surge`, `landslide`, `electrical`, `water`, `health`, `fire`.

**Topic groups** (refusal suggestions and opt-in reports): `signals`, `go_bag`, `home_prep`, `evacuation`, `flood`, `surge`, `landslide`, `infant`, `senior`, `pregnancy`, `disability`, `pets`, `water_food`, `electrical`, `generator_fire`, `cleanup`, `health_after_flood`, `out_of_guide`.

**Checklist groups:** `now` ("Gawin ngayon"), `go_bag`, `home`, `evacuate`, `after`.

**Bundled content files** (`content/`): `guide.tl.json`, `checklist.json`, `warnings.json`, `synonyms.json`, `intents.json`, `sources.json`, `hotlines.json`, and `places.json` (PSGC list, Pilot). LGU packs add `evacuation_centers.json`, `advisories.json` and `hazard_notes.json` (Pilot). The model file is `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (0.81 GB).

**Modules.** The pure core lives in `src/core/` with no React Native imports: `normalize`, `route`, `createIndex`, `search`, `gate`, `buildPrompt`, `verify`, `buildChecklist`, `verifyPack`. Services live in `src/services/`: `ModelManager`, `PowerPolicy`, `Store`, `PackManager`, `ShareService`, `UpdateClient` (Pilot), `TopicReporter` (Pilot). The `ask()` orchestrator, built with `createAsk(deps)` so tests can pass fakes, emits `AnswerEvent`s. Screens talk only to the `Engine` facade in `src/engine/` (`createEngine()`, plus `createMockEngine()` so the UI can start before the engine exists). That facade is the frontend–backend boundary; [api-layer.md, section 3](api-layer.md#3-frontendbackend-handoff) has the full handoff.

**Routes:** `emergency` (a flag that can combine with another route), `live_data`, `plan`, `medical_dose`, `guide`.

**Answer events:** `emergency_card`, `fixed_reply`, `plan_answer`, `refusal`, `summary`, `ai_status`, `ai_partial`, `ai_final`, `ai_rejected`, `closing`, `done`.

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
- Stale-warning prompt after 3 hours.
- Context 1,024 tokens; output at most 110 tokens; temperature 0.2.
- Dashboard cells hidden below 10 households.
- Summary on screen in ≤ 1 s. First AI words in ≤ 5 s and the full AI answer in ≤ 10 s, median on a 4 GB phone. v1's 6-second full answer stays the stretch goal.

**Updates and packs.** A pack file is `*.bagyopack`. CDN paths: `/v1/keys.json`, `/v1/core/manifest.json`, `/v1/areas/{provinceCode}/manifest.json`, `/v1/blobs/{sha256}.json.gz`, `/v1/model/manifest.json`. Manifests are signed with Ed25519 over RFC 8785 canonical JSON. Place codes are PSGC codes.

**On-device stores (MMKV keys):** `profiles` (members included), `activeProfileId`, `context`, `checklist:{profileId}`, `rollcall:{profileId}`, `questionLog`, `settings`, `packs`, `networkLog` (Pilot), `topicCounts` (Pilot).

**Fixed Tagalog copy**

| Key | Text |
| :-- | :-- |
| Phase buttons (`before`, `during`, `after`) | "Bago ang bagyo", "Habang may bagyo", "Pagkatapos ng bagyo" (short forms: "Bago", "Habang", "Pagkatapos") |
| Warning picker title | "Ano ang narinig mo?" |
| Closing line on every answer | "Sundin ang utos ng barangay at ng mga awtoridad." |
| Refusal | "Wala ito sa gabay." |
| Source link | "Saan galing ito?" |
| No live data | "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Stale warning | "Makinig muli sa radyo. Baka nagbago na ang signal." |
| Photo consent line (draft) | "Siguraduhing pumayag ang tao bago kunan ng litrato." |
| Photo is optional (draft) | "Hindi kailangan ang litrato. Puwedeng laktawan." |
| Medicine-dose reply (draft) | "Hindi nagbibigay ng dosis ng gamot ang app. Magtanong sa Health Center o sa doktor." |

## Glossary

| Term | Meaning |
| :-- | :-- |
| Bagyo | Typhoon or tropical cyclone (Tagalog and Bisaya) |
| Barangay | The smallest unit of local government; it issues local evacuation orders |
| LGU | Local government unit: province, city, municipality or barangay |
| DRRMO | An LGU's Disaster Risk Reduction and Management Office; our buyer |
| LDRRMF, QRF | Local DRRM Fund (at least 5% of regular revenue); its 30% Quick Response Fund |
| NDRRMC, OCD | National DRRM Council; the Office of Civil Defense, its secretariat and executive arm |
| PAGASA | The national weather agency, under DOST |
| TCWS | Tropical Cyclone Wind Signal, levels 1 to 5 |
| PHIVOLCS | The volcano and earthquake institute; runs HazardHunterPH |
| DOH, BFP, DILG | Department of Health; Bureau of Fire Protection; Department of the Interior and Local Government |
| BHW | Barangay health worker |
| PSGC | Philippine Standard Geographic Code: official codes for regions, provinces, cities, municipalities and barangays |
| SGLG | Seal of Good Local Governance (RA 11292) |
| ECBS | Emergency Cell Broadcast System: free disaster alerts to phones (RA 10639) |
| PhilGEPS, SVP | The government e-procurement system; small value procurement |
| Taglish, Bisaya | Tagalog mixed with English; Cebuano and related Visayan languages |
| Go-bag | A bag packed ahead, ready to grab when evacuating |
| Gabay, lumikas, ligtas, tulong | Guide, evacuate, safe, help |
| Ambon, Bantay | Free household tier ("drizzle"); paid LGU tier ("watch") |
| Pack | A signed bundle of guide data: core, area (LGU), language or model |
