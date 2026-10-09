# Bagyo Buddy: Business Model Canvas

Households use Bagyo Buddy free forever; LGUs pay an annual Bantay license for a localized pack, out of the disaster fund the law already requires them to keep.

Related: [README](README.md) · [Problem](problem.md) · [Solution](solution.md)

## 1. Summary

- **Who uses it.** Households in typhoon-prone areas ([problem.md](problem.md) has the persona and evidence). They never pay, never make an account and never see an ad.
- **Who pays.** Municipal and city LGUs, through their DRRM offices, buy the **Bantay** license. NGOs, schools and CSR sponsors can buy or sponsor licenses too.
- **The logic.** LGUs already have a legal duty and a budget line to prepare households (RA 10121). Bagyo Buddy turns part of that budget into guidance that stays on each household's phone when power and signal fail.
- **What we never do.** No ads, no data sales, no household payments. The household app has no payment or license check, so it works fully offline.

## 2. The canvas at a glance

| Block | Bagyo Buddy |
| :-- | :-- |
| Customer segments | Households (users, free); municipal and city DRRMOs (payers); barangays (pilot partners); NGOs, schools, CSR sponsors (co-payers) |
| Value propositions | Households: what to do for your own household, offline, with sources. LGUs: their guidance on every phone even when towers are down; anonymous insight; preparedness evidence for the SGLG |
| Channels | LGU rollout via barangay assemblies, BHWs, school drills; radio; offline pack sharing; Play Store. To LGUs: OCD regional offices, DRRMO networks, leagues, DILG |
| Customer relationships | Households: self-serve, no account. LGUs: pilot success plan, training, pre-season check, post-season review |
| Revenue streams | Bantay annual license; optional onboarding fee; CSR-sponsored licenses; grants; NGO and school licenses at 20% off |
| Key resources | Reviewed, source-traceable Tagalog guide; evaluation set; offline stack; signing keys and pack pipeline; LGU relationships |
| Key activities | Writing and reviewing content; building LGU packs; testing on budget phones; pilots and training; procurement compliance |
| Key partners | PAGASA, NDRRMC/OCD, DOH, PHIVOLCS, BFP; LGU DRRMOs; Liga ng mga Barangay; NGOs; sponsors; Meta (Llama), Google Play, AWS |
| Cost structure | Team; content review; legal and approvals; registration and compliance; training travel; tiny infrastructure |

## 3. The nine blocks

### Customer segments

**Users: households.** A parent on a budget Android phone caring for an infant, a senior or someone on maintenance medicine. The home tags decide what comes first:

| Segment | Main hazard | What comes first |
| :-- | :-- | :-- |
| Riverside (`near_river`) | River floods | Rainfall warnings, readiness to evacuate |
| Coastal (`near_sea`) | Storm surge, gale | Surge and gale warnings; fisherfolk guidance (Later) |
| Upland (`slope`) | Landslides | Warning signs, when to leave the slope |
| Urban flood-prone (`low_lying`) | Flash floods, long outages | Floodwater and electrical safety |

**Payers: LGUs.** Municipal and city DRRMOs are the main buyer: they hold the Local DRRM Fund and the duty to prepare households. Barangays are pilot partners and the delivery arm. *Reasoning:* the municipality or city is the natural license holder; its barangays roll the app out door to door.

**Co-payers.** NGOs and humanitarian groups with preparedness programs; schools, for DRRM drills; CSR sponsors such as telcos, electric cooperatives, banks and insurers in typhoon-prone areas.

### Value propositions

| Segment | What they get |
| :-- | :-- |
| Households | A checklist for their household and the warning they heard; Taglish answers from official guides, with sources; works with no signal and on low battery; free and private |
| LGU DRRMO | Their evacuation centers, hotlines and advisories on every household's phone, even when networks fail; rollout with no servers or accounts; opt-in anonymous topic counts; training |
| Mayor and council | A visible, low-cost preparedness program measured in households prepared; evidence for the SGLG's Disaster Preparedness area |
| NGOs and sponsors | A measurable outcome; credit on the About screen; no ads and no access to user data |

### Channels

**To households**

