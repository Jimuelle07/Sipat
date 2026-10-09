# Features: Bagyo Buddy

Every feature the app offers or plans to offer, grouped by area and tagged by release (MVP, MVP stretch, Pilot, Later). This catalog is drawn from [solution.md](solution.md) sections 3 to 5 and 8; where they disagree, solution.md wins. Data shapes are in [api-layer.md](api-layer.md); how each feature works is in [system-design.md](system-design.md).

**Release tags.** **MVP (core)** marks the rows the demo and the offline promise depend on; build these first. **MVP** rows come next, once the core works end to end. **MVP stretch** starts only when every MVP row is green (hour 7 feature freeze, [solution.md](solution.md) section 10). If time runs short, cut plain MVP rows before core rows.

## 1. Household and family setup

| Feature | Release | Details |
| :-- | :-- | :-- |
| No account, no sign-up | MVP (core) | No password; everything stays on this phone |
| Main person first | MVP (core) | Name or nickname, age group, needs, phone number; relation "self"; their number goes on every member card |
| Per-member details | MVP (core) | Name (required), relation (asawa, anak, magulang, lolo o lola, apo, kapatid, kamag-anak, iba pa), age group (sanggol, bata, teen, adult, senior), needs (buntis, may kapansanan, may maintenance na gamot), note up to 80 characters, optional phone |
| Pets and home | MVP (core) | Pet count; near a river, near the sea, on a slope, low-lying, light materials or concrete, upper floor available |
| Derived tags and headcount | MVP (core) | Checklists name people, e.g. "Ilagay sa go-bag ang maintenance na gamot ni Lolo Ben" |
| Member photo | MVP stretch | "Kunan ng litrato" (camera permission asked only then), "Pumili sa gallery", "Laktawan" always visible; on-device face detection checks one face and crops; manual crop if no face found |
| Group photo | MVP stretch | One family picture; app finds each face, user taps a name under each crop; unused crops and the original are deleted |
| Area by PSGC list | Pilot | Province and municipality picked from a list, no GPS; needed by LGU packs |
| Multiple households | Pilot | More than one profile on one phone |
| Per-member medicine list | Pilot | Builds on the member note: each medicine as its own line with a "nakaimpake na?" tick on the go-bag list. Names only; the app never shows doses |

## 2. Family plan and hotlines

| Feature | Release | Details |
| :-- | :-- | :-- |
| Evacuation center, meeting place, emergency contacts | MVP | Center typed in for the MVP; picked from the LGU list in the Pilot. Up to 5 contacts |
| Hotlines list | MVP | National hotlines from `hotlines.json`, each with a call button that opens the dialer. Rendered from data, never from the model; every hotline carries a source and a verified date. The Pilot adds the LGU's hotlines |
| "Ligtas kami" and "Kailangan namin ng tulong" texts | MVP stretch | Opens the phone's SMS app with headcount, who is vulnerable and location; the user presses send. Member names and notes are never included |
| Printable family plan and go-bag list | MVP stretch | Plan, contacts, hotlines and the go-bag list as one page to print or save as an image. *Reasoning:* paper still works after the phone's battery dies. Moved up from Pilot |

## 3. Warnings ("Ano ang narinig mo?")

| Feature | Release | Details |
| :-- | :-- | :-- |
| Warning picker | MVP (core) | Wind signal 1 to 5, rainfall (yellow, orange, red), storm surge (yellow, orange, red), gale (on or off); several can be active at once |
| Barangay evacuation order | MVP | "Pinapalikas na kami ng barangay" as its own choice in the picker. When set, the evacuate checklist group comes first and "Gawin ngayon" leads with leaving. Its wording must come from a reviewed source; it never says the order is mandatory or optional unless the source does |
| Warning cards without the model | MVP (core) | Official meaning from the cited source; states that a signal describes wind, not rain, and that floods can come at any level. Unconfirmed thresholds show "(i-check sa PAGASA)" |
| Active warnings and their age on Home | MVP (core) | Each active warning shows as a chip with the time it was set ("Signal No. 3 · 2 oras na"); tapping a chip opens its card or clears it |
| Stale-warning prompt | MVP (core) | After 3 hours: "Makinig muli sa radyo. Baka nagbago na ang signal." Never predicts wind arrival time. Applies to each stale warning, not only the first |
| "Pareho pa rin" | MVP | A button on the stale prompt that keeps the warning and resets its age, after the user has checked the radio |
| Undo after "Pagkatapos" | MVP | Tapping "Pagkatapos" clears every warning; an undo bar ("Ibalik ang mga babala") stays for a few seconds so one wrong tap does not lose them |

