import type { ReactNode } from "react";

export function StatusBar({ items, kind }: { items: (string | ReactNode)[]; kind: "count" | "scenario" | "coverage" }) {
  const chip = kind === "count" ? "Counted data" : kind === "scenario" ? "Scenario — not a forecast" : "Coverage only";
  return (
    <div className="status-bar" role="note" aria-label="Data definition">
      <span className={`chip chip-${kind}`}>{chip}</span>
      {items.map((it, i) => (
        <span key={i} className="status-item">
          {it}
        </span>
      ))}
    </div>
  );
}

/**
 * Year selector with no play/pause/replay: the visitor picks a year directly and the
 * view updates. Every published year is a button, so the whole series is visible at once
 * rather than hidden behind a timed animation.
 */
export function YearScrubber({ years, value, onChange, label = "Year" }: { years: number[]; value: number; onChange: (y: number) => void; label?: string }) {
  return (
    <div className="year-scrubber" role="group" aria-label={label}>
      <span className="scrubber-label">{label}</span>
      <div className="scrubber-years" role="radiogroup" aria-label={label}>
        {years.map((y) => (
          <button
            key={y}
            role="radio"
            aria-checked={y === value}
            className={y === value ? "scrub-year on" : "scrub-year"}
            onClick={() => onChange(y)}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Inline sparkline of a country's published series. Bars, not a line, because the
 * values are discrete annual totals with no meaningful values in between.
 */
export function Sparkline({ points, highlight }: { points: { year: number; value: number }[]; highlight?: number }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value)) || 1;
  const W = 120;
  const H = 34;
  const gap = 3;
  const bw = (W - gap * (points.length - 1)) / points.length;
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.year}: ${p.value.toLocaleString("en-US")}`).join("; ")}>
      {points.map((p, i) => {
        const h = Math.max(1, (p.value / max) * (H - 2));
        return (
          <rect
            key={p.year}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            className={p.year === highlight ? "spark-bar on" : "spark-bar"}
          />
        );
      })}
    </svg>
  );
}

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  // Links are shown for traceability. At the booth (offline) they are not followed;
  // the full citation is printed next to every link.
  return (
    <a className="source-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
