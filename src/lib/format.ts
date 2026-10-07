// Number formatting that never implies more precision than the source supports.

/** Large modelled counts: "166 million", "1.27 million", "960,000", "7,300", "600". */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9, 2)} billion`;
  if (abs >= 1e6) return `${trim(n / 1e6, abs >= 1e8 ? 0 : abs >= 1e7 ? 1 : 2)} million`;
  if (abs >= 1e5) return round(n, 10_000).toLocaleString("en-US");
  if (abs >= 1e4) return round(n, 1_000).toLocaleString("en-US");
  if (abs >= 1e3) return round(n, 100).toLocaleString("en-US");
  return round(n, 10).toLocaleString("en-US");
}

/** The headline count is shown exactly as published (166,000,000 is "166 million"). */
export function formatHeadline(n: number): { number: string; unit: string } {
  if (Math.abs(n) >= 1e6) {
    const v = n / 1e6;
    return { number: v >= 100 ? Math.round(v).toString() : trim(v, 1), unit: "million" };
  }
  return { number: formatCount(n), unit: "" };
}

export function formatPct(p: number, decimals = 1): string {
  return `${p.toFixed(decimals)}%`;
}

/** Exact integer with thousands separators: "23,399,834". Used where the source is a count. */
export function formatExact(n: number): string {
  return Math.trunc(n).toLocaleString("en-US");
}

/** "1.4 per second" / "one every 12 seconds" / "one every 1 minute 20 seconds". */
export function formatInterval(perSecond: number): string {
  if (!Number.isFinite(perSecond) || perSecond <= 0) return "—";
  const s = 1 / perSecond;
  // At or above one per second, a rate reads better than an interval.
  if (s <= 1) return `${trim(perSecond, 1)} per second`;
  if (s < 60) return `one every ${trim(s, 1)} seconds`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `one every ${m} minute${m === 1 ? "" : "s"}${rem ? ` ${rem} second${rem === 1 ? "" : "s"}` : ""}`;
}

export function formatSigned(n: number, f: (x: number) => string): string {
  if (n === 0) return f(0);
  return n > 0 ? `+${f(n)}` : `−${f(Math.abs(n))}`;
}

function round(n: number, step: number) {
  return Math.round(n / step) * step;
}
function trim(v: number, d: number) {
  return Number(v.toFixed(d)).toString();
}
