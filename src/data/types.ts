export type MetricId = "cybertipline_reports_count";

export interface BurdenRecord {
  record_id: string;
  dataset_id: string;
  location_type: "world" | "country";
  country_iso3: string | null;
  country_name: string;
  year: number;
  age_start: number;
  age_end: number;
  sex: "both";
  metric_id: MetricId;
  /** The CyberTipline series counts REPORTS, not children and not incidents. */
  unit: "reports";
  estimate: number;
  lower_bound: number | null;
  upper_bound: number | null;
  population_denominator: number | null;
  source_url: string;
  source_locator: string;
  source_release: string;
  retrieved_at: string;
  value_type: "administrative_count";
  derivation: "published" | "derived_duplicate_row_sum";
  rounding_note: string;
}

export interface ComparabilityWarning {
  years: string;
  warning: string;
}

export interface Dataset {
  dataset_id: string;
  label: string;
  short_label: string;
  publisher: string;
  underlying_model: string;
  source_release: string;
  publication_date: string;
  observation_years: number[];
  age_start: number;
  age_end: number;
  sex: string;
  measure: "prevalence" | "incidence";
  counts: "people" | "cases" | "episodes" | "reports";
  definition: string;
  value_type: string;
  value_type_note: string;
  uncertainty: string;
  comparability_warnings: ComparabilityWarning[];
  country_attribution_warning: string;
  licence: string;
  sources: { label: string; url: string }[];
  retrieved_at: string;
}

export interface ContextStatement {
  id: string;
  statement: string;
  underlying_model: string;
  age: string;
  unit: string;
  value: number;
  url: string;
  retrieved_at: string;
  comparability: string;
}

/** Per-year reconciliation between the published total and what the map can show. */
export interface Coverage {
  year: number;
  published_total: number;
  mapped_to_countries: number;
  countries_with_data: number;
  countries_drawn: number;
  no_country_identified: number;
  no_country_identified_pct: number;
  /** Territories with real data but no separate shape in the bundled boundaries. */
  not_separately_mapped: { label: string; reports: number; reason: string }[];
  other_excluded: { label: string; reports: number; reason: string }[];
}

export interface Snapshot {
  snapshot_id: string;
  snapshot_date: string;
  built_at: string;
  default_dataset_id: string;
  datasets: Dataset[];
  records: BurdenRecord[];
  context: ContextStatement[];
  coverage: Coverage[];
}
