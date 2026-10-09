# Bagyo Buddy

Offline typhoon companion for Filipino households on budget Android phones. See [AGENTS.md](AGENTS.md) and [docs/](docs/README.md) for the product and design.

## Requirements

- Node.js 22 or newer, npm
- For Android: Android Studio (SDK + platform tools), a JDK 17, and a device with USB debugging or an emulator
- Expo Go will NOT work: the app uses native modules (`react-native-mmkv`, `llama.rn`), so it needs a development build

## Setup

```bash
npm install
npm run validate:content   # checks content/*.json (sources, reviewers, dates)
npm run typecheck
npm test
```

## Run

### Web preview (quickest, no device needed)

```bash
npm run web
```

Uses the in-memory store and no AI model; answers fall back to vetted summaries.

### Android development build

```bash
npx expo run:android      # prebuilds android/, installs the debug app, starts Metro
```

Later sessions, with the dev build already installed:

```bash
npm start                 # then press "a"
```

Debug builds keep `android.permission.INTERNET` so Metro works over USB or Wi-Fi. Release builds strip it through `plugins/withReleaseNoInternet.js` (AGENTS.md rule 1).

### Release build

```bash
npx expo run:android --variant release
```

## Engine: real or mock

The UI talks only to the `Engine` facade (`app/engine`).

- Default: the real engine (`createEngine`), with MMKV storage, MiniSearch, power policy and the on-device model.
- Mock: set `EXPO_PUBLIC_ENGINE=mock` before starting, or use the toggle under "Developer" at the bottom of the Home screen.

```bash
EXPO_PUBLIC_ENGINE=mock npm run web
```

## Language

Every screen header has a TL | EN switch (also in Family > Settings); the choice is saved in settings. English mode translates the app's own text. Guide passages, checklist items and hotline names stay in Filipino because they come from reviewed official sources. Fixed safety lines show the Filipino original with an English translation underneath. Those English translations still need content review. English questions work through English synonyms in `content/synonyms.json`.

## On-device model (optional)

The app works fully without AI. To enable it, put `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (about 0.81 GB) in the app's document directory under `models/`. AI is skipped automatically when the model is missing, the device tier is `none`, AI is switched off, the battery is below 15%, or battery saver is on.

## Scripts

| Script | What it does |
| :--- | :--- |
| `npm start` | Start Metro |
| `npm run web` | Web preview |
| `npm run android` | Start Metro and open Android |
| `npm test` | Vitest unit tests (core, services, mock and real engine) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate:content` | Validate bundled content |

## Layout

```text
app/        engine facade, core logic, services, UI
content/    bundled guide, checklist, warnings, hotlines, sources
plugins/    Expo config plugins
scripts/    content validation
docs/       product and system design
```
