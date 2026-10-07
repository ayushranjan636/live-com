# Data audit

Audit date: **6 Oct 2026**. Snapshot id: `snapshot-2026-10-06`. Raw-file SHA-256 hashes are in `data/intermediate/ncmec_totals.json`.

The display was re-based on **child online safety** data. The previous mental-disorder prevalence source (UNICEF SOWC 2021 / IHME GBD 2019) is no longer used; see §B for why it was unsuitable for this brief.

## A. Datasets used in the display

### A1. NCMEC CyberTipline "Reports by Country", 2020–2025 (used: live count + map)

| Item | Finding |
|---|---|
| What is counted | **Reports** of suspected child sexual exploitation received by NCMEC's CyberTipline during a calendar year. **Not** children, offenders, incidents or files. |
| Unit pitfalls | One child can appear in many reports; one report can contain many files, incidents and reported users. Reports ≠ victims. |
| Who reports | The public, and US-based electronic service providers under 18 USC 2258A (apparent CSAM; from 2024 also online enticement and child sex trafficking, under the REPORT Act). |
| Age scope | Children (0–17). NCMEC does not publish an age breakdown of reports by country. |
| Geography | Assigned from geographic indicators for the reported incident, usually the **upload location** — not a child's location. Affected by VPNs, proxies and anonymisers. |
| Observation years | 2020, 2021, 2022, 2023, 2024, 2025 (six complete calendar years) |
| Survey or estimate | **Administrative count.** Not a model, survey or estimate. |
| Uncertainty | **None published and none applicable** — a count has no sampling error. The limitation is coverage, not precision. |
| Published totals | 2020: 21,751,085 · 2021: 29,397,681 · 2022: 32,059,029 · 2023: 36,210,368 · 2024: 21,179,239 · 2025: 23,399,834 |
| URLs | Landing page: <https://www.missingkids.org/gethelpnow/cybertipline/cybertiplinedata> · annual PDFs under `/content/dam/missingkids/pdfs/` (exact URL recorded on every record) |
| Access date | 6 Oct 2026 |
| Reuse / exhibition | NCMEC publishes these reports openly for awareness and policy use, with attribution. No account, licence fee or registration is required — unlike IHME GBD. **NCMEC does not endorse eRaksha**, and the display says so. |

**Explicit limitations carried into the UI** (not just this document):

1. NCMEC states country numbers "are not indicative of the level of child sexual abuse in a particular country". Shown verbatim-in-substance on the map page.
2. The 2023→2024 fall (36.2m → 21.2m) reflects a new report-**bundling** feature, reduced submissions by some providers, and end-to-end encryption — not a fall in exploitation. Stored as a machine-readable `comparability_warnings` entry and displayed.
3. From 2024, reports are split into "referrals" and "informational". The app always uses **total reports** so all six years share one definition.

### A2. NCMEC 2024 context figures (methodology drawer only)

62,992,859 files (incl. 33,130,449 videos) in 2024 reports; 29.2 million incidents behind 20.5m reports; nearly 100 financial-sextortion reports per day. **Different units** from reports — never added to or compared with the main series. Incidents are published for 2024 only, which is why reports (available every year) are the series.

### A3. WHO/Europe HBSC "Teens, screens and mental health", 25 Sept 2024 (context only)

Problematic social media use rose from 7% (2018) to 11% (2022); self-reported, ages 11/13/15, 44 countries and regions. A usage pattern, not exploitation and not a disorder. **Not applied to any other population and never combined with A1.**

### A4. Map geometry

Natural Earth 1:10m Admin-0 countries, India point of view (`ne_10m_admin_0_countries_ind.geojson`, repository VERSION 5.2.0-pre; latest tag v5.1.2). Public domain. Retrieved 6 Oct 2026 from GitHub. Raw file kept in `data/raw/naturalearth/`.

## B. Sources investigated but not used

