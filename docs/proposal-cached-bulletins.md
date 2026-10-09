# Proposal: cached storm bulletins

**Status:** proposal, not adopted (2026-10-09). **Scope:** Pilot at the earliest, likely Later. Nothing here changes the MVP or the [LLM contract](api-layer.md#8-llm-contract-mvp).

## Problem

Families often lose signal hours into a storm. The last PAGASA bulletin they saw is gone from their feed, and the app answers storm questions only with the fixed "no live data" reply ([system-design.md, section 8](system-design.md#8-safety-policy), rule 2). The idea: keep the last bulletin the phone received before signal dropped, and let the family see it offline, with its age shown.

## Why the first draft cannot ship

The first draft put fetched articles into the model prompt and had the model cite them with timestamps. Checked against [AGENTS.md](../AGENTS.md) and the current docs:

| Conflict | Rule or doc |
| :-- | :-- |
| Fetching articles needs the network. The MVP has no INTERNET permission; in the Pilot only `UpdateClient` and `TopicReporter` may go online, to one pinned host | Rule 1 |
| Storm strength, track and timing questions are the live-data route: fixed reply, no search, no model | Safety rule 2; [solution.md](solution.md) principle 7, "Honest about limits" |
| The closing line was in the prompt and model output. Code appends it; the model never writes it | Rule 3; [system-design.md, section 7](system-design.md#7-verification) |
| Source titles and fetch times were written by the model (`sources_cited`, `fetched_at`). Those are structured facts and must be rendered from data | Rule 4 |
| Scraped articles have no reviewer or review date | Rule 7 |
| The worked example stated a signal level and wind speeds not copied from a reviewed passage | Rule 10 |
| `used` was a free string list (the contract injects an enum of the given IDs); `maxLength` 450 against the verifier's 400; extra fields before `answer` delay streaming and exceed `n_predict` | [api-layer.md, section 8](api-layer.md#8-llm-contract-mvp) |
| The system prompt and examples are several times the ~180-token fixed budget inside `n_ctx` 1,024 | [system-design.md, section 6.1](system-design.md#61-messages) |
| A location line adds a place name the verifier does not check | Safety rule 14 |

## Compliant design sketch

**Delivery.** Bulletins arrive only as reviewed content inside the signed LGU pack, through `UpdateClient` to the one pinned host ([system-design.md, section 12](system-design.md#12-update-and-pack-system), [section 14](system-design.md#14-lgu-pack-pipeline-pilot)). Each request shows in the on-screen network log. No scraping, no second host, no background fetch (rule 6: no background services). The family gets a bulletin only when they open the app or tap update while they still have signal.

**Record.** Each bulletin entry carries:

| Field | Meaning |
| :-- | :-- |
| `id` | Stable ID |
| `source` | Agency, title, URL |
| `issued_at` | When the agency issued it, ISO 8601 `+08:00` |
| `fetched_at` | When this phone downloaded the pack, set by code |
| `reviewer`, `reviewed_at` | Who checked the text against the agency original, and when |
| `areas` | PSGC codes the bulletin covers |
| `text` | The reviewed excerpt, copied verbatim, no paraphrase |

The content build fails if any field is missing (rule 7).

**Display.** A bulletin card rendered from data, never from the model:

- Badge "Na-download noong: {fetched_at}" and the issued time.
- Staleness banner reusing the stale-warning rule ([solution.md](solution.md), stale warning; README S5): after 3 hours from `issued_at`, "Makinig muli sa radyo. Baka nagbago na ang signal." *Reasoning:* the same 3-hour window keeps one rule for users to learn; whether it fits bulletin cadence is an open question below.
- The source link is one tap away, as for guide passages.
- The card never computes an arrival time.

**Ask flow.** The live-data route keeps its fixed reply unchanged. If a cached bulletin matches the household's area, its card shows below the fixed reply. The model never sees bulletin text in this first version; the prompt stays as safety rule 14 defines it.

*Reasoning:* keeping bulletins out of the prompt avoids widening the verifier's allowed-number set with unreviewed figures, and keeps the token budget intact. Feeding bulletins to the model would be a separate, later proposal with its own evaluation.

## Decisions needed from the team

1. Do we loosen safety rule 2 so the live-data route can show a cached card, or keep it strictly fixed?
2. Who reviews bulletins (the LGU, us, a partner), and how fast? A bulletin reviewed after the next one is issued is useless.
3. Do PAGASA and the LGU permit redistributing bulletin text inside a pack? Get this in writing before building.
4. Does this stay LGU-pack only (LGU pays, rule from [BMC.md](BMC.md)), or ship nationally?
5. Does this weaken the "honest about limits" pitch ([solution.md](solution.md) principle 7)? The card must still read as "old, listen to the radio", not as live data.

## Open questions to measure

| Question | How to measure |
| :-- | :-- |
| How long from PAGASA issuing a bulletin to it being reviewed and in a signed pack | Dry run with one pilot LGU during a real advisory |
| Do residents read the fetch time and treat an old card as old | Clickable mock-up with 5 to 10 residents, as in [problem.md](problem.md) |
| Is 3 hours the right staleness window for bulletins | Compare with PAGASA's actual bulletin intervals; cite the source when found |
| Pack size and download time per bulletin on a budget phone | Measure on the reference phone |
| Does the cached card cause anyone to skip the radio | Pilot interviews after a storm |

All targets above are proposals to measure, not commitments.
