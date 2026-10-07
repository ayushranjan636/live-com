// Read-only accessors over the bundled, verified data snapshot.
// The snapshot is imported at build time: there is no loading state and no network
// request, so no placeholder or generated number can ever be shown in its place.
import raw from "../generated/snapshot.json";
import type { BurdenRecord, Coverage, Dataset, MetricId, Snapshot } from "./types";

export const snapshot = raw as unknown as Snapshot;

export const REPORTS: MetricId = "cybertipline_reports_count";

export function getDataset(id: string = snapshot.default_dataset_id): Dataset {
  const d = snapshot.datasets.find((x) => x.dataset_id === id);
  if (!d) throw new Error(`Unknown dataset ${id}`);
  return d;
}

/** Years for which this dataset has a published WORLD total. Sorted ascending. */
export function worldYears(datasetId: string): number[] {
  return [
    ...new Set(
      snapshot.records
        .filter((r) => r.dataset_id === datasetId && r.location_type === "world" && r.metric_id === REPORTS)
        .map((r) => r.year),
    ),
  ].sort((a, b) => a - b);
}

/** Years with any country-level record in this dataset. */
export function countryYears(datasetId: string): number[] {
  return [...new Set(snapshot.records.filter((r) => r.dataset_id === datasetId && r.location_type === "country").map((r) => r.year))].sort(
    (a, b) => a - b,
  );
}

export function worldRecord(datasetId: string, year: number, metric: MetricId = REPORTS): BurdenRecord | null {
  return (
    snapshot.records.find(
      (r) => r.dataset_id === datasetId && r.location_type === "world" && r.year === year && r.metric_id === metric,
    ) ?? null
  );
}

/** Country record or null. Null means NOT LISTED for that year — never treat it as zero. */
export function countryRecord(datasetId: string, iso3: string, year: number, metric: MetricId = REPORTS): BurdenRecord | null {
  return (
    snapshot.records.find(
      (r) => r.dataset_id === datasetId && r.country_iso3 === iso3 && r.year === year && r.metric_id === metric,
    ) ?? null
  );
}

/** ISO3 -> record for one year. Absent keys are countries with no row that year. */
export function countryIndex(datasetId: string, year: number) {
  const m = new Map<string, { reports: BurdenRecord; name: string }>();
  for (const r of snapshot.records) {
    if (r.dataset_id !== datasetId || r.location_type !== "country" || r.year !== year || !r.country_iso3) continue;
    if (r.metric_id !== REPORTS) continue;
    m.set(r.country_iso3, { reports: r, name: r.country_name });
  }
  return m;
}

/** Full per-country series across every year in the dataset, for sparklines and trends. */
export function countrySeries(datasetId: string, iso3: string): { year: number; value: number }[] {
  return snapshot.records
    .filter((r) => r.dataset_id === datasetId && r.country_iso3 === iso3 && r.metric_id === REPORTS)
    .map((r) => ({ year: r.year, value: r.estimate }))
    .sort((a, b) => a.year - b.year);
}

export function coverageFor(year: number): Coverage | null {
  return snapshot.coverage.find((c) => c.year === year) ?? null;
}

export function ageLabel(d: Dataset) {
  return `${d.age_start}–${d.age_end}`;
}