| Source | Result |
|---|---|
| **UNICEF SOWC 2021 / IHME GBD 2019** (the previous basis) | Measures **mental disorder prevalence**, which is not child digital safety, and gave only **one** year (2019) and 33 European countries. As a prevalence **stock** it also cannot support a ticking counter. Replaced by A1. |
| **IHME GBD Results Tool** | Requires a free account plus bot check; **non-commercial only** licence, no dataset redistribution. Still the only complete country × year prevalence source, but not needed for this brief. |
| INHOPE / IWF annual reports | Report counts for their own hotline networks with different scopes and definitions; mixing them with CyberTipline totals would double-count and break comparability. Not used. |
| Our World in Data (GBD 2023) | Age bands 5–14 / 15–19 only; marked non-redistributable (403). Not used. |
| NCMEC "Reports by ESP" tables | Per-platform counts. Interesting but not geographic, and naming individual companies on a booth screen invites misreading of detection effort as harm. Not used. |
| NCMEC Global Platform (GPCEP) country data | Rounded and thresholded (`<5`, `<10`) and referrals-only, so it does **not** reconcile with the annual totals. The annual PDFs are used instead because they are exact. |

## C. Transformations (complete list)

1. `scripts/extract_ncmec.py`: PDF text → CSV. Handles three different table layouts across the six years (1-column "Reports", and 3-column "Referrals / Informational / Total" from 2024), country names wrapped over up to three lines, and "–" meaning a listed country with zero reports. **The script exits non-zero unless the parsed rows plus residuals equal the "Total"/"Grand total" printed in that PDF, exactly, for every year.** Digits are never altered. SHA-256 of each PDF is recorded.
2. `data/reference/ncmec_country_iso3.json`: explicit name → ISO3 table, **no fuzzy matching** — an unlisted name fails the build. Maps NCMEC's own spelling changes across years onto one country (Eretria→ERI, Sierre Leone→SLE, Swaziland/Eswatini→SWZ, Turkey/Türkiye→TUR, Burma/Myanmar→MMR, Macao/Macau→MAC, Curacao/Curaçao→CUW, …). `Netherlands Antilles` is mapped to `null` because the territory dissolved in 2010 and its reports cannot be assigned to a successor.
3. `scripts/build-data.mjs`:
   * Sums the two rows that 2020 and 2021 print for the same territory ("French Guiana" + "Guiana, French"); such records are flagged `derivation = "derived_duplicate_row_sum"` and their locator names both rows.
   * Keeps **Europol** (multi-jurisdiction) and **Netherlands Antilles** out of the map as named residuals.
   * Computes, per year, which ISO3 codes actually have a shape in the bundled geometry, and records the rest as `not_separately_mapped` with reports and reason.
   * **Throws unless** `shaded + not_separately_mapped + no_country_identified + residuals == published total` for every year.
4. `scripts/build-geo.mjs`: geometry simplification and join-key rule (see Methodology §4).
5. Display formatting only (`src/lib/format.ts`). Counted values are shown **exactly**, with no rounding.
6. The **only** derived forward-looking figure is the live pace projection (Methodology §3), computed as `annual total ÷ seconds in year × elapsed seconds`, labelled as a projection and shown separately from the counted total. `src/lib/methods.ts` refuses to compute a per-second pace for anything that is not an `incidence` (flow) measure.

## D. Feature support summary

| Feature | Status |
|---|---|
| Live worldwide figure that increases with time | **Fully supported.** Counted 2020–2025 total (163,997,236) + projection at 2025's average pace, shown as separate, labelled parts. |
| Exact numbers "up to now" | **Supported with the correct caveat.** Exact to the end of 2025; the current year is a projection because NCMEC publishes annually, not live. |
| Per-second pace | **Supported and legitimate**: reports are a flow (0.742/s in 2025, ≈ one every 1.3 s). Guard in code prevents this for prevalence stocks. |
| Historical trend, year by year | **Fully supported** (six years, all published, shown as bars and sparklines). |
| World map by country | **Fully supported**: 239–245 countries and territories per year, 231 shaded for 2025. |
| Map year comparison | **Fully supported** via direct year selection (no play/replay anywhere in the UI). |
| Per-country trend | **Fully supported**: six-year sparkline and year-on-year % change per country. |
| Uncertainty intervals | **Not applicable** (counted data, not estimates) — and none are invented. |
| Children/victims counted | **Not available**: the unit is reports. Stated on screen. |
| Country risk ranking | **Deliberately not offered**: NCMEC says the numbers do not support it. |
| eRaksha coverage | **No verified input supplied**; nothing shown as actual. |
| eRaksha impact | Not available; would need outcome studies (see Methodology §5). |