1. **LGU rollout:** barangay assemblies, BHW house visits and school drills, where officers help families set up on a calm day.
2. **Radio:** stations that announce the signals can remind listeners to tap the warning in the app. *Reasoning:* radio is what families still hear when power and signal are out.
3. **Offline pack sharing:** signed packs pass phone to phone (Bluetooth, Quick Share, Messenger, a barangay laptop).
4. **Google Play**, with the model as an AI pack ([Play for On-device AI](https://developer.android.com/google/play/on-device-ai)).

**To LGUs:** OCD regional offices and DRRMO networks; the leagues of municipalities and cities and the Liga ng mga Barangay; DILG, which administers the SGLG; DRRM events, with a live demo in airplane mode. Each pilot becomes the case study that sells the next.

### Customer relationships

**Households** are self-serve: no account, no login, no help desk. The About screen shows the guide date, sources and reviewers. Local questions go to the barangay.

**LGUs** get a managed relationship that follows the typhoon season:

| Stage | What happens |
| :-- | :-- |
| Pilot | A written success plan: barangays, household count, survey method, dates |
| Onboarding | We build the LGU pack with the DRRMO; an LGU approver signs off before publishing |
| Training | Officers and BHWs learn to set up households and share packs offline |
| Pre-season check | Refresh the pack, confirm hotlines and centers |
| Post-season review | Survey results, content gaps, renewal proposal |

### Revenue streams

| Stream | Who pays | Notes |
| :-- | :-- | :-- |
| Bantay annual license | Municipal and city LGUs | Core revenue, through government procurement |
| Onboarding and training fee | LGUs, optional | One-time; can be folded into the license |
| CSR-sponsored licenses | Telcos, electric cooperatives, banks, insurers | The sponsor pays for an LGU's license and is credited on the About screen |
| Humanitarian grants | Foundations, development programs | Fund content (such as the Cebuano guide) and pilots |
| NGO and school licenses | NGOs, humanitarian groups, schools | 20% off Bantay, as in v1 |

Households pay nothing, ever.

### Key resources

- **The guide:** about 300 short Tagalog passages from official sources, each with its source, reviewer and review date. The real asset.
- **The evaluation set:** 120 labeled Taglish questions ([solution.md](solution.md)).
- **The offline stack, signing keys and pack pipeline**, so content works and stays trustworthy without a network.
- **LGU relationships and case studies.**

### Key activities

Writing, sourcing and reviewing passages; building and refreshing LGU packs; testing the app on budget phones; running pilots, training and post-season reviews; staying compliant (registration, PhilGEPS, invoices, agency approvals, data privacy); guarding the signing keys.

### Key partners

| Partner | Role |
| :-- | :-- |
| PAGASA, NDRRMC/OCD, DOH, PHIVOLCS, BFP | Content sources; approval for paid use (RA 8293, Sec. 176) |
| LGU DRRMOs | Buyers; co-authors and reviewers of local packs |
| Liga ng mga Barangay; leagues of municipalities and cities | Reach to LGUs |
| NGOs and humanitarian groups | Co-delivery, grants, discounted licenses |
| Telcos, electric cooperatives, banks, insurers | CSR sponsors. They never touch content or data |
| Meta (Llama), Google Play, AWS | The model and its license; distribution and the model's AI pack; hosting for KB-size packs |

### Cost structure

| Cost | Driver |
| :-- | :-- |
| Team | Engineers, a content writer, LGU onboarding. The largest cost |
| Content review | DRRM professionals; grows with packs and languages |
| Legal and approvals | Agency approval for paid use; privacy review. Mostly one-time |
| Registration and compliance | Business registration, BIR invoices, PhilGEPS |
| Travel and training | Per LGU |
| Infrastructure | S3 and CloudFront for KB-size packs; a small LGU portal. Near zero |
| Distribution | Google Play developer account, a one-time fee |

The 0.81 GB model comes from Google Play as an AI pack or from a pinned public mirror such as [Hugging Face](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF), checked by SHA-256. Our CDN never serves model bytes.

## 4. Tiers and pricing

### Ambon: households, free forever

The list below is the full household product. Some items ship after the hackathon; [solution.md](solution.md#5-features-by-release) has the release for each.

- All safety features: the warning picker (wind signal, rainfall, storm surge, gale), household checklists, Taglish questions with sources, the emergency card, the "Ligtas kami" text composer, low-battery mode.
- Family setup by the main person, member by member, with optional photos kept only on the phone; a "Bilangan" roll call and a "Hinahanap" card for each member in case someone gets separated.
- More than one household profile (for example the grandparents' house in the province); a printable family plan and go-bag list.
- Fully offline with no account. Smart Update is free whenever the family chooses to go online, and a signed pack can also come from a neighbor's phone.

### Bantay: the LGU annual license

- **A localized pack:** the LGU's evacuation centers, hotlines, hazard notes per barangay and advisories, signed and delivered inside the update families approve.
- **An offline rollout kit:** an install guide for BHWs, a shareable signed pack, printed setup cards.
- **Training**, the pre-season check and the post-season review.
- **An opt-in topic dashboard** under the README's privacy rules ([F3](README.md)).
- **Extra packs** for local needs (coastal, upland, fishing, farming) as they become available.

### Bantay pilot

One barangay or one municipality for one typhoon season, free or at cost. In return: a case study, a before-and-after household survey and a reference call for the next LGU.

### Discounts and sponsorship

NGOs, schools and humanitarian groups get 20% off Bantay, as in v1. A CSR sponsor can pay for an LGU's license and is credited on the About screen; sponsors never see user data or edit content.

### Pricing hypothesis (to test, not a market fact)

v1 said "custom pricing per LGU." v2 keeps custom quotes but gives them one structure that discovery can test.

- **Unit:** a price per household reached per year, plus a floor that covers setup and training. Test "per barangay" as the alternative.
- **Worked example, hypothetical numbers only:** 20,000 households at ₱5 per household per year is ₱100,000 a year. Both numbers are placeholders to test with DRRMOs, not validated prices.
- **Rule for pilots:** keep the price under the LGU's small value procurement ceiling so it needs no public bidding. Confirm the current ceiling in the RA 12009 IRR before quoting.
- **Learn in discovery:** what the DRRMO spends per household today on campaigns and printed materials, which budget line would pay, and who signs.

## 5. How LGUs buy

**The money already exists.** RA 10121, Sec. 21 requires every LGU to set aside not less than 5% of its estimated revenue from regular sources as the Local DRRM Fund, to support disaster risk management "such as, but not limited to, pre-disaster preparedness programs including training." 30% of it is the Quick Response Fund for relief and recovery, and unspent money goes to a DRRM trust fund for the next five years ([RA 10121](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html)). *Reasoning:* Bagyo Buddy belongs in the preparedness share, not the Quick Response Fund.

**The mayor has a reason to care.** Under the Seal of Good Local Governance ([RA 11292](https://legacy.senate.gov.ph/republic_acts/ra%2011292.pdf)) and DILG MC 2023-086, an LGU must pass all ten governance areas, and Disaster Preparedness is one ([MC 2023-086](https://batasnatin.com/laws/mc-2023-086)). *Reasoning:* a household program with measured outcomes is useful evidence there; we do not promise it changes a score.

**The purchase goes through procurement.** RA 12009, the New Government Procurement Act, took effect on 13 August 2024; its IRR was approved by GPPB Resolution No. 02-2025 on 4 February 2025 ([GPPB](https://www.dbm.gov.ph/wp-content/uploads/Issuances/2025/GPPB-Resolution/IRR-RA-12009-Resolution-No-02-2025.pdf)).

To sell under it we need a registered Philippine business with BIR registration, official invoices and PhilGEPS registration. Under small value procurement, the LGU asks for at least three price quotations. Payment follows the LGU's disbursement process after delivery, not a card checkout.

**Timing.** *Reasoning:* LGUs prepare next year's budget around mid-year, so the license must enter next year's DRRM fund plan before then. Pilots run before the typhoon season peaks, so families set up on calm days.

**Where Polar fits.** Polar is a merchant of record and pays out to the Philippines through Stripe Connect Express ([Polar](https://polar.sh/docs/merchant-of-record/supported-countries)). Use it only for card payers: NGOs, schools, international groups and CSR sponsors.

## 6. Unit economics sketch

*Reasoning, all hypothetical until pilots give real numbers:*

- **Cost to serve one LGU:** days of team time for the first pack, one or two training sessions (travel is the main variable cost), a pre-season refresh, light support. Hosting is near zero.
- **Margin comes from reuse.** The national guide is written once; each new LGU adds only its local pack.
- **Margin erodes with** travel to remote LGUs, custom content requests and long procurement cycles.
- **Break-even, in licenses:** yearly fixed costs ÷ (average license price − average yearly cost to serve one LGU). Fill both terms from pilot data; until then we claim no number.

## 7. Competition and moat

The alternatives are complements, not rivals ([problem.md](problem.md) has the full comparison).

| Alternative | Its job | How Bagyo Buddy fits |
| :-- | :-- | :-- |
| Free cell-broadcast alerts ([ECBS](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System), RA 10639) | Say a hazard is coming | We say what the household should do, offline |
| PAGASA bulletins | Official forecasts and warnings | The family taps the warning PAGASA announced |
| Project NOAH, HazardHunterPH | Online hazard maps | Planning tools; we cover the storm hours |
| NDRRMC and OCD guides | Authoritative advice | Our source material, credited and searchable in Taglish |

**The moat:** the reviewed, source-traceable Tagalog guide (later Cebuano), the evaluation set, LGU relationships and local packs, and offline trust. *Reasoning:* a big tech company could build a chatbot, but is unlikely to maintain reviewed local packs with each DRRMO.

## 8. Key metrics

| Metric | Type | How measured |
| :-- | :-- | :-- |
| Share of pilot households with a packed go-bag and a family plan | North star | Before-and-after household survey in pilot barangays |
| Installs per pilot barangay | Reach | Rollout records and Play Console counts; no in-app tracking |
| Guide freshness | Quality | Days since the core guide and LGU pack were updated |
| Refused-question rate by topic | Content gaps | Opt-in topic counts (`out_of_guide`) |
| Time to publish an LGU pack | Operations | First meeting to signed pack |
| Renewal rate | Business | Share of LGUs that renew after a season |

## 9. Go-to-market: the next 12 months

| When | Step |
| :-- | :-- |
| Oct 2026 | Hackathon build and demo |
| Nov to Dec 2026 | Interview 5 DRRMOs; test the pricing hypothesis; ask PAGASA, NDRRMC/OCD and DOH for approval for paid use |
| Jan to Feb 2027 | Register the business and PhilGEPS account; sign one pilot agreement |
| Mar to Apr 2027 | Build and review the LGU pack with the DRRMO; "before" survey |
| May to Jun 2027 | Rollout and training; BHWs set up households and share packs offline |
| Mid-2027 | Ask the pilot LGU to put the license in next year's DRRM fund plan; quote two or three more LGUs |
| Jul to Nov 2027 | Typhoon season: support the DRRMO, keep packs fresh |
| Dec 2027 | "After" survey, case study, renewal proposal |

*Reasoning:* the months assume the busiest part of the typhoon season falls in the second half of the year. Adjust to PAGASA's seasonal outlook and each LGU's budget calendar.

## 10. Business risks and mitigations

| Risk | Mitigation |
| :-- | :-- |
| Procurement is slow | Free or at-cost pilots; stay under small value procurement; plan around the budget calendar |
| Leadership turnover (local elections every three years; the next in May 2028) | Build the relationship with the DRRMO, not only the mayor; show results before campaign season |
| Agencies delay approval for paid use | Ask early; keep the household app free and credited |
| Free government alternatives | Position as a complement, not a rival |
| A content error damages trust | DRRMO review, sources on every passage, fast signed fixes, an honest changelog |
| Sponsor conflicts of interest | Sponsors fund licenses only; they never touch content or data |

## 11. Notes carried from v1, updated

- **Government works (RA 8293, Sec. 176).** Government works carry no copyright, but exploiting them for profit needs prior approval from the agency that made them ([ndvlaw](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)). The free app credits each agency; get approval before selling Bantay. We are not lawyers; confirm before launch.
- **Data privacy (RA 10173).** Health information is sensitive personal information under Sec. 3(l) ([NPC](https://privacy.gov.ph/data-privacy-act/)), so the profile stays on the phone. Review the dashboard design with counsel before the pilot.
- **Model license.** "Built with Llama" on the About screen, as the [Llama 3.2 license](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) requires.

## Sources

- [RA 10121, Philippine DRRM Act of 2010 (Sec. 21, LDRRMF)](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html)
- [RA 11292, Seal of Good Local Governance Act of 2019](https://legacy.senate.gov.ph/republic_acts/ra%2011292.pdf)
- [DILG MC 2023-086, 2023 SGLG guidelines](https://batasnatin.com/laws/mc-2023-086)
- [GPPB Resolution No. 02-2025, IRR of RA 12009](https://www.dbm.gov.ph/wp-content/uploads/Issuances/2025/GPPB-Resolution/IRR-RA-12009-Resolution-No-02-2025.pdf)
- [Polar: supported countries for payouts](https://polar.sh/docs/merchant-of-record/supported-countries)
- [ndvlaw: RA 8293 Section 176, works of the government](https://ndvlaw.com/does-copyright-subsist-in-works-of-the-government/)
- [Emergency Cell Broadcast System (RA 10639)](https://en.wikipedia.org/wiki/Emergency_Cell_Broadcast_System)
- [National Privacy Commission: Data Privacy Act of 2012](https://privacy.gov.ph/data-privacy-act/)
- [Google Play for On-device AI (beta)](https://developer.android.com/google/play/on-device-ai)
- [bartowski/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF)
- [Meta Llama 3.2 1B Instruct model card and license](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)