## 4. Checklists

| Feature | Release | Details |
| :-- | :-- | :-- |
| Phases | MVP (core) | Bago, Habang, Pagkatapos ng bagyo |
| "Gawin ngayon" | MVP (core) | Top items for this household right now, then the full list |
| Household-fitted checklists | MVP (core) | Filtered by phase, active warnings and profile tags; no model needed |
| Go-bag checklist with ticks and progress | MVP (core) | Ticks are saved per household and survive restarts; a progress bar shows done out of total; a reset clears ticks for a new season |
| Post-storm checklist | MVP | House check, electrical safety, generators and candles, safe water, avoiding floodwater |
| Quick "Ano ang gagawin ngayon?" button on Home | MVP stretch | One tap shows the top three "Gawin ngayon" items for the current phase and warnings, with no typing |
| Go-bag "last checked" date | MVP stretch | Shows when the go-bag was last ticked through and suggests checking it again before the season. *Reasoning:* medicines, food and batteries can expire between storms. Shown when the app opens; no notifications or background work |
| Go-bag amounts by headcount | MVP stretch | Multiplies per-person figures from the cited guide |
| "Ligtas na ba?" return-home checklist | Pilot | A focused list for going back home after evacuating, drawn only from reviewed passages (house damage, electricity, water, floodwater) |

## 5. Ask in Taglish

| Feature | Release | Details |
| :-- | :-- | :-- |
| Summary first | MVP (core) | Vetted one-sentence summary of the best passage in under a second |
| AI answer second | MVP (core) | Llama 3.2 1B on the phone streams 2 to 4 short Tagalog sentences fitted to the household, grounded only in retrieved passages |
| "Saan galing ito?" | MVP (core) | Full passage with agency, document and date |
| Closing line | MVP (core) | Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad." |
| Refusal with topic buttons | MVP (core) | "Wala ito sa gabay." plus the closest topics; model not called |
| Taglish synonyms and tag boosts in search | MVP (core) | MiniSearch BM25+ |
| Bisaya synonyms in search | MVP stretch | |
| Embedding search for paraphrases | Later | |

## 6. Safety (enforced in code)

| Feature | Release | Details |
| :-- | :-- | :-- |
| Emergency intent | MVP (core) | Words like "lumulubog", "may naipit", "hindi makahinga" show the emergency card first: higher ground, barangay and hotlines from stored data |
| Live-data intent | MVP (core) | Storm location, class suspension, power return: "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Medicine-dose intent | MVP (core) | Points to the health center or hotlines, without the model |
| Verifier | MVP (core) | Checks citations, numbers and phone-like strings; a failing AI answer is replaced by the vetted summary |
| Critical-passage pinning | MVP (core) | Vetted summary always shown above AI text on critical topics |
| Family-plan intent | MVP | Evacuation center and contacts answered from data, never from the model |
| Health pointers | MVP | Floodwater wound or fever questions get the guide's leptospirosis warning signs and a pointer to the health center |

## 7. Evacuation and family cards

| Feature | Release | Details |
| :-- | :-- | :-- |
| "Bilangan" roll call | MVP stretch | Every member with photo; tick present before leaving and on arrival |
| "Hinahanap" missing-member card | MVP stretch | Full screen photo, name, age group, needs, main person's number, evacuation center; works with no signal |
| Printable member cards | Pilot | |

## 8. Guide content

