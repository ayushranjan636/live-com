// Step 2 of the data pipeline: intermediate files -> normalized, versioned snapshot.
//
// Output: src/generated/snapshot.json (bundled into the app; no runtime network access)
//
// Transformations performed here (and ONLY these):
//   1. Country names -> ISO3 via the explicit table data/reference/ncmec_country_iso3.json.
//   2. Rows that are not a single country (Europol, Europe, "null"/"Unknown", the dissolved
//      Netherlands Antilles) are kept as named residuals, never placed on the map.
//   3. Two spellings of the same territory in one year's PDF are summed (documented below).
// Nothing is imputed, interpolated, extrapolated or inferred from another source.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const RETRIEVED = "2026-10-06";
const DS = "ncmec_cybertipline_2020_2025";
const DATA_URL = "https://www.missingkids.org/gethelpnow/cybertipline/cybertiplinedata";
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

const iso = JSON.parse(readFileSync("data/reference/ncmec_country_iso3.json", "utf8"));
const ncmecTotals = JSON.parse(readFileSync("data/intermediate/ncmec_totals.json", "utf8"));

/** Minimal RFC4180 CSV reader. Country names contain commas, so splitting on "," is wrong. */
function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim();
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const pdfUrl = (y) =>
  y === 2024
    ? `https://www.missingkids.org/content/dam/missingkids/pdfs/cybertiplinedata${y}/${y}-reports-by-country.pdf`
    : `https://www.missingkids.org/content/dam/missingkids/pdfs/${y}-reports-by-country.pdf`;

const datasets = [
  {
    dataset_id: DS,
    label: "NCMEC CyberTipline reports of suspected online child sexual exploitation, 2020–2025",
    short_label: "NCMEC CyberTipline (2020–2025)",
    publisher: "National Center for Missing & Exploited Children (NCMEC)",
    underlying_model: "Administrative count of reports received — not a statistical model",
    source_release: "Annual CyberTipline 'Reports by Country' releases, 2020–2025",
    publication_date: "2026-01-01",
    observation_years: YEARS,
    age_start: 0,
    age_end: 17,
    sex: "both",
    measure: "incidence",
    counts: "reports",
    definition:
      "Reports of suspected child sexual exploitation received by NCMEC's CyberTipline during each calendar year. Reports come from the public and, for US-based electronic service providers, under the mandatory reporting duty in 18 USC 2258A, which covers apparent child sexual abuse material (CSAM) and — since the REPORT Act took effect in 2024 — online enticement and child sex trafficking. The unit is a REPORT, not a child: one child can appear in many reports and one report can contain many files, incidents and users. Country is assigned from geographic indicators for the reported incident (typically the upload location), not the victim's location.",
    value_type: "administrative_count",
    value_type_note:
      "A counted tally of reports actually received, published to the unit by the organisation that receives them. It is not a survey, an estimate or a model, so there is no uncertainty interval — but it is a count of REPORTING, which is not the same as a count of abuse. It measures what platforms detected and chose to report, so it moves with detection technology, platform policy and law as well as with underlying harm.",
    uncertainty:
      "None published, and none applicable: this is a count, not an estimate. The relevant limitation is coverage, not sampling error — see comparability_warnings.",
    comparability_warnings: [
      {
        years: "2023 → 2024",
        warning:
          "Totals fell from 36.2m to 21.2m reports. NCMEC attributes this partly to a new 'bundling' feature that consolidates many incidents from one viral event into a single report, and partly to reduced submissions from some providers and the spread of end-to-end encryption. The drop therefore reflects changes in how reports are counted and made, and must not be read as a fall in online child sexual exploitation.",
      },
      {
        years: "2024 onward",
        warning:
          "From 2024 NCMEC splits reports into 'referrals' and 'informational' reports, and the REPORT Act added online enticement and child sex trafficking to mandatory reporting. The series shown is total reports (referrals + informational) so that all years use the same definition.",
      },
    ],
    country_attribution_warning:
      "NCMEC states explicitly that country-specific numbers are NOT indicative of the level of child sexual abuse in a particular country. Figures are affected by proxies, VPNs and anonymisers, by each country's own laws when assessing content, and by the fact that a report attributed to one country may involve offenders or victims elsewhere. Larger numbers most often reflect a larger online population and more detection by providers, not a more dangerous country.",
    licence:
      "NCMEC publishes these reports publicly for awareness and policy use. NCMEC does not endorse eRaksha or this presentation. See docs/DATA_AUDIT.md.",
    sources: [
      { label: "NCMEC CyberTipline Data (landing page, all years)", url: DATA_URL },
      ...YEARS.map((y) => ({ label: `${y} CyberTipline Reports by Country (PDF)`, url: pdfUrl(y) })),
    ],
    retrieved_at: RETRIEVED,
  },
];

const base = {
  dataset_id: DS,
  age_start: 0,
  age_end: 17,
  sex: "both",
  lower_bound: null,
  upper_bound: null,
  population_denominator: null,
  source_release: "Annual CyberTipline 'Reports by Country' releases, 2020–2025",
  retrieved_at: RETRIEVED,
  value_type: "administrative_count",
  derivation: "published",
  rounding_note: "Published to the unit. Displayed exactly as published; no rounding is applied to the stored value.",
};

