# Sipat

*Your Offline Typhoon Companion*

Oct 9, 2026 · @jim

## General Overview

An offline typhoon companion that runs entirely on the phone. The family sets up a household profile once, taps the wind signal they heard on the radio, and gets a checklist made for their household.

They can also ask questions in Taglish and get answers taken only from official preparedness guides that ship inside the app (PAGASA, NDRRMC, OCD, DOH). A local LLM (Llama 3.2 1B) puts the answers in plain words, and the app keeps working with the model switched off to save battery. Whenever the family is back online, it asks before downloading only the guide updates that fit their household and area.

## Features

1. Local LLM (on-device, no internet)
   1. RAG retrieval: BM25 keyword search over about 300 guide passages, with Taglish synonym matching
   2. Grounded answers only: 2 to 4 Tagalog sentences, never from the model's own memory
   3. Source citations: "Saan galing ito?" opens the exact passage, agency and date
   4. Refusal gate: if the guide has no answer, it says "Wala ito sa gabay" and never calls the model
   5. Fact check: every number in an answer must appear in the cited passage
2. Household Checklists
   1. Household profile: infant, senior, pregnant, PWD, maintenance medicine, pets, near river or sea, on a slope, light materials
   2. Signal-based checklists: tap PAGASA Signal 1 to 5 to see its meaning, lead time and what to do
   3. Before, During and After the storm phases
   4. Go-bag checklist that the family ticks off as they pack
   5. Family plan: evacuation center, meeting place, emergency contacts
3. Safety Rules (built in)
   1. Emergency trigger: words like "lumulubog" or "may naipit" show emergency guidance first
   2. No live data reply: questions about the storm's location point to PAGASA bulletins and the barangay
   3. Medical redirect: health questions beyond the guide point to the Health Center
   4. Every answer ends with "Sundin ang utos ng barangay at ng mga awtoridad."
4. Battery and Offline Mode
   1. Low-battery mode: below 15%, the model turns off; checklists and guide search still work
   2. Model loads only when a question is asked and unloads after 2 minutes idle
   3. Internet is used only for the opt-in Smart Update; every other feature works fully offline. No location, no background services
5. Offline Knowledge Base (Official Sources)
   1. PAGASA: wind signals, storm surge
   2. NDRRMC and OCD: preparation, evacuation
   3. DOH: safe water, health after floods
   4. PHIVOLCS: landslides
   5. Local DRRM office guidance
6. Smart Update (opt-in, only when online)
   1. Asks first: when the app is opened and finds internet, it shows "May bagong gabay. I-download? (120 KB)". Nothing downloads without a tap
   2. Only relevant data: updates are picked by the household profile and the province or municipality the user chose at setup (typed or picked, no GPS). A coastal household gets storm surge updates, not upland landslide packs
   3. Small delta updates: only changed or new passages, checklist items, signal definitions and local hotlines, usually a few KB, never the whole guide
   4. Local pack: if their LGU has a Bantay license, the LGU's evacuation centers, hotlines and advisories download automatically with the update
   5. Wi-Fi by default: a mobile data toggle shows the exact size first; model upgrades are separate, Wi-Fi only and always optional
   6. Verified and traceable: every pack is signed and checked before install; each passage keeps its agency, date and URL, and the About screen shows the guide date
   7. Stale guide reminder: if the guide is older than 30 days, the next time there is internet the app suggests updating, so families refresh before typhoon season
   8. Private by design: the request sends only the guide version and province code; the household profile never leaves the phone, and filtering by profile happens on the device

## Target Demographic

Households in typhoon-prone areas of the Philippines, especially a parent with a budget Android phone caring for an infant, a senior, or someone on maintenance medicine.

Their need is highest when power and signal are gone, which is exactly when searching online stops working. During Typhoon Odette, [281 towns lost power](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc) and [mobile service went down in 369 areas](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette) on day one.

The paying customers are barangays and LGUs, through their DRRM offices, who roll the app out to these households.

## Business Model Canvas

Households never pay; the LGU license is the only paid tier. This keeps the app fully offline with no payment or license check.

### Household (Ambon)

0 PHP | 0 USD | Free forever

- All safety features: signal checklists, household profile, guide search, Taglish Q&A, emergency trigger, low-battery mode
- Multiple household profiles (e.g. parents' house in the province)
- Printable family emergency plan and go-bag list
- Works 100% offline with no account; Smart Update downloads fresh guide data for free whenever they choose to go online

### Barangay / LGU (Bantay)

Annual license, custom pricing per LGU

- Localized guide pack: the LGU's own evacuation centers, hotlines, hazard zones and local DRRM advisories built into their version of the app
- Bulk rollout for barangay households: one APK to share and install, no account needed
- Extra guide packs for local needs (fishing, farming, coastal or upland communities)
- DRRM dashboard: anonymous, opt-in summary of the most-asked questions to guide drills and info campaigns
- Training session for barangay DRRM officers and BHWs

NGOs, schools and humanitarian groups get a 20% discount on the Bantay license.

**Notes**

- Government-made material can be used freely, but [making money from it needs prior approval](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/) from the agency that made it (RA 8293, Sec. 176). The free household app credits each agency; get approval before selling the LGU license.
- LGUs buy through government procurement (RA 12009), which is slow. Frame the first deals as pilots with one or two barangays or a single municipality.

## Competitors in the Market

- Project NOAH (UP)
- HazardHunterPH (DOST)
- PAGASA bulletins and website
- Printed and PDF preparedness guides from NDRRMC and OCD

Most of these need internet or are static guides. Sipat works with no signal and answers in your own Taglish words, for your household.

## Tools

1. Payment Service
   1. Polar (LGU licenses, plus invoices for procurement)
   2. Polar checkout links for NGOs and schools (20% discount code)
2. Deployment
   1. Testing
      1. Sideloaded APK on a 4 GB budget Android phone
      2. Android Studio profiler (RAM, speed, battery)
   2. Production
      1. Google Play Store, with large-asset delivery for the 0.81 GB model
      2. Direct APK for LGU bulk rollout; Smart Update packs hosted on AWS S3 + CloudFront as signed, versioned files
3. AI Models
   1. Llama-3.2-1B-Instruct (Q4\_K\_M GGUF, 0.81 GB)
4. Tech Stack
   1. TS
   2. React Native (Android first)
   3. llama.rn (llama.cpp on the phone)
   4. MiniSearch / BM25 (keyword search)
   5. SQLite or MMKV (profile and checklist storage)
   6. Node or Python build script (validates guide.json, builds the search index, and builds the signed delta packs per province and topic)
