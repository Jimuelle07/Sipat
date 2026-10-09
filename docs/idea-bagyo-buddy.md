# **Bagyo Buddy: How It Works**

Bagyo Buddy is an offline typhoon companion: the family sets a profile once, taps the wind signal they heard on the radio, and gets a checklist fitted to their household, plus answers to Taglish questions drawn only from official preparedness guides shipped in the app. Llama 3.2 1B runs on the phone to answer in plain words; it never answers from its own memory, and the app keeps working with the model switched off to save battery.

**How to read this doc.** Linked figures are sourced. *Reasoning:* marks my own analysis. **Unverified** marks secondary figures. All targets are proposals to measure.

## **1\. Problem and user**

The user is a household in a typhoon-exposed area: one parent with a budget Android phone, often with a child, an elder or someone on medicine at home. Their need peaks in the hours and days when power and signal are gone, which is exactly when searching online stops working.

**Evidence and how strong it is**

| Claim | Source | Strength |
| :---- | :---- | :---- |
| About 20 tropical cyclones enter the Philippine area each year; 8 or 9 cross the country | [Tropical Cyclone Research and Review, citing PAGASA](https://doaj.org/article/6d8b8bfa82c54a63a72f9c9adaa08c66) | Strong |
| PAGASA's five wind signals give lead times of 36, 24, 18, 12 and 12 hours | [PAGASA](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) | Official |
| During Typhoon Odette (Dec 2021), NDRRMC reported mobile service disruption in 369 areas across six regions on day one | [New Straits Times](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette) | Strong, NDRRMC figure via news |
| 281 cities and towns lost electricity in Odette; 150 had power restored ten days later, many only partly | [DZRH, NDRRMC spokesperson](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc) | Strong |
| As of 19 Dec 2021, about 780,800 people in 2,322 barangays across eight regions were affected | [SunStar](https://weekend.sunstar.com.ph/blog/2021/12/20/editorial-lets-help-those-affected-by-odette/) | Strong, NDRRMC figure via news |
| Siargao needed satellite links set up by the Office of Civil Defense after communications went down | [PIA](https://mirror.pia.gov.ph/press-releases/2021/12/19/ocd-provides-emergency-comms-between-siargao-and-ndrrmc-after-disruption-due-to-ty-odette) | Official |
| 74% of Filipinos live in areas prone to floods, landslides and storm surge | [iACADEMY, attributed to World Bank](https://iacademy.edu.ph/story_details?id=1343) | **Unverified:** trace to the World Bank original |

*Reasoning:* Odette is your anchor story: a well-documented storm where power stayed out for over a week in many towns. A household that downloaded Bagyo Buddy before December 2021 would still have had answers on day five; a household relying on search would not.

**Honest limit.** Offline preparedness guides and the PAGASA bulletins already exist. The new part is asking in your own Taglish words and getting an answer fitted to your household, without signal. Pitch it as that, not as a forecasting tool.

## **2\. User journey**

The household uses Bagyo Buddy in three phases; the first takes two minutes on a calm day, and the other two work with no signal at all.

### **Before the storm (setup, once)**

1\. Install while online; the guide and the model ship inside the app, so nothing else needs downloading.

2\. Build the household profile with taps:

> > > o Members: infant, child, pregnant, senior, person with disability, someone on maintenance medicine, pets.

> > > o Home: near river or sea, on a slope, low-lying, light materials or concrete, upper floor available.

> > > o Plan: nearest evacuation center name (typed), a meeting place, emergency contacts.

3\. The app shows a go-bag checklist fitted to that profile; the family ticks items as they pack.

### **During the storm**

1\. The parent hears on the radio: "Signal No. 3 sa inyong lugar." They tap **Signal 3**.

2\. The app shows, without using the model:

> > > o What Signal 3 means and its lead time from PAGASA (wind 89 to 117 km/h expected within 18 hours).

> > > o A checklist for this household, for example: secure roof and windows, charge power banks, prepare the infant's milk and diapers, move the senior's medicines to the go-bag, be ready to go to the evacuation center when the barangay says.

3\. They ask in Taglish: kailangan na ba naming lumikas kung malapit kami sa ilog?

4\. The model answers in two to four sentences from the matched guide passages, with a **Saan galing ito?** link to the exact passage. It always ends with: follow the barangay's evacuation order.

### **After the storm**

1\. Tap **Pagkatapos ng bagyo** for the post-storm checklist: checking the house, electrical safety before turning power on, safe drinking water, avoiding floodwater.

2\. Ask questions like pwede bang inumin ang tubig sa gripo? or paano linisin ang bahay na binaha?; answers come only from the guide.

3\. Battery is low and power is out: the app's low-battery mode turns the model off and keeps checklists and guide search working (Section 7).

## **3\. How it works inside**

Two paths share one guide: taps produce checklists with no model at all, and typed questions go through search, then the model, then a check; if search finds nothing good, the model is never called.

 

Bagyo Buddy paths · checklist path and question path

Only one box runs the model; when search finds no good passage, the app refuses before the model is ever called.

**Path A: taps to checklist (no model)**

1\. The user taps a phase (before, during, after) and a signal level.

2\. Code filters checklist.json by phase, signal level and the household profile tags.

3\. The screen shows the list plus the official meaning of the signal. This path works even in low-battery mode.

**Path B: question to answer**

1\. **Normalize (code).** Lowercase, remove filler words, expand Taglish synonyms ("baha", "tubig-baha", "lumubog" to flood; "lumikas", "evacuate" to evacuate).

2\. **Search (code).** BM25 keyword scoring over about 300 guide chunks, boosted when a chunk's tags match the current phase, signal and profile.

3\. **Gate (code).** If the best chunk scores below a threshold, stop: show "Wala ito sa gabay" plus the fixed safety message, and list the closest guide topics as buttons.

4\. **Answer (model).** Give the model the question, a one-line profile summary and the top two chunks. It writes 2 to 4 short Tagalog sentences and returns which chunk IDs it used, in JSON.

5\. **Check (code).** The cited IDs must be among the two given; numbers in the answer (hours, km/h, liters) must appear in those chunks. On failure, show the top chunk's own summary sentence instead.

6\. **Show.** The answer, a **Saan galing ito?** link to the full chunk with its source and date, and the fixed closing line about following the barangay's evacuation order.

*Reasoning:* BM25 keyword search needs no second model, so the phone loads only Llama. A small embedding model would match paraphrases better; treat it as a roadmap item, not a hackathon dependency.

## **4\. The guide content**

The guide is the product's real asset: about 300 short, tagged passages rewritten from official Philippine sources, each traceable to its origin. Writing it well matters more than any prompt.

### **What it covers**

| Topic group | Example passages | Main source to draw from |
| :---- | :---- | :---- |
| Wind signals 1 to 5 | Meaning, wind range, lead time, what to do at each | [PAGASA wind signal page](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal) |
| Before: preparing the home and go-bag | Securing roofs, storing water, documents in plastic | NDRRMC and OCD public advisories |
| Evacuation | When and how, what to bring, people with special needs | NDRRMC, local DRRM office guidance |
| Floods, storm surge, landslides | Warning signs, moving to higher ground | PAGASA, NDRRMC, PHIVOLCS for landslides |
| Infants, seniors, pregnancy, disability, pets | Specific items and precautions | DOH and NDRRMC advisories |
| After: water, food, electricity, cleanup | Safe water, spoiled food, electrical checks | DOH advisories |
| Health after floods | Wounds, leptospirosis warning signs, when to seek care | DOH advisories (link to round one for health detail) |

*Reasoning:* I have not pulled the specific NDRRMC, OCD or DOH documents for this doc. Collecting them is a task for the first build hours; list each document's title, agency, date and URL in sources.json.

### **Can you reuse government material?**

Under the Intellectual Property Code, no copyright subsists in works of the Philippine government, but exploiting them for profit needs prior approval from the agency that made them ([RA 8293, Sec. 176, via ndvlaw](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)). *Reasoning:* a free hackathon prototype that credits each agency is on safe ground; a paid or ad-supported app would need agency approval. I am not a lawyer; confirm before any commercial launch.

### **How each passage is shaped**

• 60 to 150 words, one topic, written in plain Tagalog with the English term in parentheses where people use it ("storm surge").

• Tags: phase (before, during, after), signal levels (1 to 5 or any), profile tags (infant, senior, river, slope), hazard (wind, flood, surge, landslide).

• A one-sentence summary written by hand, used as the fallback answer.

• Source fields: agency, document title, date, URL.

### **Example passage**

{  
  "id": "during-flood-river-01",  
  "phase": "during", "signals": \[2, 3, 4, 5\],  
  "tags": \["river", "flood", "evacuate"\],  
  "text": "Kung malapit ang bahay sa ilog o sapa, bantayan ang pagtaas ng tubig... Sundin agad ang utos ng barangay na lumikas...",  
  "summary": "Kung malapit sa ilog, maghanda nang lumikas at sumunod agad sa utos ng barangay.",  
  "source": {"agency": "(fill in)", "title": "(fill in)", "date": "(fill in)", "url": "(fill in)"}  
}

The text above is a placeholder showing the shape only; write the real wording from the official source.

## **5\. Data model and data spec**

The user gives taps and short questions; the app ships about 1 MB of text data next to the 0.81 GB model, and stores only the household profile.

### **What the user inputs**

| Input | Type | Typical size | Limit | Example |
| :---- | :---- | :---- | :---- | :---- |
| Household members | Multi-select taps | 1 to 6 taps | Fixed list | infant, senior, maintenance medicine |
| Home situation | Multi-select taps | 1 to 4 taps | Fixed list | near river, light materials |
| Plan details | Short text | 3 to 10 words each | 60 characters per field | evacuation center name, meeting place |
| Phase | One tap | 1 | before, during, after | during |
| Signal level | One tap | 1 | 1 to 5 or none | 3 |
| Question | Text | 5 to 20 words, about 10 to 40 tokens | 200 characters | kailangan na ba naming lumikas kung malapit kami sa ilog? |
| Checklist ticks | Taps | Many |   | go-bag items packed |

### **Files shipped in the app**

| File | Contents | Size |
| :---- | :---- | :---- |
| guide.json | About 300 passages with tags, summaries and source fields | \~600 KB |
| checklist.json | About 150 items tagged by phase, signal and profile | \~60 KB |
| signals.json | PAGASA signals 1 to 5: wind range, lead time, meaning | \~5 KB |
| synonyms.json | Taglish to topic word map for search | \~20 KB |
| index.bin | Prebuilt BM25 index | \~300 KB |
| sources.json | Every source document: agency, title, date, URL | \~20 KB |
| Model | Llama-3.2-1B-Instruct-Q4\_K\_M.gguf | 0.81 GB |

### **Stored on the phone**

| Table | Columns | Rows |
| :---- | :---- | :---- |
| profile | member tags, home tags, plan fields | 1 |
| checklist\_state | item\_id, ticked, updated\_at | up to 150 |
| question\_log (local only) | question, matched chunk IDs, answered or refused, time taken | grows slowly; can be cleared |

Nothing is sent anywhere; the app has no internet permission after install. *Reasoning:* the profile reveals who in the home is vulnerable, which is one more reason to keep it on the device.

### **Model input and output budget**

| Part | Tokens |
| :---- | :---- |
| Instructions and 2 short examples | \~180 |
| Profile summary | \~20 |
| Two passages (60 to 150 words each, Tagalog) | \~250 to 450 |
| Question | \~10 to 40 |
| **Total input** | **\~460 to 690** |
| Output (JSON with answer and chunk IDs) | ≤ 110 |

Target: answer within 6 seconds median on a 4 GB budget phone, measured in hour 1\. *Reasoning:* this is longer than Listahan's input because of the passages; keep passages near 100 words to stay inside budget.

## **6\. Retrieval, prompts and refusal rules**

Search decides what the model may read, the grammar decides what shape it may write, and the check decides whether the answer is shown.

### **Retrieval**

1\. Normalize the question and expand synonyms from synonyms.json.

2\. Score all passages with BM25.

3\. Add a boost when a passage's tags match the current phase, signal level or profile (for example \+20% for river when the profile says near river).

4\. Keep the top two passages. If the best score is below the threshold, refuse (rules below).

*Reasoning:* set the threshold using the evaluation set: pick the value that keeps out-of-scope questions refused while keeping in-scope recall high.

### **Answer prompt**

Ikaw ay gabay sa paghahanda sa bagyo. Sumagot LAMANG mula sa mga talata sa ibaba.  
Kung wala sa talata ang sagot, sabihing wala ito sa gabay.  
Sumagot sa 2 hanggang 4 na maiikling pangungusap sa simpleng Tagalog.  
Huwag magdagdag ng numero, oras o lugar na wala sa talata.

Sambahayan: {profile\_summary}  
Signal ngayon: {signal}

Talata \[{id\_1}\]: {text\_1}  
Talata \[{id\_2}\]: {text\_2}

Tanong: {question}

### **Output schema (grammar-constrained)**

{  
  "type": "object",  
  "properties": {  
    "answer": {"type": "string", "maxLength": 400},  
    "used": {"type": "array", "items": {"enum": \["{id\_1}", "{id\_2}"\]}, "minItems": 1, "maxItems": 2},  
    "in\_guide": {"type": "boolean"}  
  },  
  "required": \["answer", "used", "in\_guide"\]  
}

The two allowed IDs are filled in per question, so the model can only cite passages it was given.

### **Refusal and safety rules (all enforced by code)**

| Situation | What the app does |
| :---- | :---- |
| Best search score below threshold | No model call; "Wala ito sa gabay" plus closest topics as buttons |
| Model returns in\_guide: false | Same as above |
| Answer contains a number not found in the cited passages | Show the passage summary instead |
| Question about the storm's location, track or timing | Fixed reply: the app has no live data; listen to PAGASA bulletins on radio or ask the barangay |
| Words suggesting immediate danger ("lumulubog", "may naipit", "hindi makahinga") | Show emergency guidance first: get to higher ground, call emergency services or the barangay; then the answer |
| Medical questions beyond the guide | Point to the Health Center or emergency services |
| Every answer | Ends with: "Sundin ang utos ng barangay at ng mga awtoridad." |

## **7\. Battery and offline design**

Each model answer costs a tiny slice of battery; the screen costs more, so the design keeps sessions short and lets the user switch the model off.

*Reasoning, a rough estimate to confirm by measurement:*

• A typical budget phone battery of 5,000 mAh at about 3.85 V holds roughly 19 Wh.

• A 1B model draws about 2 to 3 W while generating ([Ertas](https://www.ertas.ai/blog/llm-android-benchmarks-snapdragon-tensor), **Unverified** vendor figure).

• One answer at about 6 seconds and 3 W is roughly 18 joules, about 0.005 Wh, or under 0.1% of the battery.

• So 50 questions during a storm cost on the order of 1 to 2% of battery for the model itself; minutes of screen-on time will cost more.

**Design rules**

| Rule | Why |
| :---- | :---- |
| Checklists, signal meanings and guide reading never need the model | They work in any battery state |
| Load the model only when a question is asked; unload after 2 minutes idle | Frees about 1 GB of RAM and avoids background drain |
| Low-battery mode below 15% (user can change): model off, search shows passage summaries | Keeps the phone alive for calls and the flashlight |
| Dark theme and short screens by default | Screen is the biggest drain on most phones |
| No background services, no notifications, no location | Nothing runs when the app is closed |
| Offline from install: no internet permission | Works the same with or without signal; nothing to fail when towers go down |

**What offline cannot do (say this in the app)**

• It does not know where the storm is, its track, or your local signal level; the user brings that from the radio or the barangay.

• Its guidance is as current as the app version; show the guide's date on the About screen.

## **8\. Stack and model on the phone**

Same core as Listahan, React Native with llama.rn and Q4\_K\_M, plus a prebuilt keyword index; no second model and no network.

| Layer | Choice | Why |
| :---- | :---- | :---- |
| Model | Llama-3.2-1B-Instruct-Q4\_K\_M.gguf, 0.81 GB ([bartowski](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF)) | Fits a 4 GB budget phone; benchmark Q4\_0 for speed |
| App | React Native, Android first | Budget Android dominates; Transsion held 35% of shipments in Q3 2025 ([Omdia via NoypiGeeks](https://www.noypigeeks.com/?p=260620)) |
| Inference | [llama.rn](https://github.com/mybigday/llama.rn/wiki) | llama.cpp for Android and iOS, with JSON-schema-to-grammar support ([npm](https://www.npmjs.com/package/llama.rn/)) |
| Search | BM25 in TypeScript (for example a small library such as MiniSearch, or about 100 lines of your own) with an index built at compile time | No second model; fast on any phone |
| Guide build step | A Node or Python script that validates guide.json (required fields, word counts, source URLs) and builds index.bin | Catches missing sources before they ship |
| Storage | SQLite or MMKV for profile and checklist state | Tiny |
| Permissions | None for internet, location or background | Offline by design |

**Flutter alternative.** [llamadart](https://pub.dev/packages/llamadart) runs the same GGUF on Android.

**Model delivery.** *Reasoning:* bundle the model in a sideloaded APK or copy it once over USB for the hackathon; a store release needs a large-asset delivery step.

**Language note.** Tagalog is not among Llama 3.2's officially supported languages ([Meta](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)); the passages are already in Tagalog, so the model mostly condenses Tagalog it is given, which is easier than writing from scratch. Test it.

**License.** "Built with Llama" on the About screen, as the license requires.

## **9\. Evaluation set and target metrics**

Test retrieval and refusal separately from answer quality, because a wrong passage guarantees a wrong answer no matter how good the model is.

**Building the set: 120 questions**

• 80 in-scope questions written by the team in Taglish, each labeled with the passage IDs that answer it.

• 25 out-of-scope questions the guide cannot answer ("saan na ang bagyo?", "magkano ang bigas?").

• 15 emergency-wording questions that must trigger the emergency guidance first.

• Ask 3 to 5 people outside the team to rephrase 20 of the in-scope questions, so the test is not only your own wording.

| Metric | Target (my proposal) | How measured |
| :---- | :---- | :---- |
| Retrieval hit@2 | ≥ 85% of in-scope questions | A labeled correct passage is in the top two |
| Correct refusal | ≥ 90% of out-of-scope questions | No model answer shown |
| Emergency trigger | 100% of the 15 emergency questions | Emergency guidance appears first |
| Faithfulness | ≥ 90% of shown answers | Two teammates check each answer against its passages: no added facts |
| Number check pass | 100% of shown answers | Code rule |
| Answer time, median | ≤ 6 s on a 4 GB phone | Logged on device |
| Checklist time | under 0.5 s | No model involved |
| Peak RAM | ≤ 1.2 GB | Android profiler |

*Reasoning:* show judges two numbers side by side: "search only" (the user reads the top passage) versus "search plus model" (the plain answer). If people outside the team prefer the model's answer in a quick blind test, that is your evidence the local model adds value beyond a static guide.

## **10\. Live demo, 10-hour scope, risks**

### **Live demo (about 4 minutes, budget phone mirrored to the projector)**

1\. Open with Odette: 281 towns lost power, mobile service down in hundreds of areas. Turn on airplane mode.

2\. Show the profile: infant, senior on maintenance medicine, house near a river.

3\. Tap **During**, then **Signal 3**: the PAGASA meaning and a checklist that includes the infant's and the senior's items appear instantly.

4\. Ask kailangan na ba naming lumikas kung malapit kami sa ilog?; show the answer, then tap **Saan galing ito?** to show the passage and its source.

5\. Ask saan na ang bagyo ngayon?; the app says plainly it has no live data and to listen to PAGASA bulletins.

6\. Type lumulubog na ang bahay namin; emergency guidance appears first.

7\. Switch on low-battery mode; ask again; the passage summary appears with no model.

8\. Close on the evaluation screen: retrieval hit rate, correct refusals, faithfulness, median answer time on this phone.

### **10-hour scope**

| Hours | Build |
| :---- | :---- |
| 0 to 1 | React Native app, llama.rn loads the model on the target phone, grammar output works, speed measured |
| 1 to 3.5 | Collect official sources and write about 120 passages (the demo-critical subset of the 300\) with tags and summaries; split across the team |
| 3.5 to 4.5 | signals.json, checklist.json, profile screen, Path A checklists |
| 4.5 to 6 | Synonyms, BM25 index build script, search with tag boosts, refusal gate |
| 6 to 7.5 | Answer prompt, grammar, citation and number checks, emergency wording rule |
| 7.5 to 8.5 | 120-question evaluation set and evaluation screen |
| 8.5 to 9.5 | Low-battery mode, model load and unload, About screen with guide date and sources |
| 9.5 to 10 | Remove internet permission, rehearse twice, record backup video |

**Out of scope:** live storm tracking, location features, maps, push alerts, languages beyond Tagalog and English, an embedding model, the full 300-passage guide (ship 120 and say so).

### **Risks and fallbacks**

| Risk | Fallback |
| :---- | :---- |
| Writing good passages takes longer than planned | Start with the 30 passages the demo touches; label the rest as roadmap |
| Keyword search misses paraphrases | Grow synonyms.json from evaluation misses; show the topic buttons on refusal |
| Model adds facts not in the passage | Number check and fallback to the passage summary; faithfulness metric on screen |
| Slow answers with two passages | Keep passages near 100 words, cap output at 110 tokens, test Q4\_0 |
| Judges ask "why not just a PDF?" | Show a Taglish question answered in two sentences fitted to the household, vs scrolling a 40-page guide |
| Liability for safety advice | Every answer cites an official source and ends with "follow the barangay"; the app states it is a preparedness aid, not an emergency service |
| Commercial reuse of government text | Keep the hackathon version free and credited; seek agency approval before any paid version (Section 4\) |

## **Sources**

• [Tropical Cyclone Research and Review: 2020 cyclones, citing PAGASA](https://doaj.org/article/6d8b8bfa82c54a63a72f9c9adaa08c66)

• [PAGASA: Tropical Cyclone Wind Signals](https://bagong.pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal)

• [Philstar: PAGASA signal wind ranges and lead times](https://www.philstar.com/headlines/2024/11/26/2402968/pagasa-cyclones-are-just-planes-trains/amp/)

• [New Straits Times: Odette day-one NDRRMC figures](https://www.nst.com.my/amp/world/region/2021/12/755494/least-12-killed-typhoon-odette)

• [DZRH: Odette power restoration, NDRRMC](https://www.dzrh.com.ph/post/power-restored-in-150-cities-ndrrmc)

• [SunStar: Odette affected population](https://weekend.sunstar.com.ph/blog/2021/12/20/editorial-lets-help-those-affected-by-odette/)

• [PIA: OCD emergency communications in Siargao](https://mirror.pia.gov.ph/press-releases/2021/12/19/ocd-provides-emergency-comms-between-siargao-and-ndrrmc-after-disruption-due-to-ty-odette)

• [iACADEMY: storm preparedness (secondary)](https://iacademy.edu.ph/story_details?id=1343)

• [ndvlaw: RA 8293 Section 176, works of the government](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)

• [Ertas: LLM benchmarks on Android (vendor blog)](https://www.ertas.ai/blog/llm-android-benchmarks-snapdragon-tensor)

• [Omdia via NoypiGeeks: Q3 2025 phone shares](https://www.noypigeeks.com/?p=260620)

• [bartowski/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF)

• [Meta Llama 3.2 1B Instruct model card and license](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)

• [llama.rn wiki](https://github.com/mybigday/llama.rn/wiki) and [npm page](https://www.npmjs.com/package/llama.rn/)

• [llamadart on pub.dev](https://pub.dev/packages/llamadart)

	