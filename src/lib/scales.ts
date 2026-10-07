// Fixed colour scales. Breaks are constants and never computed from the data of the
// selected year, so the same value is always the same colour in every year.

export const MISSING_FILL = "#eceef1"; // neutral light grey — "not listed for this year"
export const NO_DATA_STROKE = "#dfe2e7";

/**
 * CyberTipline reports per country per year. The distribution is extremely skewed
 * (single digits to >5 million), so breaks are log-spaced decades. Fixed for all years
 * so a country's colour change between years is a real change in reports.
 *
 * One hue, light to dark: more ink means more reports. A single-hue sequential ramp
 * carries magnitude without implying categories or judgement.
 */
export const REPORT_BREAKS = [100, 1_000, 10_000, 100_000, 500_000, 1_000_000, 5_000_000];
export const REPORT_COLORS = ["#e3eafc", "#c7d6f8", "#a7bdf2", "#829fe9", "#5e80dd", "#3f63cf", "#2a49b4", "#1b3182"];

export function binIndex(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

/** null/undefined means "no row published for this country in this year" — grey, never zero. */
export function fillFor(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING_FILL;
  return REPORT_COLORS[binIndex(value, REPORT_BREAKS)];
}

const short = (x: number) => (x >= 1e6 ? `${x / 1e6}M` : x >= 1e3 ? `${x / 1e3}k` : String(x));

export function legendBins() {
  return REPORT_COLORS.map((c, i) => ({
    color: c,
    // Tick marks the lower bound of the bin, so the ramp reads as an axis.
    tick: i === 0 ? "0" : short(REPORT_BREAKS[i - 1]),
    label:
      i === 0
        ? `< ${short(REPORT_BREAKS[0])}`
        : i === REPORT_BREAKS.length
          ? `≥ ${short(REPORT_BREAKS[i - 1])}`
          : `${short(REPORT_BREAKS[i - 1])}–${short(REPORT_BREAKS[i])}`,
  }));
}

// eRaksha coverage — deliberately outside the blue report ramp. Solid charcoal is
// verified presence; the ochre patterns are plans and scenarios, so "where the service
// exists" can never be read as "how many reports".
export const COVERAGE = {
  active: "#2b3038", // solid fill — verified, present
  planned: "#96560f", // drawn as hatched pattern + outline (never solid)
  // Readable against the light map stage, so "no coverage" still shows country shapes.
  none: "#dcdfe4",
};
