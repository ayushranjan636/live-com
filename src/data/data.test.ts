import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { countryIndex, countryRecord, countrySeries, countryYears, coverageFor, snapshot, worldRecord, worldYears } from "./snapshot";
import { COUNTRY_FEATURES } from "../components/WorldMap";
import { coverageAt, eraksha, validateCoverage } from "./eraksha";

const DS = snapshot.default_dataset_id;
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

/** The intermediate CSV, parsed with quote handling (country names contain commas). */
function csvRows() {
  const text = readFileSync("data/intermediate/ncmec_cybertipline_by_country.csv", "utf8").trim();
  const out: Record<string, string>[] = [];
  const lines = text.split("\n");
  const head = lines.shift()!.split(",");
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    out.push(Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
  }
  return out;
}

describe("snapshot records", () => {
  it("every record has the normalized fields", () => {
    const fields = ["country_iso3", "country_name", "year", "metric_id", "unit", "estimate", "source_url", "source_locator", "source_release", "retrieved_at", "value_type"];
    for (const r of snapshot.records) for (const f of fields) expect(r).toHaveProperty(f);
  });

  it("world totals equal the figures printed in each PDF", () => {
    // Transcribed from the 'Total' / 'Grand total' row of each year's PDF.
    const published: Record<number, number> = {
      2020: 21_751_085,
      2021: 29_397_681,
      2022: 32_059_029,
      2023: 36_210_368,
      2024: 21_179_239,
      2025: 23_399_834,
    };
    for (const y of YEARS) expect(worldRecord(DS, y)!.estimate).toBe(published[y]);
  });

  it("every country record matches the extracted source row", () => {
    const iso = JSON.parse(readFileSync("data/reference/ncmec_country_iso3.json", "utf8"));
    // Rows sharing an ISO3 within a year are summed by the build, so compare on totals.
    const expected = new Map<string, number>();
    for (const r of csvRows()) {
      const code = iso[r.source_country_name];
      if (!code) continue; // deliberately unmapped (e.g. Netherlands Antilles)
      const k = `${code}:${r.year}`;
      expected.set(k, (expected.get(k) ?? 0) + Number(r.total_reports));
    }
    const actual = new Map(
      snapshot.records.filter((r) => r.location_type === "country").map((r) => [`${r.country_iso3}:${r.year}`, r.estimate]),
    );
    expect(actual.size).toBe(expected.size);
    for (const [k, v] of expected) expect(actual.get(k)).toBe(v);
  });

  it("spot-checks values transcribed by hand from the PDFs", () => {
    expect(countryRecord(DS, "IND", 2025)!.estimate).toBeGreaterThan(0);
    expect(countryRecord(DS, "VNM", 2025)!.estimate).toBe(588_858);
    expect(countryRecord(DS, "ZWE", 2025)!.estimate).toBe(5_923);
    expect(countryRecord(DS, "AFG", 2024)!.estimate).toBe(123_417);
    expect(countryRecord(DS, "ALB", 2024)!.estimate).toBe(7_355);
    expect(countryRecord(DS, "BGD", 2023)!.estimate).toBe(2_491_368);
    expect(countryRecord(DS, "USA", 2020)!.estimate).toBe(494_388);
  });

  it("units and value types are consistent: reports, counted, integral", () => {
    for (const r of snapshot.records) {
      expect(r.unit).toBe("reports");
      expect(r.metric_id).toBe("cybertipline_reports_count");
      expect(r.value_type).toBe("administrative_count");
      expect(Number.isInteger(r.estimate)).toBe(true);
      expect(r.estimate).toBeGreaterThanOrEqual(0);
      // A count has no sampling uncertainty, so no interval may be invented.
      expect(r.lower_bound).toBeNull();
      expect(r.upper_bound).toBeNull();
    }
  });

  it("records reconcile with the published total for every year", () => {
    for (const y of YEARS) {
      const cov = coverageFor(y)!;
      const all = snapshot.records.filter((r) => r.location_type === "country" && r.year === y);
      const notDrawn = cov.not_separately_mapped.reduce((s, x) => s + x.reports, 0);
      const excluded = cov.other_excluded.reduce((s, x) => s + x.reports, 0);
      // Everything in the published total is accounted for: drawn, undrawable, or unassigned.
      expect(cov.mapped_to_countries + notDrawn + cov.no_country_identified + excluded).toBe(cov.published_total);
      expect(all.reduce((s, r) => s + r.estimate, 0)).toBe(cov.mapped_to_countries + notDrawn);
      expect(worldRecord(DS, y)!.estimate).toBe(cov.published_total);
    }
  });

  it("the map silently loses nothing: undrawable territories are named and counted", () => {
    const joinCodes = new Set(COUNTRY_FEATURES.map((f) => f.properties.join_iso3).filter(Boolean));
    for (const y of YEARS) {
      const cov = coverageFor(y)!;
      const undrawable = snapshot.records.filter(
        (r) => r.location_type === "country" && r.year === y && r.estimate > 0 && !joinCodes.has(r.country_iso3!),
      );
      expect(cov.not_separately_mapped).toHaveLength(undrawable.length);
      for (const x of cov.not_separately_mapped) expect(x.reason).toMatch(/\S/);
    }
    // The shortfall must stay a negligible fraction of the total, or the map would mislead.
    const cov = coverageFor(2025)!;
    const notDrawn = cov.not_separately_mapped.reduce((s, x) => s + x.reports, 0);
    expect(notDrawn / cov.published_total).toBeLessThan(0.001);
  });

  it("the world total is published, never a sum of the mapped countries", () => {
    for (const y of YEARS) {
      const mapped = [...countryIndex(DS, y).values()].reduce((s, e) => s + e.reports.estimate, 0);
      // Reports with no country identified mean the mapped sum is always strictly lower.
      expect(mapped).toBeLessThan(worldRecord(DS, y)!.estimate);
    }
  });

  it("not-listed stays missing (null), and is never silently turned into zero", () => {
    // Antarctica has no row in some years; absence must read as null, not 0.
    const idx2024 = countryIndex(DS, 2024);
    for (const [, e] of idx2024) expect(e.reports.estimate).not.toBeNaN();
    expect(countryRecord(DS, "ZZZ" as string, 2024)).toBeNull();
    // Where the source prints "-" we store a real 0, and it is attributable to a row.
    const zeros = snapshot.records.filter((r) => r.estimate === 0);
    for (const z of zeros) expect(z.source_locator).toMatch(/Reports by Country/);
  });

  it("no records outside the dataset's observation years (no extrapolation)", () => {
    for (const d of snapshot.datasets) {
      for (const r of snapshot.records.filter((x) => x.dataset_id === d.dataset_id)) expect(d.observation_years).toContain(r.year);
    }
    expect(worldYears(DS)).toEqual(YEARS);
    expect(countryYears(DS)).toEqual(YEARS);
  });

  it("flags every row that the build derived rather than read directly", () => {
    for (const r of snapshot.records) {
      if (r.derivation === "derived_duplicate_row_sum") expect(r.source_locator).toMatch(/Sum of \d+ rows/);
      else expect(r.derivation).toBe("published");
    }
  });

  it("does not mix releases inside a dataset", () => {
    for (const d of snapshot.datasets) {
      const releases = new Set(snapshot.records.filter((r) => r.dataset_id === d.dataset_id).map((r) => r.source_release));
      expect([...releases]).toEqual([d.source_release]);
    }
  });

  it("carries the comparability warning for the 2023-24 definitional break", () => {
    const d = snapshot.datasets.find((x) => x.dataset_id === DS)!;
    const w = d.comparability_warnings.find((x) => x.years.includes("2023"));
    expect(w).toBeDefined();
    expect(w!.warning).toMatch(/bundl/i);
    expect(d.country_attribution_warning).toMatch(/not indicative/i);
  });

  it("per-country series are complete and sorted for the sparklines", () => {
    const s = countrySeries(DS, "IND");
    expect(s.map((p) => p.year)).toEqual([...s.map((p) => p.year)].sort((a, b) => a - b));
    expect(s.length).toBeGreaterThan(1);
  });

  it("the extraction reconciled against every published total", () => {
    const v = snapshot as unknown as { verification: { ncmec: { years: Record<string, { published_total: number }> } } };
    for (const y of YEARS) expect(v.verification.ncmec.years[String(y)].published_total).toBe(worldRecord(DS, y)!.estimate);
  });
});

