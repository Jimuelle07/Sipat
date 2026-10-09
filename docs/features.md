# Features: Bagyo Buddy

Every feature the app offers or plans to offer, grouped by area and tagged by release (MVP, MVP stretch, Pilot, Later). This catalog is drawn from [solution.md](solution.md) sections 3 to 5 and 8; where they disagree, solution.md wins. Data shapes are in [api-layer.md](api-layer.md); how each feature works is in [system-design.md](system-design.md).

## 1. Household and family setup

| Feature | Release | Details |
| :-- | :-- | :-- |
| No account, no sign-up | MVP | No password; everything stays on this phone |
| Main person first | MVP | Name or nickname, age group, needs, phone number; relation "self"; their number goes on every member card |
| Per-member details | MVP | Name (required), relation (asawa, anak, magulang, lolo o lola, apo, kapatid, kamag-anak, iba pa), age group (sanggol, bata, teen, adult, senior), needs (buntis, may kapansanan, may maintenance na gamot), note up to 80 characters, optional phone |
| Pets and home | MVP | Pet count; near a river, near the sea, on a slope, low-lying, light materials or concrete, upper floor available |
| Derived tags and headcount | MVP | Checklists name people, e.g. "Ilagay sa go-bag ang maintenance na gamot ni Lolo Ben" |
| Member photo | MVP stretch | "Kunan ng litrato" (camera permission asked only then), "Pumili sa gallery", "Laktawan" always visible; on-device face detection checks one face and crops; manual crop if no face found |
| Group photo | MVP stretch | One family picture; app finds each face, user taps a name under each crop; unused crops and the original are deleted |
| Area by PSGC list | Pilot | Province and municipality picked from a list, no GPS; needed by LGU packs |
| Multiple households | Pilot | More than one profile on one phone |

## 2. Family plan

| Feature | Release | Details |
| :-- | :-- | :-- |
| Evacuation center, meeting place, emergency contacts | MVP | Center typed in for the MVP; picked from the LGU list in the Pilot |
| "Ligtas kami" and "Kailangan namin ng tulong" texts | MVP stretch | Opens the phone's SMS app with headcount, who is vulnerable and location; the user presses send. Member names and notes are never included |
| Printable family plan | Pilot | |

## 3. Warnings ("Ano ang narinig mo?")

| Feature | Release | Details |
| :-- | :-- | :-- |
| Warning picker | MVP | Wind signal 1 to 5, rainfall (yellow, orange, red), storm surge (yellow, orange, red), gale (on or off); several can be active at once |
| Warning cards without the model | MVP | Official meaning from the cited source; states that a signal describes wind, not rain, and that floods can come at any level |
| Active warnings and their age on Home | MVP | |
| Stale-warning prompt | MVP | After 3 hours: "Makinig muli sa radyo. Baka nagbago na ang signal." Never predicts wind arrival time |

## 4. Checklists

| Feature | Release | Details |
| :-- | :-- | :-- |
| Phases | MVP | Bago, Habang, Pagkatapos ng bagyo |
| "Gawin ngayon" | MVP | Top items for this household right now, then the full list |
| Household-fitted checklists | MVP | Filtered by phase, active warnings and profile tags; no model needed |
| Go-bag checklist with ticks and progress | MVP | |
| Post-storm checklist | MVP | House check, electrical safety, generators and candles, safe water, avoiding floodwater |
| Go-bag amounts by headcount | MVP stretch | Multiplies per-person figures from the cited guide |

## 5. Ask in Taglish

| Feature | Release | Details |
| :-- | :-- | :-- |
| Summary first | MVP | Vetted one-sentence summary of the best passage in under a second |
| AI answer second | MVP | Llama 3.2 1B on the phone streams 2 to 4 short Tagalog sentences fitted to the household, grounded only in retrieved passages |
| "Saan galing ito?" | MVP | Full passage with agency, document and date |
| Closing line | MVP | Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad." |
| Refusal with topic buttons | MVP | "Wala ito sa gabay." plus the closest topics; model not called |
| Taglish synonyms and tag boosts in search | MVP | MiniSearch BM25+ |
| Bisaya synonyms in search | MVP stretch | |
| Embedding search for paraphrases | Later | |

## 6. Safety (enforced in code)

| Feature | Release | Details |
| :-- | :-- | :-- |
| Emergency intent | MVP | Words like "lumulubog", "may naipit", "hindi makahinga" show the emergency card first: higher ground, barangay and hotlines from stored data |
| Live-data intent | MVP | Storm location, class suspension, power return: "Walang live na balita ang app tungkol sa bagyo. Makinig sa PAGASA sa radyo o magtanong sa barangay." |
| Medicine-dose intent | MVP | Points to the health center or hotlines, without the model |
| Family-plan intent | MVP | Evacuation center and contacts answered from data, never from the model |
| Verifier | MVP | Checks citations, numbers and phone-like strings; a failing AI answer is replaced by the vetted summary |
| Critical-passage pinning | MVP | Vetted summary always shown above AI text on critical topics |
| Health pointers | MVP | Floodwater wound or fever questions get the guide's leptospirosis warning signs and a pointer to the health center |
| Preparedness-aid notice | MVP | About screen says the app is not an emergency service |

## 7. Evacuation and family cards

| Feature | Release | Details |
| :-- | :-- | :-- |
| "Bilangan" roll call | MVP stretch | Every member with photo; tick present before leaving and on arrival |
| "Hinahanap" missing-member card | MVP stretch | Full screen photo, name, age group, needs, main person's number, evacuation center; works with no signal |
| Printable member cards | Pilot | |

## 8. Guide content

| Feature | Release | Details |
| :-- | :-- | :-- |
| Built-in official guide | MVP | 120 passages in the MVP (about 300 planned) from PAGASA, NDRRMC and OCD, DOH, PHIVOLCS, BFP |
| Browse guide topics | MVP | By topic group, without the model |
| Traceable passages | MVP | Source (agency, title, date, URL), reviewer and review date on each; content build fails without them |
| LGU DRRMO review | Pilot | |
| Cebuano guide | Later | |
| Livelihood tags and packs (fisherfolk, farmer) | Later | |

## 9. Power, devices and accessibility

| Feature | Release | Details |
| :-- | :-- | :-- |
| Fully offline | MVP | Every core feature works in airplane mode; MVP APK has no INTERNET permission |
| Low-battery mode | MVP | Below 15% or battery saver on: model off; checklists, cards, search and summaries keep working |
| Device tiers | MVP | `none` tier skips the model and loses only the AI wording |
| Model load and unload | MVP | |
| AI on or off setting | MVP | |
| Large text, icons, dark theme | MVP | |
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

## 11. About, settings and evaluation

| Feature | Release | Details |
| :-- | :-- | :-- |
| About screen | MVP | Guide date, sources, reviewers, "Built with Llama"; network log in the Pilot |
| Settings | MVP | AI on or off, low-battery threshold; update settings and topic-sharing opt-in in the Pilot |
| On-phone evaluation screen | MVP | Retrieval, refusal, faithfulness and latency numbers on this phone |

## 12. Privacy guarantees

- The household profile, member names, notes and photos never leave the phone and never enter the model prompt, packs, topic reports, logs or SMS text.
- Photos are re-encoded without EXIF, stored in app-private storage and excluded from cloud backup. They leave the phone only when the user shares a member card.
- Face detection only, never recognition: boxes are used to crop and then discarded. The model is text-only.
- No analytics SDKs, no location permission, no background services.
