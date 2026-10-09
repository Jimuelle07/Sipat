# Index: Bagyo Buddy

Map of the important docs and files. Start with [AGENTS.md](AGENTS.md) for the rules, then [docs/README.md](docs/README.md) for shared names.

## Root

| File | Purpose |
| :-- | :-- |
| [AGENTS.md](AGENTS.md) | Project summary, non-negotiable product rules, stack, conventions |
| [README.md](README.md) | Requirements and how to run the app |
| [package.json](package.json) | Dependencies and scripts: `start`, `android`, `web`, `test`, `typecheck`, `validate:content` |
| [app.config.ts](app.config.ts) | Expo app config |
| [index.ts](index.ts) | App entry point |
| [tsconfig.json](tsconfig.json) | TypeScript (strict) config |
| [vitest.config.ts](vitest.config.ts) | Unit test config |

## Docs

| Doc | What it covers |
| :-- | :-- |
| [docs/README.md](docs/README.md) | The idea, v2 decisions, shared names, glossary |
| [docs/problem.md](docs/problem.md) | Users, evidence, alternatives, assumptions |
| [docs/solution.md](docs/solution.md) | Journey, screens, features by release, content guide, demo, build plan, evaluation |
| [docs/features.md](docs/features.md) | Catalog of every feature by area and release |
| [docs/system-design.md](docs/system-design.md) | Architecture, retrieval, generation, safety, power, updates, security |
| [docs/api-layer.md](docs/api-layer.md) | Types, data schemas, LLM contract, pack format, HTTP APIs, frontend/backend handoff (section 3) |
| [docs/BMC.md](docs/BMC.md) | Business model, pricing, how LGUs buy |
| [docs/proposal-cached-bulletins.md](docs/proposal-cached-bulletins.md) | Proposal (not adopted): cached storm bulletins |
| [docs/Offline-P2P-Libraries-Research.md](docs/Offline-P2P-Libraries-Research.md) | Research: offline phone-to-phone libraries for React Native |
| [docs/idea-bagyo-buddy.md](docs/idea-bagyo-buddy.md) | v1 input, history only |
| [docs/Bagyo-Buddy-Product-Overview.md](docs/Bagyo-Buddy-Product-Overview.md) | v1 input, history only |

## Application code (`app/`)

| Path | Purpose |
| :-- | :-- |
| [app/ui/App.tsx](app/ui/App.tsx) | Root component |
| [app/ui/screens/](app/ui/screens/) | Home, Ask (+ `ask/chat.ts`), Profile, Guide, Hotlines screens |
| [app/ui/components/](app/ui/components/) | Shared UI: Button, Card, Chip, Field, Screen, SafetyText, ProgressBar, LanguageToggle, etc. |
| [app/ui/navigation/](app/ui/navigation/) | Bottom tabs and route types |
| [app/ui/context/](app/ui/context/) | `EngineProvider` and `useEngine` hook |
| [app/ui/strings.ts](app/ui/strings.ts), [app/ui/strings/](app/ui/strings/) | All UI copy (Tagalog/Taglish), keyed by name |
| [app/ui/i18n/](app/ui/i18n/) | Language switching |
| [app/ui/theme/](app/ui/theme/) | Design tokens |
| [app/engine/](app/engine/) | `Engine` facade (the only API screens import), ask pipeline, mock engine, text export, fixtures |
| [app/core/](app/core/) | Pure logic: search, gate, intent routing, prompt, verifier, checklist, household derivation, normalization, content validation |
| [app/services/](app/services/) | Native-facing services: model (llama.rn), power, storage (MMKV), packs |
| [app/types/](app/types/) | Shared types: core, engine, ask, content, services |
| [app/content/index.ts](app/content/index.ts) | Loads bundled content |

## Content (`content/`)

| File | Holds |
| :-- | :-- |
| [guide.tl.json](content/guide.tl.json) | Guide passages with sources and reviewers |
| [checklist.json](content/checklist.json) | Checklist items by phase, warning and tags |
| [warnings.json](content/warnings.json) | Warning kinds and levels |
| [intents.json](content/intents.json) | Intent router words (emergency, live data, plan, medicine) |
| [synonyms.json](content/synonyms.json) | Taglish search synonyms |
| [sources.json](content/sources.json) | Official source documents |
| [hotlines.json](content/hotlines.json) | Hotlines rendered from data |

## Scripts and build

| File | Purpose |
| :-- | :-- |
| [scripts/validate-content.ts](scripts/validate-content.ts) | Content validation (`npm run validate:content`) |
| [plugins/withReleaseNoInternet.js](plugins/withReleaseNoInternet.js) | Expo config plugin removing INTERNET permission from release builds |
