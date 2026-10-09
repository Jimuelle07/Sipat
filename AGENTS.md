# AGENTS.md

NEVER co-author yourself.

- No `Co-Authored-By` trailer and no AI attribution in commits, pull requests, issues or comments. Commits and pushes go out under the user's name only.

## Project: Bagyo Buddy

Bagyo Buddy is an offline typhoon companion for Filipino households on budget Android phones. The family sets up a household profile once. During a storm they tap the warning they heard on the radio (PAGASA wind signal 1 to 5, rainfall, storm surge or gale) and get a checklist fitted to their household. They can ask questions in Taglish; answers come only from official preparedness guides that ship inside the app (PAGASA, NDRRMC and OCD, DOH, PHIVOLCS, BFP), with the source one tap away. Llama 3.2 1B runs on the phone to put the matched passage in plain words, but the app works fully without it: the vetted summary shows first, the AI answer second. Households never pay; LGUs pay for a localized pack (their evacuation centers, hotlines and advisories).

It is built first as a 10-hour hackathon MVP, then piloted with one or two LGUs.

## Current stage

Docs only (v2, 2026-10-09). There is no app code yet. Do not scaffold or write app code unless the user asks.

## Read before working

| Need | Doc |
| :-- | :-- |
| The idea, v2 decisions, shared names, glossary | [docs/README.md](docs/README.md) |
| Users, evidence, alternatives, assumptions | [docs/problem.md](docs/problem.md) |
| Journey, features by release, content guide, demo, 10-hour plan, evaluation | [docs/solution.md](docs/solution.md) |
| Architecture, retrieval, generation, safety, power, updates, security | [docs/system-design.md](docs/system-design.md) |
| Exact types, data schemas, LLM contract, pack format, HTTP APIs | [docs/api-layer.md](docs/api-layer.md) |
| Splitting work between a frontend and a backend person | [docs/api-layer.md, section 3](docs/api-layer.md#3-frontendbackend-handoff) |
| Business model, pricing, how LGUs buy | [docs/BMC.md](docs/BMC.md) |

`docs/idea-bagyo-buddy.md` and `docs/Bagyo-Buddy-Product-Overview.md` are the v1 inputs, kept for history. Where they disagree with the docs above, the v2 docs win.

## Product rules (non-negotiable; enforce them in code and in review)

1. **Offline first.** Every core feature works in airplane mode. The MVP release build has no INTERNET permission. In the Pilot build, only `UpdateClient` and the opt-in `TopicReporter` may touch the network, only to one pinned host, and every request appears in the on-screen network log.
2. **Grounded answers only.** The model sees only retrieved guide passages and never answers from its own knowledge. The search gate runs before the model; when nothing matches, the model is never called and the app says "Wala ito sa gabay."
3. **Safety lives in code, not in prompts.** The intent router (emergency, live data, family plan, medicine doses), the verifier (citations, numbers, phone-like strings), critical-passage pinning and the closing line "Sundin ang utos ng barangay at ng mga awtoridad." are all enforced by code.
4. **Structured facts never come from the model.** Hotlines, evacuation centers, contacts and addresses are rendered from data.
5. **Useful without AI.** Low battery (below 15% or the phone's battery saver on), the `none` device tier, AI switched off or a missing model all fall back to vetted summaries. Never block a feature on the model.
6. **Private by design.** The household profile never leaves the phone. No analytics SDKs, no location permission, no background services, no household accounts.
7. **Traceable content.** Every passage has a source (agency, title, date, URL), a reviewer and a review date. The content build fails without them.
8. **Family data and photos stay on the phone.** The main person sets up the household; there is no online account. Member names, notes and photos never go into the model prompt, packs, topic reports, logs or SMS text. Photos are optional, re-encoded without EXIF, kept in app-private storage, excluded from cloud backup, and leave the phone only when the user shares a member card. Camera permission is asked only when the user taps "Kunan ng litrato".
9. **Face detection, never face recognition.** The bundled ML Kit detector only returns boxes to crop a photo, and the boxes are discarded. No identification, no embeddings, no face comparison. Llama 3.2 1B is text-only and never sees images.
10. **Never invent official facts.** Do not make up signal thresholds, hotlines, medicine doses, laws or statistics in code, content, tests or docs. Cite a source or leave a clearly marked placeholder.

## Planned stack (MVP)

- Expo development build, React Native New Architecture, TypeScript (strict), Hermes. Android first.
- llama.rn running `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (0.81 GB) with JSON-schema output and token streaming.
- MiniSearch (BM25+) indexed at startup from `content/guide.tl.json`, with Taglish synonyms and tag boosts.
- react-native-mmkv for households and members, the active context, checklist state and settings.
- MVP stretch: expo-image-picker and expo-image-manipulator for member photos, and Google ML Kit face detection (bundled model, works offline) through a React Native wrapper, used only to find and crop faces.
- Node scripts for content validation, pack building and the evaluation harness.

The docs describe intent. Check exact library APIs against the versions you install.

## Planned layout (once coding starts)

```text
app/            screens (frontend)
src/ui/         components, hooks, UI copy (frontend)
src/engine/     the Engine facade: the only API screens call, plus createMockEngine,
                fixtures and contract tests (backend)
src/core/       pure TypeScript: normalize, route, createIndex, search, gate, buildPrompt,
                verify, buildChecklist, verifyPack, plus the ask() orchestrator built
                with createAsk(deps). No React Native imports; runs in Node.
src/services/   ModelManager, PowerPolicy, Store, PackManager, ShareService,
                UpdateClient (Pilot), TopicReporter (Pilot)
content/        guide.tl.json, checklist.json, warnings.json, synonyms.json,
                intents.json, sources.json, hotlines.json
scripts/        content validation, pack build and signing, evaluation
eval/           question sets and results
```

## Conventions

- Use the shared names in `docs/README.md` exactly: phases, warning kinds and levels, profile tags, topic groups, module names, answer events, verifier codes, device tiers and MMKV keys.
- UI copy is Tagalog or Taglish and lives in one place, keyed by name. Code, comments and docs are in English.
- Times are ISO 8601 with `+08:00` (Asia/Manila). Places use PSGC codes.
- Keep `src/core` pure and deterministic so unit tests and the 120-question evaluation run in Node.
- Screens (`app/`, `src/ui/`) import only `src/engine`, never `src/core`, `src/services` or native modules. Change the `Engine` contract only as `docs/api-layer.md` section 3.7 describes.
- Do not add a dependency that needs the network at runtime.
- In docs: link sources inline, mark our own analysis *Reasoning:*, mark secondary figures **Unverified**, treat targets as proposals to measure, and tag scope as MVP, MVP stretch, Pilot or Later.
