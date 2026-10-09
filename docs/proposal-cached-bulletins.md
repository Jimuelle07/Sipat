# Proposal: cached storm bulletins

**Status:** Superseded (2026-10-09) by the v3 feed design. See [features.md, section 7](features.md#7-evacuation-and-bagyo-forecast) (latest PAGASA bulletin card), [features.md, section 10](features.md#10-updates-scraper-and-lgu-packs) (bagyo scraper and feed sync) and [system-design.md](system-design.md) for how it works.

## The idea

Families often lose signal hours into a storm, and the last PAGASA bulletin they saw is gone. Keep the latest bulletin the phone received while signal lasted, and show it offline with its age.

## Decisions resolved by v3

| Question in this proposal | Resolution |
| :-- | :-- |
| Scraping and a second host | A scheduled server-side job scrapes PAGASA's public bulletins. The phone never contacts PAGASA; it fetches a small signed feed from our one pinned host, on app open and pull to refresh only |
| Who reviews bulletins, and how fast | Nobody, by design: bulletins are auto-published for speed as live data, not guide passages. They are shown verbatim with source URL and issued time; a parse failure keeps the previous feed and marks it stale, never guessing a field |
| Bulletins in the model prompt | Never. Bulletin text and numbers are rendered from data; the model never sees or restates them |
| Loosen safety rule 2 for the live-data route | Yes: with a cached bulletin the live-data route shows the bulletin card (issued and fetched age, "Makinig pa rin sa radyo", stale prompt 3 hours after issue); without one, the fixed "Walang live na balita..." reply. The model is still never called |
| LGU-pack only or national | National, free: the feed is the same file for everyone (MVP stretch) |

## Still open

| Question | How to settle |
| :-- | :-- |
| Does PAGASA permit scraping and redistributing its bulletins? | Ask in writing, ideally for a data feed, before the Pilot |
| Does the 3-hour staleness window fit PAGASA's bulletin intervals? | Compare with PAGASA's actual intervals; cite the source when found |
| Does the cached card cause anyone to skip the radio? | Usability test with an old card; pilot interviews after a storm |
