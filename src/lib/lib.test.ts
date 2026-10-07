import { describe, expect, it } from "vitest";
import {
  annualizedNetChange,
  averagePacePerSecond,
  firstUnpublishedYearStart,
  incidenceAverages,
  interpolate,
  percentChange,
  projectedAtPace,
  secondsInYear,
} from "./methods";
import { formatCount, formatExact, formatInterval, formatPct } from "./format";
import { binIndex, fillFor, MISSING_FILL, REPORT_BREAKS } from "./scales";

describe("interpolation", () => {
  const pts = [
    { year: 2000, value: 100 },
    { year: 2010, value: 200 },
    { year: 2020, value: 150 },
  ];
  it("reproduces source endpoints exactly", () => {
    for (const p of pts) {
      const r = interpolate(pts, p.year);
      expect(r.value).toBe(p.value);
      expect(r.interpolated).toBe(false);
    }
  });
  it("never extrapolates beyond the first or last source year", () => {
    expect(interpolate(pts, 2030)).toEqual({ value: 150, interpolated: false, t: 2020 });
    expect(interpolate(pts, 1990)).toEqual({ value: 100, interpolated: false, t: 2000 });
  });
});

describe("rates and the live pace", () => {
  it("net change can be negative and is divided by elapsed years", () => {
    expect(annualizedNetChange({ year: 2010, value: 200 }, { year: 2020, value: 150 })).toBe(-5);
  });

  it("refuses to derive per-second rates from a prevalence stock", () => {
    expect(() => incidenceAverages({ measure: "prevalence", annualCount: 166e6, referenceYear: 2019, counts: "people" }, "actual")).toThrow(
      /INCIDENCE/,
    );
    // The live ticker uses the same guard, so a stock can never drive a ticking counter.
    expect(() => averagePacePerSecond({ year: 2025, annualTotal: 166e6, measure: "prevalence" })).toThrow(/flow/);
  });

  it("uses leap-year aware or standardized calendars", () => {
    expect(secondsInYear(2020, "actual")).toBe(366 * 86400);
    expect(secondsInYear(2019, "actual")).toBe(365 * 86400);
    expect(secondsInYear(2020, "standard365")).toBe(365 * 86400);
  });

  it("derives the average pace by exact division of an annual flow total", () => {
    const basis = { year: 2025, annualTotal: 23_399_834, measure: "incidence" };
    const perSecond = averagePacePerSecond(basis);
    expect(perSecond).toBe(23_399_834 / (365 * 86400));
    // Multiplying back by the seconds in the year must return the published total exactly.
    expect(perSecond * secondsInYear(2025, "actual")).toBeCloseTo(23_399_834, 6);
  });

  it("projects from elapsed real time, and is zero before the start instant", () => {
    const basis = { year: 2025, annualTotal: 31_536_000, measure: "incidence" }; // exactly 1/second
    const since = new Date(Date.UTC(2026, 0, 1));
    expect(projectedAtPace(basis, since, since).projected).toBe(0);
    // Clock before the start must not produce a negative projection.
    expect(projectedAtPace(basis, since, new Date(Date.UTC(2025, 11, 31))).projected).toBe(0);
    const tenMin = new Date(since.getTime() + 600_000);
    expect(projectedAtPace(basis, since, tenMin).projected).toBeCloseTo(600, 6);
    expect(projectedAtPace(basis, since, tenMin).elapsedSeconds).toBe(600);
  });

  it("is monotonic: the projection only ever grows with time", () => {
    const basis = { year: 2025, annualTotal: 23_399_834, measure: "incidence" };
    const since = new Date(Date.UTC(2026, 0, 1));
    let prev = -1;
    for (const mins of [0, 1, 5, 60, 1440, 100_000]) {
      const v = projectedAtPace(basis, since, new Date(since.getTime() + mins * 60_000)).projected;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("starts the projection at 1 January of the first unpublished year, in UTC", () => {
    const d = firstUnpublishedYearStart([2020, 2021, 2022, 2023, 2024, 2025]);
    expect(d.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("percent change is signed, and null when it would be undefined", () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(36_210_368, 21_179_239)).toBeLessThan(0);
    expect(percentChange(0, 10)).toBeNull();
    expect(percentChange(null, 10)).toBeNull();
  });
});

describe("format", () => {
  it("shows counted data exactly, with no rounding", () => {
    expect(formatExact(23_399_834)).toBe("23,399,834");
    expect(formatExact(23_399_834.97)).toBe("23,399,834"); // truncates, never rounds up
  });
  it("does not imply unit-level precision for modelled values", () => {
    expect(formatCount(1_266_180)).toBe("1.27 million");
    expect(formatPct(13.2)).toBe("13.2%");
  });
  it("describes a pace as a human interval", () => {
    expect(formatInterval(2)).toBe("2 per second");
    expect(formatInterval(1 / 1.35)).toMatch(/one every 1.4 seconds/);
    expect(formatInterval(1 / 80)).toBe("one every 1 minute 20 seconds");
    expect(formatInterval(0)).toBe("—");
  });
});

describe("fixed colour scale", () => {
  it("maps missing to grey, never to the lowest colour", () => {
    expect(fillFor(null)).toBe(MISSING_FILL);
    expect(fillFor(undefined)).toBe(MISSING_FILL);
    // A real zero (a country listed with no reports) is data, not missing.
    expect(fillFor(0)).not.toBe(MISSING_FILL);
  });
  it("uses constant, log-spaced breaks independent of the selected year", () => {
    expect(REPORT_BREAKS).toEqual([100, 1_000, 10_000, 100_000, 500_000, 1_000_000, 5_000_000]);
    expect(binIndex(50, REPORT_BREAKS)).toBe(0);
    expect(binIndex(5_500_000, REPORT_BREAKS)).toBe(7);
    // Same value must land in the same bin regardless of context.
    expect(fillFor(250_000)).toBe(fillFor(250_000));
  });
});