const records = [];

// --- World totals, exactly as printed in each PDF (never summed from countries) ---
for (const y of YEARS) {
  const t = ncmecTotals.years[String(y)];
  records.push({
    ...base,
    record_id: `${DS}:WORLD:${y}:reports`,
    location_type: "world",
    country_iso3: null,
    country_name: "World",
    year: y,
    metric_id: "cybertipline_reports_count",
    unit: "reports",
    estimate: t.published_total,
    source_url: pdfUrl(y),
    source_locator: `${y} CyberTipline Reports by Country, '${y >= 2024 ? "Grand total" : "Total"}' row.`,
  });
}

// --- Country rows ---
const rows = readCsv("data/intermediate/ncmec_cybertipline_by_country.csv");
const byKey = new Map(); // `${iso3}:${year}` -> { estimate, names[] }
const residuals = new Map(); // year -> { label -> reports }  (rows not mapped to one country)

for (const r of rows) {
  const year = Number(r.year);
  const name = r.source_country_name;
  if (!(name in iso)) throw new Error(`No ISO3 mapping for NCMEC name "${name}" — add it to data/reference/ncmec_country_iso3.json`);
  const code = iso[name];
  const value = Number(r.total_reports);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Bad value for ${name} ${year}: ${r.total_reports}`);
  if (code === null) {
    const m = residuals.get(year) ?? new Map();
    m.set(name, (m.get(name) ?? 0) + value);
    residuals.set(year, m);
    continue;
  }
  const key = `${code}:${year}`;
  const prev = byKey.get(key);
  // 2020 and 2021 list the same territory twice ("French Guiana" and "Guiana, French").
  // Both refer to French Guiana, so the rows are summed and the fact is recorded.
  if (prev) {
    prev.estimate += value;
    prev.names.push(name);
  } else byKey.set(key, { estimate: value, names: [name], code, year });
}

for (const { estimate, names, code, year } of byKey.values()) {
  records.push({
    ...base,
    record_id: `${DS}:${code}:${year}:reports`,
    location_type: "country",
    country_iso3: code,
    country_name: names[0],
    year,
    metric_id: "cybertipline_reports_count",
    unit: "reports",
    estimate,
    source_url: pdfUrl(year),
    source_locator:
      names.length > 1
        ? `${year} CyberTipline Reports by Country. Sum of ${names.length} rows for the same territory printed in that year's table: ${names.map((n) => `"${n}"`).join(" + ")}.`
        : `${year} CyberTipline Reports by Country, row "${names[0]}", column ${year >= 2024 ? "'Total Reports'" : "'Reports'"}.`,
    derivation: names.length > 1 ? "derived_duplicate_row_sum" : "published",
  });
}

// --- Which ISO3 codes actually have their own shape on the bundled map? --------------
// Some territories NCMEC lists separately (French Guiana, Réunion, Mayotte, Svalbard,
// Kosovo…) have no separate geometry in the 1:10m Admin-0 layer used here, and Antarctica
// is intentionally not drawn. Their reports are real and are kept as records, but they
// cannot be painted. Rather than let them disappear, they are reconciled into coverage as
// a named residual so the page can state what the map does not show.
const topo = JSON.parse(readFileSync("src/generated/world.topo.json", "utf8"));
const geometries = topo.objects[Object.keys(topo.objects)[0]].geometries;
const MAPPABLE = new Set(
  geometries.map((g) => g.properties.join_iso3).filter((c) => c && c !== "ATA"),
);

// --- Reports that cannot be placed on the map, per year, kept visible rather than dropped ---
const coverage = YEARS.map((y) => {
  const t = ncmecTotals.years[String(y)];
  const yearRows = records.filter((r) => r.location_type === "country" && r.year === y);
  const drawable = yearRows.filter((r) => MAPPABLE.has(r.country_iso3));
  const mapped = drawable.reduce((s, r) => s + r.estimate, 0);

  const notDrawn = yearRows
    .filter((r) => !MAPPABLE.has(r.country_iso3))
    .map((r) => ({
      label: `${r.country_name} (${r.country_iso3})`,
      reports: r.estimate,
      reason:
        r.country_iso3 === "ATA"
          ? "Antarctica is not drawn on this map."
          : "No separate shape for this territory in the 1:10m Admin-0 boundaries used here, so it cannot be shaded on its own. The figure is still published in the country table.",
    }))
    .filter((x) => x.reports > 0)
    .sort((a, b) => b.reports - a.reports);

  const residual = [...(residuals.get(y) ?? new Map()).entries()].map(([label, reports]) => ({
    label,
    reports,
    reason: iso._unmapped_reasons?.[label] ?? "Not a single present-day country.",
  }));
  const multi = Object.entries(t.multi_jurisdiction_excluded ?? {}).map(([label, reports]) => ({
    label: label === "europol" ? "Europol" : label === "europe" ? "Europe" : label,
    reports,
    reason: "Receives reports associated with several jurisdictions, so it cannot be attributed to one country.",
  }));
  const unassigned = t.unknown_or_unlisted;

  const sum = (xs) => xs.reduce((s, x) => s + x.reports, 0);
  const accounted = mapped + unassigned + sum(notDrawn) + sum(residual) + sum(multi);
  if (accounted !== t.published_total) {
    throw new Error(`${y}: records (${accounted}) do not reconcile with published total (${t.published_total})`);
  }
  return {
    year: y,
    published_total: t.published_total,
    mapped_to_countries: mapped,
    countries_with_data: yearRows.length,
    countries_drawn: drawable.length,
    no_country_identified: unassigned,
    no_country_identified_pct: Number(((unassigned / t.published_total) * 100).toFixed(1)),
    not_separately_mapped: notDrawn,
    other_excluded: [...multi, ...residual],
  };
});

