# AGENTS.md

NEVER co-author yourself.

- No `Co-Authored-By` trailer and no AI attribution in commits, pull requests, issues or comments. Commits and pushes go out under the user's name only.

## Project: Sipat

Sipat is an offline-first typhoon companion for Filipino households on budget Android phones. The family sets up a household profile once, with a face photo of every member. The app runs in one of three bagyo phases (before, during, after); the phase changes the whole UI theme, the checklist and the answers, and it can switch automatically from the warnings the user taps, what they tell the assistant, and how close the latest PAGASA bulletin puts the bagyo. During a storm they tap the warning they heard on the radio (PAGASA wind signal 1 to 5, rainfall, storm surge or gale) and get a checklist fitted to their household. They can ask questions in Taglish; answers come only from official preparedness guides that ship inside the app (PAGASA, NDRRMC and OCD, DOH, PHIVOLCS, BFP), with the source one tap away. Llama 3.2 1B runs on the phone to put the matched passage in plain words, but the app works fully without it: the vetted summary shows first, the AI answer second. When the phone has signal, it also fetches a signed feed from our own server (scraped PAGASA bulletins, recommended evacuation centers, hotline and guide updates) and caches it for offline use. Households never pay; LGUs pay for a localized pack (their evacuation centers, hotlines and advisories).

It is built first as a 10-hour hackathon MVP, then piloted with one or two LGUs.

## Current stage

Active development. All application code lives inside `app/`. The agent is free to generate, scaffold, and implement all code inside `app/`.

## Read before working

