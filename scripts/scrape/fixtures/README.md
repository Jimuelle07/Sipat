# Scraper fixtures

Test inputs for `scripts/scrape/parse.ts`. Nothing here ships with the app.

| File | Kind | Source |
| :-- | :-- | :-- |
| `swb-no-active.html` | Trimmed copy of the real page | `https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin`, fetched **2026-10-10** (Asia/Manila). The page reported "No Active Tropical Cyclone within the Philippine Area of Responsibility". Navigation, scripts and tracking removed; only the bulletin container kept. |
| `swb-sample-active.html` | Synthetic | **SAMPLE – hindi totoong bulletin.** Written by hand to mirror the real active-bulletin DOM (one `id="tcwb-1"` tab with heading, issued time, Location/Movement/Strength panels, a Forecast Position list and a Wind Signal table with two levels). The November 2024 archived capture was used as the structural reference; no real bulletin facts are asserted. Area names are real place names so the PSGC lookup resolves them. |

Notes:

- The live page renders the active bulletin inside `.tab-content` as one `div role="tabpanel" id="tcwb-N"`
  per active bagyo; when none is active it renders the no-active panel instead.
- Active bulletins are also published as PDFs (`pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin_*.pdf`).
  This parser reads the HTML page only; the PDF is not parsed.
- Re-fetch `swb-no-active.html` if PAGASA's markup changes, and keep the fetch date above current.
