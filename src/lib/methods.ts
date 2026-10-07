// Pure, tested functions implementing the methodology rules in docs/METHODOLOGY.md.

export interface Point {
  year: number;
  value: number;
}

/**
 * Linear interpolation between two adjacent source estimates.
 *   value(t) = v0 + (v1 − v0) × ((t − t0) / (t1 − t0))
 * t is the DISPLAYED historical time, not the visitor's clock. t is clamped to the
 * span of the source points, so nothing is ever extrapolated before the first or
 * after the last estimate. At a source year the source value is returned exactly.
 */
export function interpolate(points: Point[], t: number): { value: number; interpolated: boolean; t: number } {
  if (points.length === 0) throw new Error("No source points");
  const pts = [...points].sort((a, b) => a.year - b.year);
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (t <= first.year) return { value: first.value, interpolated: false, t: first.year };
  if (t >= last.year) return { value: last.value, interpolated: false, t: last.year };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t === a.year) return { value: a.value, interpolated: false, t };
    if (t === b.year) return { value: b.value, interpolated: false, t };
    if (t > a.year && t < b.year) {
      return { value: a.value + (b.value - a.value) * ((t - a.year) / (b.year - a.year)), interpolated: true, t };
    }
  }
  /* istanbul ignore next */
  return { value: last.value, interpolated: false, t: last.year };
}

/**
 * Average annual net change in estimated prevalence count between two comparable
 * prevalence estimates from the SAME dataset release. Can be negative.
 * This is NOT incidence and NOT a count of newly affected people.
 * Returns null unless both points exist and are distinct years.
 */
export function annualizedNetChange(start: Point | null, end: Point | null): number | null {
  if (!start || !end || end.year === start.year) return null;
  return (end.value - start.value) / (end.year - start.year);
}

export type CalendarConvention = "actual" | "standard365";

export function secondsInYear(year: number, convention: CalendarConvention): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = convention === "standard365" ? 365 : leap ? 366 : 365;
  return days * 86400;
}

export interface IncidenceInput {
  measure: string; // must be exactly "incidence"
  annualCount: number;
  referenceYear: number;
  counts: "people" | "cases" | "episodes" | "reports";
}

/**
 * Average per-second / per-minute rate derived from an ANNUAL INCIDENCE estimate.
 * Refuses (throws) for anything that is not explicitly an incidence measure, so a
 * prevalence total can never be divided by seconds and shown as "new cases per second".
 */
export function incidenceAverages(input: IncidenceInput, convention: CalendarConvention) {
  if (input.measure !== "incidence") {
    throw new Error("Rates per second/minute may only be derived from an annual INCIDENCE estimate");
  }
  const s = secondsInYear(input.referenceYear, convention);
  return {
    perSecond: input.annualCount / s,
    perMinute: input.annualCount / (s / 60),
    counts: input.counts,
    convention,
    label: "Average derived from an annual total—not live reporting",
  };
}

// ---------------------------------------------------------------------------
// Live pace projection
// ---------------------------------------------------------------------------
// A ticking counter is only defensible for a FLOW (events during a period), never for
// a STOCK (people currently in a state). CyberTipline reports are a flow, so an average
// pace per second is a real quantity: total reports in a year / seconds in that year.
//
// What a ticker CANNOT be is "the actual number of reports received so far today".
// NCMEC publishes annual totals, not a live feed, and the current year is not yet
// published. So the ticker below is explicitly a PROJECTION AT A PAST YEAR'S OBSERVED
// AVERAGE PACE, and every function here is named and documented to keep that distinction.

export interface PaceBasis {
  /** The most recent year with a published total. */
  year: number;
  /** That year's published total — a counted, exact figure. */
  annualTotal: number;
  measure: string;
}

/** Average reports per second during the basis year. Exact division, no rounding. */
export function averagePacePerSecond(basis: PaceBasis, convention: CalendarConvention = "actual"): number {
  if (basis.measure !== "incidence") {
    throw new Error("A per-second pace may only be derived from a flow (incidence) measure, never from a prevalence stock");
  }
  return basis.annualTotal / secondsInYear(basis.year, convention);
}

/**
 * Reports that WOULD have been received since `since` if reporting continued at exactly
 * the basis year's average pace. Returns the elapsed seconds too, so the UI can state
 * the span it covers. This is a projection, not an observation: label it as such.
 */
export function projectedAtPace(
  basis: PaceBasis,
  since: Date,
  now: Date,
  convention: CalendarConvention = "actual",
): { projected: number; elapsedSeconds: number; perSecond: number } {
  const perSecond = averagePacePerSecond(basis, convention);
  const elapsedSeconds = Math.max(0, (now.getTime() - since.getTime()) / 1000);
  return { projected: perSecond * elapsedSeconds, elapsedSeconds, perSecond };
}

/** Start of the first calendar year that has no published total (UTC). */
export function firstUnpublishedYearStart(publishedYears: number[]): Date {
  const next = Math.max(...publishedYears) + 1;
  return new Date(Date.UTC(next, 0, 1, 0, 0, 0, 0));
}

/** Percent change between two totals, or null if either is missing. Can be negative. */
export function percentChange(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return ((to - from) / from) * 100;
}
