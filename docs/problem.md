# Problem

When a typhoon cuts power and signal, Filipino households lose access to preparedness guidance at the moment they need it most, and the guidance that does exist was written for nobody in particular.

Related: [README](README.md) · [features.md](features.md) · [solution.md](solution.md) · [system-design.md](system-design.md) · [api-layer.md](api-layer.md) · [BMC.md](BMC.md)

## 1. The problem in one sentence

A household in a typhoon-exposed area needs to know what to do for its own members, right now, and that need peaks exactly when phones lose power, signal and data.

Official guidance exists, but most of it lives online, is written for a general reader, and rarely says what a family with an infant, a senior on maintenance medicine and a house by a river should do at Signal No. 2 with an orange rainfall warning. Once the towers go down, the household has a battery radio and whatever it remembers.

## 2. Who has the problem

### The household (primary user)

**Persona: the riverside parent.** A parent in a low-lying barangay beside a river, living with a 9-month-old, a grandparent on maintenance medicine for blood pressure, and two school-age children. The household shares one budget 4 GB Android phone on prepaid load, typical of a market where Transsion alone held 35% of shipments in Q3 2025 ([Omdia via NoypiGeeks](https://www.noypigeeks.com/?p=260620)). During storms the AM radio is the news source, and the barangay group chat goes quiet when the tower does. The parent knows "Signal No. 3" means strong wind, but not what an orange rainfall warning means for a house near the river, which medicines to pack, or when to leave.

The household needs what to do now for these members and this house, answers to its own Taglish questions, and proof that each answer is official, all with no signal and a draining battery.

### The buyer: the LGU DRRM office

The municipal or city DRRMO must prepare residents by law, and it has a budget for that. At least 5% of the LGU's estimated revenue from regular sources goes to the Local DRRM Fund, which pays for preparedness programs, training, equipment and supplies; 30% of the fund is the Quick Response Fund ([RA 10121, Sec. 21](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html)). The office has its own problems:

- **Generic campaigns.** One poster or post serves every household.
- **No channel once networks fail.** Online advisories do not reach a home with no signal.
- **Little insight.** It rarely learns what residents misunderstand until after the storm.
- **Accountability.** Disaster preparedness is one of the ten areas an LGU must pass for the Seal of Good Local Governance ([RA 11292](https://legacy.senate.gov.ph/republic_acts/ra%2011292.pdf); [DILG MC 2023-086](https://batasnatin.com/laws/mc-2023-086)).

### The distributors: barangay officials and BHWs

Barangay officials issue local evacuation orders and run evacuation centers. Barangay health workers already make home visits. Both can help households set up the app on a calm day: install it, enter each member and take the required face photo of everyone, infants and elders included. They lack a simple tool to leave behind that keeps working after they go.

## 3. When it hits

Lead times come from PAGASA's wind signal definitions ([PAGASA](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal)). Rainfall and storm surge warnings are separate systems, so a low wind signal does not mean a low flood risk.

| Stage | Timing | What the household needs | What fails |
| :-- | :-- | :-- | :-- |
| Before | Calm days | Pack the go-bag, secure the house, agree on a plan | Nothing yet, but attention is low and guides are long. This is the only window for setup. |
| Signals No. 1 and 2 | Winds expected within 36 and 24 hours | Finish preparations, charge phones and power banks, check medicines | Networks congest. Rain may already flood low areas. |
| Signals No. 3 to 5, landfall | Winds expected within 18 and 12 hours | Decide whether and when to evacuate | PAGASA expects many areas to lose power at No. 3, power and telecoms to be nearly lost at No. 4, and long power, water and telecom outages at No. 5. Roads flood. |
| After | Days to weeks | Safe water, electrical safety, cleanup, health after floods | Ten days after Odette, only 150 of 281 towns had power back, many only partly ([DZRH](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc)). |

## 4. Evidence and how strong it is

| Claim | Source | Strength |
| :-- | :-- | :-- |
| About 20 tropical cyclones enter the Philippine area each year; 8 or 9 cross the country | [Tropical Cyclone Research and Review, citing PAGASA](https://doaj.org/article/6d8b8bfa82c54a63a72f9c9adaa08c66) | Strong |
| PAGASA's five wind signals give lead times of 36, 24, 18, 12 and 12 hours | [PAGASA](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) | Official |
| On Odette's first day (Dec 2021), NDRRMC reported mobile service disruption in 369 areas across six regions | [New Straits Times](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette) | Strong, NDRRMC figure via news |
| 281 cities and towns lost electricity in Odette; 150 had power back ten days later, many only partly | [DZRH, NDRRMC spokesperson](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc) | Strong |
| As of 19 Dec 2021, about 780,800 people in 2,322 barangays across eight regions were affected | [SunStar](https://weekend.sunstar.com.ph/blog/2021/12/20/editorial-lets-help-those-affected-by-odette/) | Strong, NDRRMC figure via news |
| Siargao needed satellite links set up by OCD after communications went down | [PIA](https://mirror.pia.gov.ph/press-releases/2021/12/19/ocd-provides-emergency-comms-between-siargao-and-ndrrmc-after-disruption-due-to-ty-odette) | Official |
| Kristine (Oct 2024), a severe tropical storm one category below typhoon, dropped over 700 mm of rain on Naga City in 24 hours, about 2.5 months' worth | [GMA](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story) | Strong, city officials via news |
| Per Naga's mayor: 679 mm in 24 hours, floods up to 12 ft, 22 of 27 barangays submerged, about 35,000 households (161,000 people) flooded | [PCO briefing transcript](https://mirror.pco.gov.ph/?p=197670) | **Unverified:** seen only in a search excerpt |
| Mobile operators must send free disaster alerts; NDRRMC runs the Emergency Cell Broadcast System | [RA 10639, via Wikipedia](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System) | Law, secondary summary |
| A one-minute phone call takes the same bandwidth as about 800 short texts | [NC DPS, 2016](https://www.ncdps.gov/press-release/governor-mccrory-and-first-lady-encourage-texting-first-communication-between-loved) | Official, US context |
| 74% of Filipinos live in areas prone to floods, landslides and storm surge | [iACADEMY, attributed to World Bank](https://iacademy.edu.ph/story_details?id=1343) | **Unverified:** trace to the World Bank original |

*Reasoning:* Odette and Kristine are complementary anchor stories. Odette is the offline case: signal down in hundreds of areas on day one and power out for over a week in many towns. A household with Sipat installed beforehand would still have had answers on day five. Kristine is the wind-only trap: a storm below typhoon strength whose danger was rain, easy to read as manageable while the river rose. Together they set two requirements: work fully offline, and take rainfall and storm surge warnings, not just wind signals (README, S1).

## 5. Root causes

1. **Online-only at the worst time.** Apps, websites, social media and chatbots need data, the first thing to go and the last to come back.
2. **Generic, not household-fitted.** Checklists rarely say what changes with an infant, a pregnancy, a disability, a senior's medicines, pets, or a house by a river or on a slope.
3. **Long and static.** Nobody searches a long PDF in the dark while the roof rattles.
4. **Wind-only thinking.** Signals describe wind. Floods come from rain and storm surge from the sea, each with its own PAGASA warning.
5. **Language.** Guides use English or formal Filipino. People ask in Taglish. (Other Philippine languages are real gaps too, but they are deliberately out of MVP scope — features.md D8.)
6. **No offline channel for LGUs.** The DRRMO knows its evacuation centers and hotlines, but cannot put them in every household's pocket in a form that works without signal.

## 6. Current alternatives

| Alternative | What it does well | Gap for this household |
| :-- | :-- | :-- |
| Free cell-broadcast alerts ([RA 10639](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)) | Official alerts pushed free to phones in the area, with no app | One-way and general. Needs a working tower. Says a storm is coming, not what this household should do. |
| PAGASA bulletins (radio, TV, web, social media) | The authoritative source for signals and rainfall and storm surge warnings. Radio works without grid power. | Says what is coming, not what to do for an infant, a senior or a riverside house. Web and social media need data, and the last bulletin seen is gone once signal drops. |
| Project NOAH (UP) | Flood, landslide and storm surge hazard maps | Online, and built for planning rather than help during the storm |
| HazardHunterPH (DOST-PHIVOLCS) | Hazard assessment for a chosen location | Online. Describes the hazards of a place, not actions for this storm. |
| LGU Facebook pages and group chats | Local, timely and trusted: evacuation orders, class suspensions | Need data, are noisy, and go silent when towers go down |
| Printed or PDF guides (NDRRMC, OCD, DOH) | Authoritative, and print works offline | Long, generic and hard to search under stress |
| Online AI chatbots | Conversational, and understand Taglish | Need internet. May answer from memory with no source. |

**Positioning.** Alerts tell you a storm is coming. Sipat tells your household what to do, even with no signal. While signal lasts it also keeps the latest PAGASA bulletin, shown verbatim with its issued and fetched times, so the family can still read it offline (MVP stretch, [features.md, section 7](features.md#7-evacuation-and-bagyo-forecast)). It complements these channels, the radio included, rather than replacing them.

## 7. Honest limits

- **Not a forecast.** The app makes no forecast and never says when the bagyo arrives. Where it shows the bagyo's position, track or signal areas, that is the latest PAGASA bulletin, copied from PAGASA, not our prediction.
- **The cached bulletin can be old.** It is as current as the last time the phone had signal. The card shows when PAGASA issued it and when the phone fetched it, and after 3 hours from issue it says "Makinig muli sa radyo. Baka nagbago na ang signal." Without a cached bulletin, storm questions get the fixed "Walang live na balita..." reply. Guide passages are as current as the last installed guide pack, whose date the About screen shows.
- **Phase switching is a suggestion.** The app may switch to "Habang may bagyo" or "Bago ang bagyo" from the warnings tapped, the user's words or the bulletin. Every switch shows "Ibalik" to undo, and moving to "Pagkatapos ng bagyo" is always the user's tap.
- **Location is optional.** The household picks its barangay from a list; phone GPS is one coarse reading on tap, never in the background, and never leaves the phone.
- **Not an emergency service.** It shows the emergency card and hotlines, but calls and help depend on the network and responders.
- **Never overrides officials.** Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad." The app may recommend where to evacuate; the barangay decides when.
- **Not new information.** Offline guides already exist. The new part is a sourced answer to your own Taglish question, fitted to your household, without signal.

## 8. Problem statement

How might we give a typhoon-exposed household, on a budget Android phone with no power or signal, clear steps fitted to its members and its home, drawn only from official sources, so that it acts early and safely?

## 9. Riskiest assumptions

Pass signals are proposals to agree on before testing.

| Assumption | Cheapest test | Pass signal |
| :-- | :-- | :-- |
| Households will set up before a storm | BHW-assisted setup in one barangay on a calm day | Most visited households finish a profile in one visit |
| People will tap the warning they heard | Read five sample bulletins to 5 to 10 residents; they set it in a clickable mock-up | Most pick the right wind signal and rainfall color unaided |
| The 1B model adds value over the vetted summary | Blind test with outsiders: summary only vs. summary plus AI answer, 20 questions | The AI version is preferred more often than not, with no unfaithful answers |
| A budget phone is fast enough | Hour 1 of the build: time 20 prompts on a 4 GB phone | README defaults met (summary ≤ 1 s, full AI answer ≤ 10 s median); otherwise the tier rules turn AI off |
| LGUs will pay from the Local DRRM Fund | Interview 5 municipal DRRMOs on where this fits their DRRM fund plan | At least one letter of intent for a pilot |
| Agencies will approve reuse for the paid LGU tier | Write to OCD, PAGASA and DOH (RA 8293, Sec. 176; see [BMC.md](BMC.md)) | Written approval, or clear conditions, before any sale |
| Families will take a face photo of every member, infants and elders included | BHW-assisted setup in one barangay; count members left at "Mamaya na" (pending) after one week | Most households have every photo done within a week; nobody abandons setup over the photo |
| People trust and keep the automatic phase switch | Usability test: trigger switches from a tapped warning and a spoken cue; watch for "Ibalik" taps and confusion | Most users understand why the phase changed and keep it; undo is used for real mismatches, not confusion |
| The scraper stays reliable and PAGASA permits server-side use of its bulletins | Run the scraper through a real advisory and log parse failures and lag; write to PAGASA for permission or a data feed | Every bulletin parsed or marked stale without a guessed field; written permission or clear conditions before the Pilot |
| People treat a cached bulletin as old, not live | Ask "saan na ang bagyo?" in a usability test with an old cached card, and with none | Users read the issued time, follow the stale prompt or the fixed reply to the radio or the barangay, and do not skip the radio |

## 10. What success looks like

Success is measured in outcomes, not features. Metric targets for the build are in [solution.md](solution.md).

- **Households act earlier.** In pilot barangays, the share of households with a packed go-bag and a family plan rises between the before and after surveys (README, B5).
- **Help works with no signal.** The checklist and guide work in airplane mode on a low battery.
- **No harmful answers.** No shown answer contains a number, hotline or instruction absent from the official guide.
- **Users know the source.** They can open "Saan galing ito?" and name the agency behind an answer.
- **LGUs renew.** A pilot LGU budgets for the next season.

## Sources

- [PAGASA: Tropical Cyclone Wind Signals](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal)
- [Tropical Cyclone Research and Review: 2020 cyclones, citing PAGASA](https://doaj.org/article/6d8b8bfa82c54a63a72f9c9adaa08c66)
- [New Straits Times: Odette day-one NDRRMC figures](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette)
- [DZRH: Odette power restoration, NDRRMC](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc)
- [SunStar: Odette affected population](https://weekend.sunstar.com.ph/blog/2021/12/20/editorial-lets-help-those-affected-by-odette/)
- [PIA: OCD emergency communications in Siargao](https://mirror.pia.gov.ph/press-releases/2021/12/19/ocd-provides-emergency-comms-between-siargao-and-ndrrmc-after-disruption-due-to-ty-odette)
- [GMA: Kristine rainfall in Naga City, 24 Oct 2024](https://www.gmanetwork.com/news/topstories/regions/924744/rain-naga-24-hours/story)
- [PCO: presidential briefing transcript, Naga City](https://mirror.pco.gov.ph/?p=197670) (**Unverified**)
- [Wikipedia: Emergency Cell Broadcast System (RA 10639)](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)
- [NC DPS: texting first during Hurricane Matthew, 2016](https://www.ncdps.gov/press-release/governor-mccrory-and-first-lady-encourage-texting-first-communication-between-loved)
- [iACADEMY: storm preparedness (secondary)](https://iacademy.edu.ph/story_details?id=1343)
- [Omdia via NoypiGeeks: Q3 2025 phone shares](https://www.noypigeeks.com/?p=260620)
- [RA 10121, Philippine DRRM Act of 2010 (Lawphil)](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html)
- [RA 11292, Seal of Good Local Governance Act of 2019](https://legacy.senate.gov.ph/republic_acts/ra%2011292.pdf)
- [DILG MC 2023-086: 2023 SGLG guidelines](https://batasnatin.com/laws/mc-2023-086)
