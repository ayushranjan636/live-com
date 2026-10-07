// TEST-ONLY SYNTHETIC FIXTURE. These totals are invented so the live-counter arithmetic
// can be checked against numbers that are trivial to verify by hand. They are never
// bundled into the app: vi.mock replaces the snapshot only inside this test file.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

// 31,536,000 reports in a 365-day year == exactly 1 report per second.
const ANNUAL = 31_536_000;

vi.mock("./generated/snapshot.json", () => {
  const base = {
    dataset_id: "TEST",
    sex: "both",
    age_start: 0,
    age_end: 17,
    lower_bound: null,
    upper_bound: null,
    population_denominator: null,
    source_url: "test://",
    source_locator: "fixture Reports by Country",
    source_release: "TEST",
    retrieved_at: "test",
    value_type: "administrative_count",
    derivation: "published",
    rounding_note: "",
    metric_id: "cybertipline_reports_count",
    unit: "reports",
  };
  const years = [2024, 2025];
  const records = years.flatMap((y) => [
    { ...base, record_id: `w${y}`, location_type: "world", country_iso3: null, country_name: "World", year: y, estimate: ANNUAL },
    { ...base, record_id: `a${y}`, location_type: "country", country_iso3: "AUT", country_name: "Austria", year: y, estimate: 1_000 },
  ]);
  return {
    default: {
      snapshot_id: "test",
      snapshot_date: "test",
      built_at: "test",
      default_dataset_id: "TEST",
      datasets: [
        {
          dataset_id: "TEST",
          label: "TEST",
          short_label: "TEST",
          publisher: "TEST",
          underlying_model: "TEST",
          source_release: "TEST",
          observation_years: years,
          age_start: 0,
          age_end: 17,
          measure: "incidence",
          counts: "reports",
          comparability_warnings: [],
          country_attribution_warning: "Not indicative of the level of abuse in a country.",
          sources: [],
        },
      ],
      records,
      context: [],
      coverage: years.map((y) => ({
        year: y,
        published_total: ANNUAL,
        mapped_to_countries: 1_000,
        countries_with_data: 1,
        no_country_identified: 0,
        no_country_identified_pct: 0,
        other_excluded: [],
      })),
    },
  };
});

const { CounterPage } = await import("./pages/CounterPage");

const digits = () => Number(document.querySelector(".headline-live")!.textContent!.replace(/\D/g, ""));
const COUNTED = ANNUAL * 2; // two published years

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("live counter arithmetic (synthetic fixture)", () => {
  it("starts from the counted total exactly at the start of the first unpublished year", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)));
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    // Projection is zero at that instant, so the figure is the published sum, exactly.
    expect(digits()).toBe(COUNTED);
  });

  it("advances by exactly the elapsed seconds at a 1-per-second pace", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 1, 0, 0))); // one hour in
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    expect(digits()).toBe(COUNTED + 3_600);
  });

  it("keeps ticking as the clock advances, and never goes backwards", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 2, 0, 0, 0)));
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    let prev = digits();
    expect(prev).toBe(COUNTED + 86_400);
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      const now = digits();
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(prev).toBe(COUNTED + 86_405);
  });

  it("separates the counted part from the projected part in the text", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 1, 0))); // 60 seconds in
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    expect(screen.getByText(COUNTED.toLocaleString("en-US"))).toBeTruthy();
    expect(screen.getByText("+60")).toBeTruthy();
  });

  it("draws the composition bar to scale, so the measured share is visible", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 1, 0)));
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    const countedW = parseFloat((document.querySelector(".compose-counted") as HTMLElement).style.width);
    const projW = parseFloat((document.querySelector(".compose-projected") as HTMLElement).style.width);
    // 60 projected against 63,072,000 counted: the counted share is ~100%.
    expect(countedW).toBeGreaterThan(99.9);
    expect(countedW + projW).toBeCloseTo(100, 6);
  });

  it("reports the pace in human terms", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 1, 0)));
    render(<CounterPage datasetId="TEST" onOpenMethod={() => {}} />);
    // 31,536,000 reports / 365 days == exactly 1 per second.
    expect(document.querySelector(".compose-keys")!.textContent).toMatch(/1 per second/);
  });});