| Need | Doc |
| :-- | :-- |
| The idea, v2 and v3 decisions, shared names, glossary | [docs/README.md](docs/README.md) |
| Every feature by release (feature source of truth) | [docs/features.md](docs/features.md) |
| Users, evidence, alternatives, assumptions | [docs/problem.md](docs/problem.md) |
| Journey, features by release, content guide, demo, 10-hour plan, evaluation | [docs/solution.md](docs/solution.md) |
| Architecture, retrieval, generation, safety, power, updates, security | [docs/system-design.md](docs/system-design.md) |
| Exact types, data schemas, LLM contract, pack format, HTTP APIs | [docs/api-layer.md](docs/api-layer.md) |
| Splitting work between a frontend and a backend person | [docs/api-layer.md, section 3](docs/api-layer.md#3-frontendbackend-handoff) |
| Business model, pricing, how LGUs buy | [docs/BMC.md](docs/BMC.md) |

`docs/idea-sipat.md` and `docs/Sipat-Product-Overview.md` are the v1 inputs, kept for history. Where they disagree with the docs above, the docs above win. Where those docs disagree on a feature, `docs/features.md` wins.

## Product rules (non-negotiable; enforce them in code and in review)

1. **Offline first, hybrid second.** Every main feature (household setup, phases, warnings, checklists, Ask in Taglish, hotlines, the bundled guide) works in airplane mode and never waits on the network. The release build keeps the INTERNET permission, so the limit lives in code: the network is used only on a user action and only while the app is open, never in the background, and every request appears in the on-screen network log. Allowed connections: the one-time AI model download from Hugging Face, only when the user taps "I-download ang AI" in Settings (MVP; an owner-approved exception to the one pinned host, accepted only if size and SHA-256 match `BUNDLED_MODEL`); `UpdateClient` (feed and packs, MVP stretch), the opt-in `TopicReporter` (Pilot), the opt-in `DamageReporter` (Pilot) and, from Later, the optional `AccountSync` (profile backup after sign-in), all to one pinned host (our own server). The phone never contacts PAGASA or any other site directly; the server-side scraper does that.
2. **Grounded answers only.** The model sees only retrieved guide passages and never answers from its own knowledge. The search gate runs before the model; when nothing matches, the model is never called and the app says "Wala ito sa gabay."
3. **Safety lives in code, not in prompts.** The intent router (emergency, live data, family plan, medicine doses, phase cues), the verifier (citations, numbers, phone-like strings), critical-passage pinning, phase switching (`decidePhase`; the model's `phase_hint` is only a suggestion) and the closing line "Sundin ang utos ng barangay at ng mga awtoridad." are all enforced by code.
4. **Structured and live facts never come from the model.** Hotlines, evacuation centers, contacts, addresses and PAGASA bulletin data are rendered from data. Bulletin text and numbers never enter the model prompt.
5. **Useful without AI.** Low battery (below 15% or the phone's battery saver on), the `none` device tier, AI switched off or a missing model all fall back to vetted summaries. Never block a feature on the model.
6. **Private by design.** The household profile works with no account: the MVP ships static sign-up, login and forgot-password screens with no backend, so nothing leaves the phone and nothing is blocked. The real optional family account is Later: the profile is cache-first, syncs to our server only after sign-in while online, and can be turned off in Settings. Photos and location never sync, and never leave the phone except when the user shares a member card or a damage report (Pilot). The bulletin feed is the same file for everyone and evacuation centers come in province bundles, so a request reveals at most the province; distances are computed on the phone. Location is optional: one coarse GPS reading, asked only when the user taps "Gamitin ang lokasyon ng telepono", never in the background; the PSGC area list is the alternative. No analytics SDKs, no background services, no mandatory accounts.
7. **Traceable content.** Every passage has a source (agency, title, date, URL), a reviewer and a review date. Hotlines and evacuation centers also need a reviewer before they reach phones, scraped or not. Scraped bulletins carry the agency, source URL, issued time and fetched time, and are shown verbatim. The content and feed builds fail without them.
8. **Family data and photos stay on the phone.** The main person sets up the household; it works with no account, and the optional account (Later) only backs up the profile after sign-in. Every member needs a face photo: the photo step has no skip button, and "Mamaya na" saves the member as pending until a photo is added. Member names, notes, photos and location never go into the model prompt, packs, topic reports, logs or network requests. Photos are re-encoded without EXIF, kept in app-private storage, excluded from cloud backup, and leave the phone only when the user shares a member card or attaches them to a damage report (Pilot). Damage-report photos are separate from member photos. Camera permission is asked only when the user taps "Kunan ng litrato".
9. **Face detection, never face recognition.** The bundled ML Kit detector only returns boxes to crop a photo, and the boxes are discarded. No identification, no embeddings, no face comparison. Llama 3.2 1B is text-only and never sees images.
10. **Never invent official facts.** Do not make up signal thresholds, phase distance bands, hotlines, evacuation centers, medicine doses, laws or statistics in code, content, tests or docs. Cite a source or leave a clearly marked placeholder. Phase thresholds live in `content/phase_rules.json`, never as numbers in code.

## Planned stack (MVP)

- Expo development build, React Native New Architecture, TypeScript (strict), Hermes. Android first.
- llama.rn running `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (0.81 GB) with JSON-schema output and token streaming.
- MiniSearch (BM25+) indexed at startup from `content/guide.tl.json`, with Taglish synonyms and tag boosts.
- react-native-mmkv for households and members, the active context (phase and warnings), checklist state, the cached feed and settings.
- expo-image-picker and expo-image-manipulator for the required member photos, and Google ML Kit face detection (bundled model, works offline) through a React Native wrapper, used only to find and crop faces.
- expo-file-system `File.downloadFileAsync` for the one-time model download from Hugging Face on the Settings tap, then a chunked SHA-256 check; expo-document-picker for the offline file import.
- MVP stretch: expo-location for the optional one-shot coarse location, and `fetch` to the one pinned host for the signed feed and packs.
- Node scripts for content validation, pack building, the evaluation harness, and the scheduled scraper that builds and signs the feed.

The docs describe intent. Check exact library APIs against the versions you install.

## Planned layout

```text
app/            all application code (screens, UI components, engine facade, core logic, services, storage)
content/        guide.tl.json, checklist.json, warnings.json, synonyms.json,
                intents.json, sources.json, hotlines.json, phase_rules.json, places.json
scripts/        content validation, pack and feed build and signing, scraper, evaluation
eval/           question sets and results
```

## Conventions

- Use the shared names in `docs/README.md` exactly: phases, warning kinds and levels, profile tags, topic groups, module names, answer events, verifier codes, device tiers and MMKV keys.
- UI copy is Tagalog or Taglish and lives in one place, keyed by name. Code, comments and docs are in English.
- Times are ISO 8601 with `+08:00` (Asia/Manila). Places use PSGC codes.
- Keep core logic pure and deterministic so unit tests and the 120-question evaluation run in Node.
- Screens and UI components in `app/` import only the `Engine` facade, never lower-level core logic, internal services, or raw native modules directly. Change the `Engine` contract only as `docs/api-layer.md` section 3.7 describes.
- Do not add a dependency that needs the network at runtime.
- In docs: link sources inline, mark our own analysis *Reasoning:*, mark secondary figures **Unverified**, treat targets as proposals to measure, and tag scope as MVP, MVP stretch, Pilot or Later.