| Feature | Release | Details |
| :-- | :-- | :-- |
| Built-in official guide | MVP (core) | 120 passages in the MVP (about 300 planned) from PAGASA, NDRRMC and OCD, DOH, PHIVOLCS, BFP. The 30 demo-critical passages are written and reviewed first |
| Traceable passages | MVP (core) | Source (agency, title, date, URL), reviewer and review date on each; content build fails without them |
| Browse guide topics | MVP | By topic group, without the model |
| Battery-saving tips ("Pagtipid ng baterya") | MVP stretch | A guide topic, linked from the low-battery badge, on keeping the phone and power banks alive during an outage. Written only from a sourced passage; no tips from memory |
| LGU DRRMO review | Pilot | |
| Cebuano guide | Later | |
| Livelihood tags and packs (fisherfolk, farmer) | Later | |

## 9. Power, devices and accessibility

| Feature | Release | Details |
| :-- | :-- | :-- |
| Fully offline | MVP (core) | Every core feature works in airplane mode; MVP APK has no INTERNET permission |
| Low-battery mode | MVP (core) | Below 15% or battery saver on: model off; checklists, cards, search and summaries keep working |
| Manual low-battery switch | MVP (core) | A Settings and Home toggle that turns low-battery mode on right away, so the user can save power early. It also lets the demo show the mode on demand |
| Device tiers | MVP (core) | `none` tier skips the model and loses only the AI wording |
| AI on or off setting | MVP (core) | |
| Install the model from a file | MVP | Pick the GGUF file from storage (copied over USB or shared from another phone); the app checks its size and SHA-256 against the expected values before using it. No network needed. The Pilot adds the Google Play AI pack |
| Model load and unload | MVP | Loads when the Ask screen opens and AI is allowed; unloads after 2 minutes idle, when the app goes to the background, or when AI stops being allowed. A failed load falls back to summaries with one retry per session |
| Large text, icons, dark theme | MVP | |
| Offline light and SOS screen | MVP stretch | A full-screen white light and a large-text "TULONG" screen to signal rescuers in a blackout. Uses the screen only; no camera or flash permission |
| Read-aloud with the phone's Filipino voice | Later | |
| iOS | Later | |

## 10. Updates, packs and LGU features

| Feature | Release | Details |
| :-- | :-- | :-- |
| Import a signed pack from a file | MVP stretch | |
| Smart Update | Pilot | Asks first, Wi-Fi by default, one pinned host, every request in the on-screen network log |
| LGU pack (Bantay tier) | Pilot | Local evacuation centers, hotlines and advisories; paid by the LGU ([BMC.md](BMC.md)) |
| Phone-to-phone pack sharing | Pilot | Signed packs |
| Opt-in topic reports and DRRM dashboard | Pilot | Never includes household data |
| Install from a barangay-shared copy | Pilot | |
| Barangay drill mode | Pilot | A practice run on a calm day: pick a sample warning, walk through the checklist and "Bilangan", then reset. Nothing is saved as a real warning. Fits BHW visits and school drills |

## 11. About, settings and evaluation

| Feature | Release | Details |
| :-- | :-- | :-- |
| About screen | MVP (core) | Guide date, sources, reviewers, "Built with Llama"; network log in the Pilot |
| Preparedness-aid notice | MVP (core) | The About screen says the app is a preparedness aid, not an emergency service |
| Settings | MVP | AI on or off, low-battery switch and threshold, clear question history; update settings and topic-sharing opt-in in the Pilot |
| On-phone evaluation screen | MVP (core, demo tool) | Retrieval, refusal, faithfulness and latency numbers on this phone. Shown to judges; can be hidden in a later public release |

## 12. Privacy guarantees

- The household profile, member names, notes and photos never leave the phone and never enter the model prompt, packs, topic reports, logs or SMS text.
- Photos are re-encoded without EXIF, stored in app-private storage and excluded from cloud backup. They leave the phone only when the user shares a member card.
- Face detection only, never recognition: boxes are used to crop and then discarded. The model is text-only.
- No analytics SDKs, no location permission, no background services.

## 13. Out of scope

These break the offline or privacy rules above, so they are not planned in any release: live storm tracking, maps, GPS or location features, push alerts, household accounts, and ads.
