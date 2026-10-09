# Solution: Bagyo Buddy

Bagyo Buddy turns the warning a family hears on the radio into steps fitted to their household. It answers their Taglish questions only from official guides that ship inside the app, and it works with no signal.

Related: [README.md](README.md) (v2 decisions and shared names) · [problem.md](problem.md) · [system-design.md](system-design.md) · [api-layer.md](api-layer.md) · [BMC.md](BMC.md)

## 1. One-liner and pitch

**One-liner.** Tap the warning you heard on the radio and see what your household should do now, even with no signal.

**30-second pitch.** When a typhoon takes out power and signal, the guidance a family needs is online or buried in a long PDF. Bagyo Buddy puts it on the phone. The family sets up a profile once: who is at home, what kind of house it is, and whether a river or the sea is close. During the storm they tap the warning they heard (wind signal, rainfall, storm surge or gale) and get a checklist for their household. They can ask "kailangan na ba naming lumikas kung malapit kami sa ilog?" and get a short answer drawn only from PAGASA, NDRRMC, OCD and DOH guidance, with the source one tap away. A small model on the phone puts the answer in plain words. When the battery runs low, the app keeps working without it. Alerts tell you a storm is coming. Bagyo Buddy tells your household what to do, even with no signal.

## 2. Design principles

These seven rules hold in every release. When a feature conflicts with one, the rule wins.

| # | Principle | What it means in practice |
| :-- | :-- | :-- |
| 1 | Works offline from install | The guide, checklists and warning meanings ship in the app. The MVP APK has no INTERNET permission. The Pilot build adds it for the opt-in Smart Update only (README F1). |
| 2 | The guide is the product; the model only rephrases it | The model reads only the one or two passages that search found. It never answers from its own memory. If search finds no good passage, the model is never called. |
| 3 | Safety is enforced by code | Emergency words, live-data questions, medicine doses, numbers, phone numbers and the closing line are handled by code rules, not by the prompt. |
| 4 | Every answer shows its source | "Saan galing ito?" opens the passage with its agency, document and date. |
| 5 | Useful without AI | Checklists, warning cards, guide search and vetted summaries all work with the model off: in low-battery mode, on phones too small for it, or when the user turns it off. |
| 6 | The profile never leaves the phone | No account, no analytics, no location permission, no background services. |
| 7 | Honest about limits | The app has no live storm data, makes no forecasts and dispatches no rescue. It says so, and points to PAGASA bulletins, the barangay and emergency hotlines. |

## 3. How the family uses it

There are three phases. Setup takes a few minutes on a calm day. The other two phases work with no signal at all.

### Before the storm (setup, once)

