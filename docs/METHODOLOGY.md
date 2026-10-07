# Methodology

This display shows **counted reports**, not a live feed and not a count of children. Each figure on screen carries its metric, unit, year and source. This page explains what the numbers mean and what they do not.

## 1. The metric

**Reports of suspected child sexual exploitation received by NCMEC's CyberTipline.**

| | |
|---|---|
| What is counted | **Reports.** Not children, not offenders, not incidents, not files. One child can appear in many reports; one report can contain many files, incidents and users. |
| Who reports | The public, and US-based electronic service providers under the mandatory reporting duty in 18 USC 2258A (apparent child sexual abuse material; from 2024 also online enticement and child sex trafficking, under the REPORT Act). |
| Period | Each full calendar year, 2020–2025. |
| Type | **Administrative count** — a tally of reports actually received, published to the unit by the organisation that receives them. Not a survey, estimate or model. |
| Uncertainty | None published and none applicable: a count has no sampling error. The real limitation is **coverage**, not precision — see §2. |
| Geography | Assigned from geographic indicators for the reported incident, usually the **upload location**. Not the location of a child. |

**What it is not.** These figures do not measure how much abuse happened, and they are not a count of victims. They measure **reporting**: what platforms detected and chose to report. They move with detection technology, platform policy, encryption and law, as well as with underlying harm.

## 2. Why reporting counts are not harm counts

Three limits are stated on screen wherever the data appears:

1. **Reporting ≠ occurrence.** A rise can mean better detection; a fall can mean less detection. NCMEC said reports fell from 36.2m (2023) to 21.2m (2024) partly because a new "bundling" feature consolidates many incidents from one viral event into a single report, partly because some providers submitted less, and partly because end-to-end encryption limits what platforms can detect. **The 2023→2024 fall must not be read as less exploitation.**
2. **Country figures are not a ranking of danger.** NCMEC states explicitly that country-specific numbers "are not indicative of the level of child sexual abuse in a particular country". They are affected by VPNs, proxies and anonymisers, by each country applying its own law when assessing content, and by the fact that a report attributed to one country may involve people elsewhere. Larger numbers usually reflect a larger online population and more provider detection.
3. **Definitions changed in 2024.** From 2024 NCMEC splits reports into "referrals" and "informational" reports, and the REPORT Act widened mandatory reporting. To keep one definition across all six years, this display always uses **total reports** (referrals + informational).

## 3. The live figure

The headline number has **two parts, shown to scale and labelled separately**, because they are not the same kind of fact.

| Part | What it is |
|---|---|
| **Counted** | The sum of the six published annual totals, 2020–2025 = **163,997,236** reports. Exact, verifiable, and it never moves. |
| **Projected** | Reports that *would* have arrived since 1 January 2026 if reporting continued at exactly 2025's average pace. **Not published data.** This is the part that ticks. |

A bar under the number shows the proportion of each, so the measured share is always visible.

### Why a per-second pace is legitimate here

A ticking counter is only defensible for a **flow** (events occurring during a period), never for a **stock** (people currently in a state):

* Dividing a **prevalence** total — how many people live with a condition — by the seconds in a year is meaningless, and the code **throws an error** if asked to do it (`averagePacePerSecond` requires `measure: "incidence"`; see `src/lib/methods.ts` and its tests).
* CyberTipline reports **are** a flow: a count of reports received during a year. So an average pace is a real quantity:

`average per second = annual total reports ÷ seconds in that year`

For 2025: `23,399,834 ÷ 31,536,000 s (365 days) = 0.742 reports per second`, i.e. about **one every 1.3 seconds**.

### What the ticking does and does not claim

* It is labelled **"projection at 2025's average pace — not live reporting"**.
* NCMEC publishes annual totals, **not** a real-time feed. The true 2026 figure is unknown and **will** differ from the projection.
* Reporting is not evenly spaced in reality; an average pace is a constant rate, which real reporting is not.
* The projection starts at **1 January 2026, 00:00 UTC** — the start of the first year with no published total. It is zero at that instant and only ever grows.
* The counted total is always shown separately, so no visitor has to take the projection as measured fact.

### Rates of change

* Year-on-year change is shown as a signed percentage between two published totals and **can be negative** (2025 vs 2024 is positive; 2024 vs 2023 is a large fall). Because of the limits in §2, a change in reports is a change in **reporting**.
* No figure is extrapolated beyond 2025 in the data series itself; the only forward-looking element is the clearly-labelled pace projection above.

## 4. The map