// --- Context statements: shown in methodology only, never used in calculations ---
const context = [
  {
    id: "ncmec_2024_files",
    statement:
      "NCMEC: reports to the CyberTipline in 2024 contained 62,992,859 files (images, videos and other material), including 33,130,449 video files uploaded by reporting providers.",
    underlying_model: "Administrative count",
    age: "0–17",
    unit: "files",
    value: 62_992_859,
    url: "https://www.missingkids.org/content/dam/missingkids/pdfs/2024-ncmec-our-impact.pdf",
    retrieved_at: RETRIEVED,
    comparability:
      "Files are a different unit from reports and from children. One report can contain thousands of files, and the same file can appear in many reports, so files must never be compared with or added to report counts.",
  },
  {
    id: "ncmec_2024_incidents",
    statement: "NCMEC: the 20.5 million reports received in 2024 related to 29.2 million incidents of suspected child sexual exploitation.",
    underlying_model: "Administrative count",
    age: "0–17",
    unit: "incidents",
    value: 29_200_000,
    url: "https://www.missingkids.org/content/dam/missingkids/pdfs/2024-ncmec-our-impact.pdf",
    retrieved_at: RETRIEVED,
    comparability:
      "Incidents exceed reports because one bundled report can carry many incidents. The incident count is published for 2024 only, so this app uses reports — the measure available for every year — as its series, and does not mix the two.",
  },
  {
    id: "ncmec_2024_sextortion",
    statement: "NCMEC (2024): the CyberTipline received nearly 100 reports of financial sextortion per day.",
    underlying_model: "Administrative count",
    age: "0–17",
    unit: "reports per day",
    value: 100,
    url: "https://www.missingkids.org/blog/2025/ncmec-releases-new-data-2024-in-numbers",
    retrieved_at: RETRIEVED,
    comparability:
      "A subset of total reports, published as an approximate daily average by NCMEC. Quoted as published; not recomputed and not added to the main series.",
  },
  {
    id: "who_europe_hbsc_2022_psmu",
    statement:
      "WHO/Europe (25 September 2024): problematic social media use rose from 7% (2018) to 11% (2022) among adolescents aged 11, 13 and 15 across 44 countries and regions in Europe, central Asia and Canada (HBSC survey).",
    underlying_model: "Health Behaviour in School-aged Children survey (self-report)",
    age: "11, 13, 15",
    unit: "percent",
    value: 11,
    url: "https://www.who.int/europe/news/item/25-09-2024-teens--screens-and-mental-health",
    retrieved_at: RETRIEVED,
    comparability:
      "A regional self-reported measure of a usage pattern among adolescents. It is a different population, unit and source from the CyberTipline counts, so it is never combined with them; it is shown only as separate context on online wellbeing.",
  },
];

const snapshot = {
  snapshot_id: `snapshot-${RETRIEVED}`,
  snapshot_date: RETRIEVED,
  built_at: new Date().toISOString(),
  default_dataset_id: DS,
  datasets,
  records,
  context,
  coverage,
  verification: { ncmec: ncmecTotals },
};

mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/snapshot.json", JSON.stringify(snapshot, null, 1));
writeFileSync(
  "data/processed/burden_records.csv",
  [
    "record_id,dataset_id,location_type,country_iso3,country_name,year,metric_id,unit,estimate,source_url,value_type,derivation",
    ...records.map((r) =>
      [r.record_id, r.dataset_id, r.location_type, r.country_iso3 ?? "", `"${r.country_name}"`, r.year, r.metric_id, r.unit, r.estimate, r.source_url, r.value_type, r.derivation].join(","),
    ),
  ].join("\n") + "\n",
);

console.log(`Snapshot: ${records.length} records, ${datasets.length} dataset(s)`);
for (const c of coverage) {
  console.log(
    `  ${c.year}: ${c.published_total.toLocaleString()} reports · ${c.countries_with_data} countries ` +
      `(${c.countries_drawn} drawable) · ${c.no_country_identified_pct}% no country identified · ` +
      `${c.not_separately_mapped.length} territories without their own shape`,
  );
}
