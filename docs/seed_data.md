# Demo seed data

Demo-only data so the real engine shows a filled-in household, a bulletin, a storm track and evacuation centers instead of empty states. It is **not official content**: every name, center, contact and bulletin is invented and marked `DEMO`. Scope: demo builds only; nothing here ships in a release build.

Source: [`app/engine/demoSeed.ts`](../app/engine/demoSeed.ts). Tests: [`app/engine/demoSeed.test.ts`](../app/engine/demoSeed.test.ts).

## Turning it on

| Step | Command or action |
| :--- | :--- |
| Start a demo build | `EXPO_PUBLIC_DEMO_SEED=1 npx expo start` (real engine; `EXPO_PUBLIC_ENGINE` unset or `real`) |
| Reset to the seed | Clear the app's data (or reinstall). The seed is written only when the store has no household. |
| Turn it off | Start without `EXPO_PUBLIC_DEMO_SEED`. Data already seeded stays until app data is cleared. |

What the engine does when the flag is `1`:

- On `init()`, if the store has no household, it writes the household, its checklist ticks and the cached feed. User edits after that persist; the seed never overwrites them.
- On every `init()`, it merges the demo content over the bundled files: one demo source, demo centroids for the demo area, and demo evacuation centers.
- It uses an in-memory feed client: `feed.refresh()` returns the demo bulletin with fresh timestamps, makes no request and adds nothing to `updates.networkLog()`. `info().online` stays `false`.

The mock engine (`EXPO_PUBLIC_ENGINE=mock`) ignores this flag; it keeps its own SAMPLE fixtures.

## What is seeded and where the frontend reads it

All of it comes through the existing `Engine` facade; no new API.

| Data | Engine API | Seeded value |
| :--- | :--- | :--- |
| Household | `profiles.active()` | `Bahay nina Maria (DEMO)`, id `demo-household`, 1 pet, home tags `near_sea`, `light_materials`, `low_lying`. Derived tags: `infant`, `child`, `senior`, `pwd`, `maintenance_meds`, `pets` |
| Members | `family.members()`, `family.pending()` | Maria (DEMO), main person, adult, phone `09170000001`; Jose (DEMO), spouse, adult; Lola Ising (DEMO), parent, senior, needs `maintenance_meds` and `pwd`, note "DEMO – gamot sa altapresyon, gumagamit ng tungkod"; Mika (DEMO), child; Baby Joy (DEMO), infant |
| Member photos | `family.pending()` | All 5 are `pending`. No photo files are seeded, so the "Kulang pa ang litrato" flow can be shown |
| Location | `family.location.get()` | `{ psgc: '083747010' }`: Barangay Libertad, City of Tacloban, Leyte (real PSGC codes) |
| Plan | `profiles.active().plan`, `family.card()` | Evacuation center "DEMO Paaralang Sentral (evacuation center)" (`evacuationCenterId: 'demo-center-school'`), meeting place "DEMO – harap ng barangay hall", contacts Tito Ben (DEMO) `09170000002` and Ate Liza (DEMO) `09170000003` |
| Checklist ticks | `checklist.view()` | Ticked: `now-listen-radio`, `gobag-water`, `gobag-food`, `gobag-flashlight-batteries` |
| Bulletin | `feed.get()`, `evacuation.view().bulletin` | "Bagyong Demo" (international name DEMO), category `TY`, issued 45 minutes before seeding, about 260 km east of Tacloban, moving west. TCWS 2 over Leyte and Eastern Samar. Title and text say it is not a real PAGASA bulletin. Status `fresh` |
| Storm measure | `evacuation.view().storm` | Computed by `measureStorm` from the bulletin and the demo centroid: about 264 km E now, closest forecast point about 12 km, `signalHere: 2` |
| Evacuation centers | `evacuation.view().centers` | Ranked nearest first by `rankCenters`: DEMO Paaralang Sentral (about 0 km NW, capacity 300, accessible), DEMO Covered Court ng Barangay (about 1 km SE, capacity 150, accepts pets), DEMO Parish Hall (about 2 km N, capacity 120) |
| Phase | `context.get()` | Switches to `during` on the first `init()`, from the bulletin signal over the household's province (`reason.source: 'bulletin'`, "May signal para sa inyong lugar."). Undo and manual phase picks work as usual |
| Demo source | `guide.sources()` | `demo-seed`: agency "Sipat (DEMO)", title "DEMO seed data – hindi opisyal, para sa demo lamang" |

Bulletin and storm timestamps follow the clock at seeding or refresh time, so the card is never stale during a demo. Pull to refresh re-issues the bulletin with new timestamps.

Where it shows in the app (MVP stretch screens):

| Screen | Seeded data shown |
| :--- | :--- |
| Home | Bulletin tile (storm name, category, `Signal 2 sa inyong lugar`, distance and direction now); household center with the meeting place; pending-photo reminders |
| Bagyo at paglikas (tap the Home bulletin tile) | Bulletin card with signal areas named from `places.json`, readable issued and fetched times, the verbatim bulletin text, the map-free track view with the forecast points, and the three ranked centers under "Ang barangay ang magsasabi kung kailan lilikas." The family's center is marked "Plano ng pamilya". Pull to refresh or "I-refresh ang balita" calls `feed.refresh()` |
| Ask ("nasaan na ang bagyo?") | The same bulletin card |
| Hotlines, Family | Plan contacts, members and the area |

On web, MMKV saves to the browser's `localStorage` (`sipat\…` keys). If the app opens on "May problema sa app", the browser holds data from an older build: clear the site data for the dev server's origin (DevTools, Application, Clear site data) and reload. The console shows the cause as `[engine.init]` in dev builds.

## What stays a placeholder, on purpose

AGENTS rule 10 forbids inventing official facts. The seed does not touch these:

- **Guide passages** keep `reviewed_by: "PLACEHOLDER: pending human reviewer"`. A fake reviewer would misstate a review that never happened.
- **`phase_rules.json`** keeps its placeholder bands and evacuation threshold. So `evacuation.view().centersFirst` stays `false` and the distance bands never trigger a switch. The signal-based switch to `during` still works because it is a product rule, not a sourced threshold.
- **Hotlines** stay the real bundled ones. No demo numbers are added.
- **Warnings** (`warnings.json`) keep their `confirmed: false` entries.
- **AI answers** need the model file on the phone. Without it, Ask shows the vetted summary (`ai_status: skipped, no_model`).
- **The evaluation report** is the real Node report (`eval/results/latest.json`), not seeded.

The demo coordinates (the barangay, city and province centroids and the three centers) are rough approximations around Tacloban City. They are not surveyed and are not the real locations of any evacuation center.