* **Colour = reports received that year**, on a **fixed**, log-spaced scale: < 100, 100–1k, 1k–10k, 10k–100k, 100k–500k, 500k–1M, 1M–5M, ≥ 5M. Breaks never change with the selected year, so a colour change between years is a real change.
* **Grey hatching = not listed for that year.** Not listed is not zero. Where the source prints "–" the value is a real zero and is stored as 0.
* **Years are selected directly** with buttons. There is no play, pause or replay anywhere: every year is one tap away and the whole series is visible as a sparkline in each country panel.
* **The map does not show everything, and says so.** For each year the page states:
  * reports with **no country identified** (3,331,777, or 14.2%, in 2025) — these appear on no country;
  * the **sum of shaded countries** against the published total;
  * territories with **no separate shape** in these boundaries (Kosovo, Réunion, French Guiana, Guadeloupe, Mayotte, Martinique, Caribbean Netherlands, Western Sahara, Svalbard, Antarctica — 9,668 reports in 2025). They are excluded from shading but shown in the country table.
* **Europol** (1,102,467 reports in 2025) and the dissolved **Netherlands Antilles** are never placed on a country, because they cannot be attributed to one. They are reported as named residuals.
* The build **fails** unless, for every year, `shaded + unmapped territories + no-country-identified + named residuals` equals the published grand total exactly.

### Boundaries and identifiers

* Geometry: **Natural Earth 1:10m Admin-0, India point-of-view** (public domain). It shows India's boundaries as officially recognised by the Government of India. Simplified for display (mapshaper, 6%).
* Data join: by ISO 3166-1 alpha-3 through an **explicit** name table, `data/reference/ncmec_country_iso3.json`. There is no fuzzy matching: an unlisted name fails the build. The table maps NCMEC's own spelling changes across years to one country (for example "Eretria"→Eritrea, "Sierre Leone"→Sierra Leone, "Swaziland"→Eswatini, "Turkey"/"Türkiye", "Burma/Myanmar"→Myanmar), so one country is one shape.
* Where one year's table lists the same territory twice ("French Guiana" and "Guiana, French" in 2020 and 2021), the rows are **summed** and the record records that it was derived.
* Areas such as Akrotiri, Dhekelia, Clipperton, Spratly Is., Bir Tawil and Guantánamo are drawn but never given a value. Antarctica is not drawn.

## 5. eRaksha

* **No verified information about eRaksha** (what it does, where it operates, users reached, launch plans or outcome studies) has been supplied, so **no coverage is shown as actual**.
* Coverage colour means **service availability only**: solid = active (verified), hatched = planned (verified plan), dotted = scenario entry. Availability does not mean prevention. The report counts never change because a service is available.
* The **scenario planner** starts empty. Entries stay on the device and are labelled "Scenario—not a forecast". They contain no reach or outcome figures.
* **Impact estimates are not available.** They would need a measured outcome and study population, baseline frequency, eligible population, adoption and retention assumptions, a defined effect size, a time horizon, a sensitivity analysis, and limits on applying results elsewhere. A change in reports would never be presented as children protected.
* NCMEC and WHO do not endorse eRaksha.

## 6. Other context, kept separate

These are shown only here, never mixed into the counts or the map:

* NCMEC: 2024 reports contained **62,992,859 files**, including 33,130,449 videos. Files are a different unit from reports and cannot be added to them.
* NCMEC: the 20.5m reports of 2024 related to **29.2 million incidents**. Published for 2024 only, so this display uses reports — available for every year — and does not mix the two.
* NCMEC (2024): nearly **100 reports of financial sextortion per day**, quoted as NCMEC published it.
* WHO/Europe (2024): problematic social media use among 11-, 13- and 15-year-olds rose from 7% (2018) to **11%** (2022) across 44 countries and regions (HBSC survey). A self-reported usage pattern in a different population — never combined with report counts.

## 7. Data snapshot, reproducibility and offline use

All data and map shapes are bundled into the app (snapshot date in the footer). The booth needs no network, and there is no loading state in which a placeholder number could appear.

The pipeline is two steps and is fully re-runnable:

1. `scripts/extract_ncmec.py` reads the six source PDFs in `data/raw/ncmec/` and **refuses to continue** unless, for each year, the parsed rows plus residuals equal the "Total"/"Grand total" printed in that PDF. SHA-256 hashes of the PDFs are recorded.
2. `scripts/build-data.mjs` joins names to ISO3, reconciles against the map, and writes `src/generated/snapshot.json`.

Every figure in the app is traceable to a row in `data/processed/burden_records.csv`, each carrying its own `source_url` and `source_locator` (the exact table, row and column). See `docs/DATA_AUDIT.md`.

## Sources

* National Center for Missing & Exploited Children. *CyberTipline Reports by Country*, 2020, 2021, 2022, 2023, 2024, 2025. Retrieved 6 Oct 2026 from <https://www.missingkids.org/gethelpnow/cybertipline/cybertiplinedata>.
* NCMEC. *2024 Our Impact* report (files, incidents). Retrieved 6 Oct 2026.
* NCMEC. *NCMEC Releases New Data: 2024 in Numbers* (bundling, encryption, sextortion). Retrieved 6 Oct 2026.
* WHO Regional Office for Europe (2024). *Teens, screens and mental health*, 25 Sept 2024. Context only.
* Natural Earth. Admin-0 countries, India point of view. Public domain.
