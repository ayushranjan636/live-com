import { useEffect, useMemo, useRef, useState } from "react";
import { getDataset, worldRecord, worldYears } from "../data/snapshot";
import { firstUnpublishedYearStart, percentChange, projectedAtPace, type PaceBasis } from "../lib/methods";
import { formatExact, formatInterval, formatPct, formatSigned } from "../lib/format";import { useReducedMotion } from "../lib/hooks";
import { StatusBar, SourceLink } from "../components/Common";

/**
 * The live figure has two parts, kept visually and verbally separate because they have
 * different epistemic status:
 *
 *   counted   = the sum of every published annual total (2020-2025). Exact, verifiable.
 *   projected = reports that would have arrived since 1 Jan of the first unpublished
 *               year, at the most recent published year's average pace. A projection.
 *
 * The ticking digits are the projected part only. The counted part never moves.
 */
export function CounterPage({ datasetId, onOpenMethod }: { datasetId: string; onOpenMethod: () => void }) {
  const ds = getDataset(datasetId);
  const years = worldYears(datasetId);
  const latest = years[years.length - 1];
  const reduced = useReducedMotion();

  const totals = useMemo(
    () => years.map((y) => ({ year: y, value: worldRecord(datasetId, y)!.estimate })),
    [datasetId, years],
  );
  const counted = useMemo(() => totals.reduce((s, p) => s + p.value, 0), [totals]);
  const basis: PaceBasis = useMemo(
    () => ({ year: latest, annualTotal: worldRecord(datasetId, latest)!.estimate, measure: ds.measure }),
    [datasetId, latest, ds.measure],
  );
  const since = useMemo(() => firstUnpublishedYearStart(years), [years]);

  // Tick the clock. 10/s is smooth to the eye without pretending to be event-driven;
  // with reduced motion we update once a second instead.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), reduced ? 1000 : 100);
    return () => clearInterval(id);
  }, [reduced]);

  const { projected, elapsedSeconds, perSecond } = projectedAtPace(basis, since, now);
  const live = counted + projected;

  const latestRec = worldRecord(datasetId, latest)!;
  const prevRec = years.length > 1 ? worldRecord(datasetId, years[years.length - 2]) : null;
  const yoy = percentChange(prevRec?.estimate ?? null, latestRec.estimate);
  const days = Math.floor(elapsedSeconds / 86400);
  const countedShare = (counted / live) * 100;

  return (
    <section className="page page-counter" aria-labelledby="counter-title">
      <div className="counter-main">
        <p className="eyebrow" id="counter-title">
          Worldwide · reports of suspected online child sexual exploitation
        </p>

        <div className="headline-live" aria-hidden="true">
          {formatExact(live)}
        </div>
        <span className="sr-only" aria-live="off">
          {formatExact(live)} reports: {formatExact(counted)} published for {years[0]}–{latest}, plus {formatExact(projected)} projected
          since 1 January {since.getUTCFullYear()} at {latest}'s average pace.
        </span>

        <h1 className="metric-label">
          reports to NCMEC's CyberTipline of suspected child sexual exploitation online
          <span className="metric-sub"> — each report is a report, not a child</span>
        </h1>

        <div className="live-row">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-label">
            Counting since 1 January {years[0]} · ticking at {latest}'s average pace
          </span>
        </div>

        {/* Composition of the figure above, to scale: what is counted vs what is projected. */}
        <div className="compose" role="group" aria-label="How this figure is composed">
          <div className="compose-bar">
            <span className="compose-counted" style={{ width: `${countedShare}%` }} />
            <span className="compose-projected" style={{ width: `${100 - countedShare}%` }} />
          </div>
          <div className="compose-keys">
            <div className="ckey">
              <span className="ckey-swatch ckey-counted" />
              <span className="ckey-n">{formatExact(counted)}</span>
              <span className="ckey-t">
                <strong>Counted.</strong> Published annual totals, {years[0]}–{latest}. {formatPct(countedShare, 0)} of the figure above.
              </span>
            </div>
            <div className="ckey">
              <span className="ckey-swatch ckey-projected" />
              <span className="ckey-n ckey-proj">+{formatExact(projected)}</span>
              <span className="ckey-t">
                <strong>Projected, not published.</strong> {days} day{days === 1 ? "" : "s"} since 1 Jan {since.getUTCFullYear()} at {latest}'s
                average pace of {formatInterval(perSecond)}.
              </span>
            </div>
          </div>
        </div>

        <p className="estimate-note">
          Only the solid blue part is measured. The rest — and every digit that moves — is a{" "}
          <strong>projection at {latest}'s average pace</strong>, not live reporting. NCMEC publishes annual totals, not a real-time feed, so
          the true figure for {since.getUTCFullYear()} is not yet known and will differ.
        </p>

        <p className="source-line">
          Source: {ds.short_label}. <SourceLink href={latestRec.source_url}>{latestRec.source_url.replace(/^https?:\/\//, "").slice(0, 52)}…</SourceLink>{" "}
          <button className="link-btn" onClick={onOpenMethod}>
            What this number means
          </button>
        </p>
      </div>

      <YearBars totals={totals} datasetId={datasetId} />

      <StatusBar
        kind="count"
        items={[
          "Metric: reports received by NCMEC's CyberTipline (unit = reports, not children)",
          `Published years: ${years[0]}–${latest}`,
          `${latest} vs ${years[years.length - 2]}: ${yoy === null ? "n/a" : formatSigned(yoy, (x) => formatPct(x, 1))} in reports received`,
          "Counted administrative total · no uncertainty interval applies",
        ]}
      />
    </section>
  );
}

/** Published annual totals as bars. Every year is visible; nothing is interpolated. */
function YearBars({ totals, datasetId }: { totals: { year: number; value: number }[]; datasetId: string }) {
  const max = Math.max(...totals.map((t) => t.value));
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="year-bars" ref={ref}>
      <div className="year-bars-head">
        <h2>Reports received each year, as published</h2>
        <p>
          Bar length is the published total for that year. The fall after 2023 is a change in how reports are counted and made — see the
          note below.
        </p>
      </div>
      <ul className="bars">
        {totals.map((t) => {
          const rec = worldRecord(datasetId, t.year)!;
          return (
            <li key={t.year}>
              <button
                className={open === t.year ? "bar-row open" : "bar-row"}
                onClick={() => setOpen(open === t.year ? null : t.year)}
                aria-expanded={open === t.year}
              >
                <span className="bar-year">{t.year}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(t.value / max) * 100}%` }} />
                </span>
                <span className="bar-val">{formatExact(t.value)}</span>
              </button>
              {open === t.year && (
                <p className="bar-detail">
                  {rec.source_locator}{" "}
                  <SourceLink href={rec.source_url}>Source PDF</SourceLink>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