1. **Install.** Get the app from Google Play, or from a copy shared by the barangay (Pilot). The guide ships inside the app. The model is an optional pack: a sideloaded file for the hackathon and a Google Play AI pack later ([Play for On-device AI](https://developer.android.com/google/play/on-device-ai)). Phones in the `none` tier skip the model and lose only the AI wording.
2. **Set up the family, starting with the main person** (README H1 to H5). There is no sign-up and no password; everything stays on this phone.
   - **The main person first.** Name or nickname, age group, needs, phone number. Their relation is "self", and their number goes on every member's card.
   - **Then each member, one at a time.** Name or nickname (required), relation (asawa, anak, magulang, lolo o lola, apo, kapatid, kamag-anak, iba pa), age group (sanggol, bata, teen, adult, senior), needs (buntis, may kapansanan, may maintenance na gamot), an optional note of up to 80 characters such as medicine names or allergies, and an optional phone number. A family of five takes about two minutes of taps.
   - **An optional photo per member (MVP stretch).** "Kunan ng litrato" opens the camera and asks for camera permission only at that moment; "Pumili sa gallery" uses the phone's own photo picker. "Laktawan" is always visible. On-device face detection checks there is one face and crops to it. If it finds no face, the user can still keep the photo and crop it by hand.
   - **Or one group photo (MVP stretch).** The main person takes a single family picture. The app finds each face and shows the crops, and the user taps a name under each one. Unused crops and the original are deleted.
   - **Pets and home.** Pet count; home near a river, near the sea, on a slope, low-lying, light materials or concrete, upper floor available.
   - **Area.** Province and municipality, picked from a list with no GPS (Pilot). LGU packs need it.
   - The household's tags and headcount come from the members, so the checklist says "Ilagay sa go-bag ang maintenance na gamot ni Lolo Ben" instead of a generic line.
3. **Family plan.** Enter the nearest evacuation center, a meeting place and emergency contacts. In the MVP the center is typed in; in the Pilot it is picked from the LGU's list.
4. **Go-bag checklist.** The app shows a go-bag list fitted to the profile, and the family ticks items as they pack. With a headcount, water and food amounts multiply the per-person figures from the cited guide (MVP stretch).

### During the storm

1. The parent hears on the radio: "Signal No. 3 sa inyong lugar," and maybe an orange rainfall warning. They open **"Ano ang narinig mo?"** and tap what they heard. More than one warning can be active.

   | Warning | Levels | What the card says | Source |
   | :-- | :-- | :-- | :-- |
   | Wind signal | 1 to 5 | Wind range and lead time, from 39 to 61 km/h within 36 hours (Signal 1) to 185 km/h or more within 12 hours (Signal 5) | [PAGASA](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) |
   | Rainfall | yellow, orange, red | 7.5 to 15, 15 to 30, and over 30 mm of rain in an hour; it goes from "flooding possible" to "evacuate" | [Varsitarian](https://varsitarian.net/sci-tech/20250724/explainer-how-do-pagasas-rainfall-warnings-and-weather-advisories-work), [Inquirer](https://newsinfo.inquirer.net/654913/pagasas-color-coded-warnings/amp); confirm with PAGASA |
   | Storm surge | yellow, orange, red | Recent bulletins: about 1 to 2 m, 2.1 to 3 m, and above 3 m. **Unverified**: the bands have changed since 2015, so confirm with PAGASA | [ABS-CBN](https://www.abs-cbn.com/news/2024/11/15/storm-surge-warning-up-in-areas-on-typhoon-pepito-s-path-2110) |
   | Gale | on or off | What the gale warning means for boats and fisherfolk | Passage still to be written from PAGASA |

2. **Warning card, no model.** For Signal 3, the card shows PAGASA's meaning: winds of 89 to 117 km/h expected within 18 hours. It also says plainly that a signal describes wind, not rain, and that floods can come at any signal level.
3. **"Gawin ngayon."** The app shows the top items for this household right now, then the full checklist. For example: secure the roof and windows, charge power banks, prepare the infant's milk and diapers, move the senior's medicines into the go-bag, and be ready to leave when the barangay says.
4. **Ask in Taglish:** "kailangan na ba naming lumikas kung malapit kami sa ilog?"
   - In under a second, the vetted one-sentence summary of the best-matching passage appears.
   - The AI answer then streams in below it: 2 to 4 short Tagalog sentences, fitted to the household.
   - **"Saan galing ito?"** opens the full passage with its agency, document and date.
   - Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad."
5. **Emergency words.** Words like "lumulubog", "may naipit" or "hindi makahinga" show the emergency card first: move to higher ground, and call the barangay or an emergency hotline from the stored list. The answer follows.
6. **Texts that get out.** "Ligtas kami" and "Kailangan namin ng tulong" open the phone's SMS app with a message built from the profile: the headcount, who is vulnerable and where the family is. The user presses send (MVP stretch). A one-minute call uses the bandwidth of about 800 short texts ([NC DPS](https://www.ncdps.gov/press-release/governor-mccrory-and-first-lady-encourage-texting-first-communication-between-loved)).
7. **Leaving for the evacuation center (MVP stretch).** "Bilangan" lists every member with their photo; the parent ticks each one as present before leaving and again on arrival. If someone is missing, their "Hinahanap" card shows the photo, name, age group, needs, the main person's number and the family's evacuation center, full screen, ready to show rescuers or evacuation staff with no signal.
8. **Stale warning.** Three hours after a warning is set, the app shows "Makinig muli sa radyo. Baka nagbago na ang signal." It never says when the wind will arrive, because PAGASA's lead times count from the bulletin, not from the tap.

### After the storm

1. Tap **"Pagkatapos ng bagyo"** for the post-storm checklist: check the house, check electrical safety before turning the power back on, use generators and candles safely, find safe drinking water and stay out of floodwater.
2. Ask questions like "pwede bang inumin ang tubig sa gripo?" or "paano linisin ang bahay na binaha?" Answers come only from the guide. A question about a wound or fever after wading in floodwater gets the guide's leptospirosis warning signs and a pointer to the health center. A question about medicine doses goes straight to the health center.
3. The power is out and the battery is low. Below 15%, or whenever the phone's battery saver is on, the model stays off. Checklists, warning cards, guide search and summaries keep working.

## 4. Screens

| Screen | What it holds | Release |
| :-- | :-- | :-- |
| Family setup | The main person's details, then each member; pets, home, area; more than one household (Pilot) | MVP |
| Member editor | Name, relation, age group, needs, note, phone; photo buttons | MVP (photo: MVP stretch) |
| Photo and crop | Camera or gallery, face check, crop preview, "Laktawan"; group photo with a name under each face | MVP stretch |
| Family cards | "Bilangan" roll call and each member's "Hinahanap" card | MVP stretch |
| Home | Phase (Bago, Habang, Pagkatapos), the "Ano ang narinig mo?" picker, active warnings and their age | MVP |
| Checklist | Warning cards, "Gawin ngayon", go-bag items, ticks, progress | MVP |
| Ask | Question box, instant summary, streamed AI answer, "Saan galing ito?", topic buttons on refusal | MVP |
| Emergency card | First steps, hotlines from stored data | MVP |
| Plan and texts | Evacuation center, meeting place, contacts, "Ligtas kami" texts (MVP stretch), printable plan (Pilot) | MVP |
| Guide topics | Browse passages by topic group, without the model | MVP |
| About | Guide date, sources, reviewers, "Built with Llama", network log (Pilot) | MVP |
| Settings | AI on or off, low-battery threshold, update settings (Pilot), topic-sharing opt-in (Pilot) | MVP |
| Evaluation | Retrieval, refusal, faithfulness and latency numbers on this phone | MVP (for the demo) |

## 5. Features by release

| Feature | Release | Notes |
| :-- | :-- | :-- |
| Household profile and family plan | MVP | One household in the MVP |
| Main person first, then members with per-person details; tags and headcount derived | MVP | README H1, H2 |
| Optional member photo or group photo, with on-device face detection and crop | MVP stretch | README H3 to H5 |
| "Bilangan" roll call and "Hinahanap" member cards | MVP stretch | README H6; printable cards in the Pilot |
| Warning picker: wind, rainfall, storm surge, gale | MVP | README S1 |
| Household checklists without the model | MVP | Filtered by phase, warnings and profile tags |
| Ask in Taglish: summary first, AI second | MVP | P1, P2 |
| "Saan galing ito?" sources | MVP | |
| Intent router: emergency, live data, plan, medicine dose | MVP | S2 |
| Verifier for citations, numbers and phone numbers; critical summaries pinned | MVP | S3, S4 |
| Stale-warning prompt | MVP | S5 |
| Reviewer and review date on every passage | MVP | S6; LGU DRRMO review in the Pilot |
| Low-battery mode, device tiers, model load and unload | MVP | P3, P5 |
| Large text, icons, dark theme | MVP | U6 |
| About and evaluation screens | MVP | |
| No INTERNET permission in the APK | MVP | F1 |
| "Ligtas kami" and "Kailangan namin ng tulong" texts | MVP stretch | U1 |
| Go-bag amounts by headcount | MVP stretch | U2 |
| Bisaya synonyms in search | MVP stretch | U4 |
| Import a signed pack from a file | MVP stretch | U3 |
| Smart Update: asks first, Wi-Fi by default, network log | Pilot | F1, F2, F4 |
| LGU pack: evacuation centers, hotlines, advisories | Pilot | The paid Bantay tier ([BMC.md](BMC.md)) |
| Sharing signed packs phone to phone | Pilot | U3 |
| Multiple profiles and a printable family plan | Pilot | From the v1 overview |
| Opt-in topic reports and the DRRM dashboard | Pilot | F3 |
| Cebuano guide | Later | U4 |
| Livelihood tags and packs (fisherfolk, farmer) | Later | U5 |
| Read-aloud with the phone's Filipino voice | Later | U6 |
| Embedding search for paraphrases | Later | |
| iOS | Later | |

## 6. What makes it different

| Option | What it does well | What Bagyo Buddy adds |
| :-- | :-- | :-- |
| Cell-broadcast alerts ([RA 10639](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)) | Free alerts to every phone in the area | What this household should do next, even after the tower goes down |
| PAGASA bulletins | The official forecast and warnings | Turns the warning the family heard into steps for their household |
| PDF and printed guides | Official and complete | Search in your own Taglish words; two to four sentences instead of pages |
| Online AI chatbots | Conversational | Works offline, answers only from official text, shows the source |

Offline preparedness guides and PAGASA bulletins already exist. The new part is asking in your own Taglish words and getting an answer fitted to your household, without signal. Pitch it as that, not as a forecasting tool. The evidence and the full comparison are in [problem.md](problem.md).

## 7. The guide content

The guide is the product's real asset: about 300 short, tagged passages rewritten from official Philippine sources, each traceable to its origin. The MVP ships the 120 most demo-critical passages and says so. Writing them well matters more than any prompt.

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
| Health after floods | Wounds, leptospirosis warning signs, when to seek care | DOH advisories |
| Gale guidance for fisherfolk (Later) | When small boats should stay ashore | PAGASA |

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

1. **Collect.** List each official document in `sources.json` before writing from it.
2. **Write.** Rewrite it into passages. Never write a number from memory: every number must appear in the source.
3. **Tag and summarize.** Add tags, the one-sentence summary and the `critical` flag.
4. **Review.** A second teammate checks each passage against its source and fills in `reviewed_by` and `reviewed_at` (MVP). In the Pilot, the LGU's DRRMO also reviews the core guide and owns its local pack.
5. **Validate.** The build script checks required fields, word counts, source links and unique IDs. It also checks that every number in a summary appears in its passage text.
6. **Ship.** The About screen shows the guide date and the reviewers.

## 8. Safety rules as the user sees them

Code enforces every rule below, not the prompt. How it works is in [system-design.md](system-design.md).

| When the user... | The app... |
| :-- | :-- |
| Asks something the guide does not cover | Shows "Wala ito sa gabay." with the closest topics as buttons. The model is not called. |
| Asks where the storm is, whether classes are suspended or when power returns | Shows "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Types emergency words | Shows the emergency card first, then the answer |
| Asks about medicine doses | Points to the health center or emergency hotlines, without the model |
| Asks about the family's evacuation center or contacts | Answers from the family plan or the LGU pack, not from the model |
| Asks about a critical topic | Sees the vetted summary first, with the AI text below it |
| Gets an AI answer that fails a check | Sees the vetted summary instead |
| Reads any answer | Sees "Sundin ang utos ng barangay at ng mga awtoridad." at the end |
| Leaves a warning set for hours | Sees "Makinig muli sa radyo. Baka nagbago na ang signal." after 3 hours |

The About screen states that Bagyo Buddy is a preparedness aid, not an emergency service.

## 9. Live demo (about 4 minutes, budget phone mirrored to the projector)

1. **Two storms (30 s).** On day one of Odette (Dec 2021), mobile service was disrupted in [369 areas](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette) and [281 cities and towns lost power](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc). Kristine (Oct 2024) was only a severe tropical storm, yet it dropped [over 700 mm of rain on Naga City in 24 hours](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story). Turn on airplane mode.
2. **Family (30 s).** Show the family set up by the main person: an infant, a senior on maintenance medicine with a photo, and a house near a river. If the photo stretch is done, take one group photo and tap a name under each detected face.
3. **A low signal that still floods (30 s).** Tap Signal 1 and orange rainfall. The cards explain that the signal is about wind, and that orange rain near a river means getting ready to evacuate.
4. **Checklist (30 s).** Tap During and Signal 3. PAGASA's meaning (89 to 117 km/h within 18 hours) and a checklist with the infant's and the senior's items appear instantly.
5. **Ask (60 s).** Ask "kailangan na ba naming lumikas kung malapit kami sa ilog?" The vetted summary appears at once, and the AI answer streams in below it. Tap "Saan galing ito?" to show the passage, agency and date.
6. **No live data (15 s).** Ask "saan na ang bagyo ngayon?" The fixed reply says the app has no live data and to listen to PAGASA or ask the barangay.
7. **Emergency (15 s).** Type "lumulubog na ang bahay namin." The emergency card appears first.
8. **Low battery (20 s).** Switch on low-battery mode and ask again. The summary appears with no model.
9. **Close (20 s).** Show the evaluation screen: retrieval hit rate, correct refusals, faithfulness and median latency on this phone.

Keep a recorded video of the same run as a backup.

## 10. The 10-hour build plan

There are four tracks, one person each. The core logic is pure TypeScript (README P6), so search, routing and evaluation can be built and tested on a laptop while the app is still taking shape.

| Hours | App | AI | Content | Search + Eval |
| :-- | :-- | :-- | :-- | :-- |
| 0 to 1 | Expo development build with llama.rn running on the target phone | Model loads; schema-valid JSON; tokens stream; prompt and generation speed measured | Official documents listed in `sources.json`; tag list agreed | First 40 evaluation questions with their expected passage IDs |
| 1 to 4 | Profile, warning picker and checklist screens from `checklist.json` and `warnings.json` | Prompt; schema with `used` and `in_guide` before `answer`; prefix cache; Q4_K_M vs Q4_0; device tier check | The 30 demo-critical passages first, then on toward 120; checklist items; `warnings.json` | `normalize`, synonyms, MiniSearch with tag boosts, `gate`; the Node evaluation runner |
| 4 to 7 | Ask screen (summary first, streaming, "Saan galing ito?"), emergency card, refusal with topic buttons, low-battery mode | `verify` (citations, numbers including Tagalog number words, phone numbers), critical pinning, fallbacks, load, warm-up and unload | Finish passages, summaries, critical flags and reviews | Intent router rules; all 120 questions; tune the gate threshold; first metrics |
| 7 to 9 | About and evaluation screens; polish; remove the INTERNET permission; stretch: "Ligtas kami" texts, member photos with face crop, "Bilangan" and "Hinahanap" | Latency, RAM and battery numbers on the phone | Fix the passages the evaluation flags; stretch: Bisaya synonyms | Final metrics; blind test with 3 to 5 outsiders |
| 9 to 10 | Everyone: rehearse the demo twice and record the backup video | | | |

**Sync points**

- **Hour 1:** the model runs on the phone, its speed is known and the tag list is frozen.
- **Hour 4:** one question goes end to end on the phone: route, search, summary, AI answer.
- **Hour 7: feature freeze.** Every MVP row is done or cut. MVP stretch items (README U1 to U4) start only if every MVP row is green.
- **Hour 9:** code freeze; the release APK is built.

**With three people.** The AI owner also takes search (`normalize`, MiniSearch, `gate`). The Content owner also writes the evaluation questions. Whoever is free first after hour 4 builds the Node evaluation runner.

**With two people.** One person takes the App track (frontend). The other takes AI and Search + Eval (backend). They meet at the `Engine` facade, and the frontend builds every screen against the mock engine from hour 1 ([api-layer.md, section 3](api-layer.md#3-frontendbackend-handoff)). Content is split: the backend person writes passages, and the frontend person writes checklist items and warning-card text. Write the 30 demo-critical passages first and add more only if time allows.

**Out of scope for the hackathon:** live storm tracking, location features, maps, push alerts, the Smart Update server, the LGU portal, the DRRM dashboard, payments, languages beyond Tagalog and English (Bisaya synonyms are a stretch), an embedding model, iOS, and the full 300-passage guide (ship 120 and say so).

## 11. Evaluation

Test retrieval and refusal separately from answer quality, because a wrong passage guarantees a wrong answer no matter how good the model is.

### The set

- 80 in-scope questions written by the team in Taglish, each labeled with the passage IDs that answer it.
- 25 out-of-scope questions, at least 10 of them about live data ("saan na ang bagyo?", "may pasok ba bukas?", "kailan babalik ang kuryente?"), plus others such as "magkano ang bigas?".
- 15 questions with emergency wording.
- 20 of the in-scope questions rephrased by 3 to 5 people outside the team, so the test is not only our own wording.
- 10 test household profiles, each with the checklist items it must include. For example, a profile with `infant` must get milk and diapers, and a member with `maintenance_meds` must appear by name on the medicine item.
- 8 test photos for the face check (MVP stretch): no face, one face, three faces, a dark photo, a rotated photo, a child, an elder, and one carrying GPS metadata that must be gone after saving.

### Metrics and targets

| Metric | Target (proposal) | How measured |
| :-- | :-- | :-- |
| Retrieval hit@2 | ≥ 85% of in-scope questions | A labeled passage is in the top two; Node runner |
| Correct refusal | ≥ 90% of out-of-scope questions | No AI answer shown: a refusal or a fixed reply instead |
| Emergency trigger | 100% of the 15 emergency questions | The emergency card appears first |
| Live-data fixed reply | ≥ 95% of live-data questions | The fixed reply, not a guide answer |
| Faithfulness | ≥ 90% of shown AI answers | Two teammates check each answer against its passages: no added facts, no flipped instructions |
| Number and phone check | 100% of shown answers | Code rule; any failure falls back to the summary |
| Checklist tailoring | 100% of required items | The 10 test profiles; Node runner |
| Summary on screen | ≤ 1 s median | Logged on the 4 GB phone |
| First AI words | ≤ 5 s median | Logged on the 4 GB phone |
| Full AI answer | ≤ 10 s median; 6 s stretch | Logged on the 4 GB phone |
| Checklist render | < 0.5 s | Logged on device; no model involved |
| Peak RAM | ≤ 1.2 GB | Android Studio profiler |

Retrieval, refusal, routing and tailoring run on a laptop in seconds. Latency, RAM and battery come only from the phone.

**The blind test.** Show people outside the team the same answers in two forms: summary only, and summary plus AI. Put the numbers side by side for the judges. *Reasoning:* if people prefer summary plus AI, that is the evidence that the local model adds value beyond a static guide. If they do not, ship summary-first and say so honestly.

## 12. Risks and fallbacks

| Risk | Fallback |
| :-- | :-- |
| Writing good passages takes longer than planned | Start with the 30 passages the demo touches; label the rest as roadmap |
| Keyword search misses paraphrases | Grow `synonyms.json` from evaluation misses; show topic buttons on refusal |
| The model adds facts not in the passage | Number and phone checks, pinned critical summaries, fallback to the summary; faithfulness shown on the evaluation screen |
| A 1B model writes weak Tagalog. Tagalog is not among Llama 3.2's [official languages](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) | Benchmark Qwen3 1.7B or 0.6B, which [lists Tagalog and Cebuano](https://qwenlm.github.io/blog/qwen3/), if hackathon rules allow; otherwise ship summary-first |
| Answers are slow on budget phones | Summary first; device tiers; one passage on `lite`; passages near 100 words; output capped at 110 tokens; test Q4_0 |
| The user taps the wrong warning | Cards quote PAGASA's meaning so it can be checked against the radio; Home shows each active warning and its age |
| Old warnings stay active | The stale-warning prompt after 3 hours |
| Errors in the content | A source and locator on every passage, two-person review, the guide date on About; DRRMO review in the Pilot |
| Judges ask "why not just a PDF?" | Show a Taglish question answered in two sentences fitted to the household, against scrolling a long guide |
| Liability for safety advice | Every answer cites an official source and ends with the closing line; the app states it is a preparedness aid, not an emergency service |
| Commercial reuse of government text | Keep the household app free and credited; seek agency approval before any paid license (section 7) |
| Photos of family members, including children, leak | Photos are optional, stay in app-private storage without location metadata, are excluded from cloud backup, and never reach the model, packs, reports or logs; one tap deletes a photo or all photos ([system-design.md](system-design.md)) |
| People think the app "recognizes" faces | The setup screen says it only finds a face to crop the photo; there is no recognition or face matching |
| Face detection adds size and a native module late in the build | It is MVP stretch; without it, photos still work with a manual crop |
| LGU account misuse (Pilot) | Structured fields only, two-person approval (author and approver), signing by the platform |
| Slow procurement (Pilot) | Start with pilots small enough for small value procurement; see [BMC.md](BMC.md) |

## 13. Roadmap

| Stage | When | Scope |
| :-- | :-- | :-- |
| Hackathon (MVP) | The 10-hour build | The offline core: profile, warnings, checklists, summary-first Q&A, safety router and verifier, low-battery mode, 120 passages, evaluation |
| Pilot | 1 to 2 barangays or one municipality, before the next typhoon season | Smart Update, the LGU pack (evacuation centers, hotlines, advisories), sharing signed packs, multiple profiles, a printable plan, opt-in topic reports and the DRRM dashboard, DRRMO content review, the full 300-passage guide |
| Later | After the first season | A Cebuano guide, livelihood packs, read-aloud, embedding search, iOS |

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
- [NC DPS: a one-minute call uses the bandwidth of 800 texts](https://www.ncdps.gov/press-release/governor-mccrory-and-first-lady-encourage-texting-first-communication-between-loved)
- [Google Play for On-device AI (beta)](https://developer.android.com/google/play/on-device-ai)
- [ndvlaw: RA 8293 Section 176, works of the government](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)
- [Meta Llama 3.2 1B Instruct model card](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)
- [Qwen3 announcement and language list](https://qwenlm.github.io/blog/qwen3/)