describe("geometry join", () => {
  const joinCodes = new Set(COUNTRY_FEATURES.map((f) => f.properties.join_iso3).filter(Boolean));
  it("one ISO3 never maps to two features (no double-painting)", () => {
    for (const code of joinCodes) {
      expect(COUNTRY_FEATURES.filter((f) => f.properties.join_iso3 === code)).toHaveLength(1);
    }
  });
  it("France and Norway join despite Natural Earth ISO_A3 = -99", () => {
    expect(joinCodes.has("FRA")).toBe(true);
    expect(joinCodes.has("NOR")).toBe(true);
  });
  it("minor dependencies never inherit a parent's value", () => {
    for (const fid of ["CLP", "IOA", "ESB", "WSB", "BRT", "PGA"]) {
      const f = COUNTRY_FEATURES.find((x) => x.properties.fid === fid);
      if (f) expect(f.properties.join_iso3).toBeNull();
    }
  });
  it("uses the India point-of-view worldview", () => {
    const meta = JSON.parse(readFileSync("src/generated/world.topo.json", "utf8")).metadata;
    expect(meta.source).toMatch(/India point-of-view/);
  });
});

describe("eRaksha data separation", () => {
  it("ships with no unverified coverage and no outcome evidence", () => {
    expect(() => validateCoverage(eraksha.coverage)).not.toThrow();
    expect(eraksha.outcome_evidence).toEqual([]);
  });
  it("rejects coverage entries without evidence", () => {
    expect(() => validateCoverage([{ country_iso3: "IND", status: "active", scope: "x", start: "2025-01", users_reached: null, users_reached_definition: null, evidence: "", as_of: "2026-01-01" }])).toThrow(/evidence/);
    expect(() => validateCoverage([{ country_iso3: "IND", status: "active", scope: "x", start: "2025-01", users_reached: 5, users_reached_definition: null, evidence: "doc", as_of: "2026-01-01" }])).toThrow(/definition/);
  });
  it("keeps actual, planned and scenario statuses distinct", () => {
    const v = validateCoverage([
      { country_iso3: "IND", status: "active", scope: "x", start: "2025-01", users_reached: null, users_reached_definition: null, evidence: "doc", as_of: "2026-01-01" },
      { country_iso3: "NPL", status: "planned", scope: "x", start: "2027-01", users_reached: null, users_reached_definition: null, evidence: "doc", as_of: "2026-01-01" },
    ]);
    const m = coverageAt(2026, v, [{ id: "a", country_iso3: "BGD", year: 2026 }, { id: "b", country_iso3: "IND", year: 2020 }]);
    expect(m.get("IND")).toBe("active"); // verified beats scenario
    expect(m.get("NPL")).toBe("planned");
    expect(m.get("BGD")).toBe("scenario");
    expect(coverageAt(2024, v, []).get("IND")).toBeUndefined();
  });
});
