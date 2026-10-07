import { useEffect, useMemo, useRef, useState } from "react";
import { countryIndex, countrySeries, countryYears, coverageFor, getDataset, worldRecord } from "../data/snapshot";
import { COUNTRY_FEATURES, WorldMap, type CountryFeature } from "../components/WorldMap";
import { StatusBar, SourceLink, YearScrubber, Sparkline } from "../components/Common";
import { fillFor, legendBins, MISSING_FILL } from "../lib/scales";
import { formatExact, formatPct, formatSigned } from "../lib/format";
import { percentChange } from "../lib/methods";

export function MapPage({
  datasetId,
  onOpenMethod,
  sharedYear,
  onYearChange,
}: {
  datasetId: string;
  onOpenMethod: () => void;
  sharedYear?: number | null;
  onYearChange?: (y: number) => void;
}) {
  const ds = getDataset(datasetId);
  const years = countryYears(datasetId);
  const last = years[years.length - 1];
  const [year, setYear] = useState(sharedYear != null && years.includes(sharedYear) ? sharedYear : last);
  useEffect(() => onYearChange?.(year), [year, onYearChange]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ fid: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [focus, setFocus] = useState<{ fids: string[] | null; key: number }>({ fids: null, key: 0 });

  const idx = useMemo(() => countryIndex(datasetId, year), [datasetId, year]);
  const featuresWithData = useMemo(() => COUNTRY_FEATURES.filter((f) => f.properties.join_iso3 && idx.has(f.properties.join_iso3)), [idx]);
  // Only countries that actually get a shape, so the figure matches what is on screen.
  const mappedTotal = useMemo(
    () => featuresWithData.reduce((s, f) => s + (idx.get(f.properties.join_iso3!)?.reports.estimate ?? 0), 0),
    [featuresWithData, idx],
  );
  const cov = coverageFor(year);

  const entryFor = (f: CountryFeature) => (f.properties.join_iso3 ? idx.get(f.properties.join_iso3) ?? null : null);

  const styleFor = (f: CountryFeature) => {
    const e = entryFor(f);
    if (!e) return { fill: MISSING_FILL, pattern: "missing" as const };
    return { fill: fillFor(e.reports.estimate) };
  };

  const selFeature = COUNTRY_FEATURES.find((f) => f.properties.fid === selected) ?? null;
  const hovFeature = hover ? COUNTRY_FEATURES.find((f) => f.properties.fid === hover.fid) ?? null : null;

  const names = useMemo(() => COUNTRY_FEATURES.map((f) => f.properties.name).sort((a, b) => a.localeCompare(b)), []);
  const doSearch = (q: string) => {
    const t = q.trim().toLowerCase();
    if (!t) return;
    const f =
      COUNTRY_FEATURES.find((x) => x.properties.name.toLowerCase() === t) ??
      COUNTRY_FEATURES.find((x) => x.properties.name.toLowerCase().startsWith(t));
    if (f) {
      setSelected(f.properties.fid);
      setFocus((p) => ({ fids: [f.properties.fid], key: p.key + 1 }));
    }
  };

  const worldRec = worldRecord(datasetId, year);

  return (
    <section className="page page-map" aria-labelledby="map-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Where reports came from · {year}</p>
          <h1 id="map-title" className="page-title">
            CyberTipline reports by country <span className="title-year">{year}</span>
          </h1>
        </div>
        <div className="map-tools">
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(query);
            }}
          >
            <label className="sr-only" htmlFor="country-search">
              Find a country
            </label>
            <input
              id="country-search"
              list="country-names"
              placeholder="Find a country"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <datalist id="country-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button className="btn" type="submit">
              Go
            </button>
          </form>
          <button className="btn" onClick={() => setFocus((p) => ({ fids: null, key: p.key + 1 }))}>
            Reset view
          </button>
          <button className="btn" onClick={() => setListOpen(true)} aria-haspopup="dialog">
            Country table
          </button>
        </div>
      </header>

      <div className="map-stage">
        <WorldMap
          styleFor={styleFor}
          label={`World map of CyberTipline reports by country, ${year}. Use the country table for an accessible list.`}
          selected={selected}
          onSelect={setSelected}
          onHover={(fid, p) => setHover(fid && p ? { fid, ...p } : null)}
          focusFids={focus.fids}
          focusKey={focus.key}
        />
        {hovFeature && hover && !selected && (
          <div className="tooltip" style={{ left: hover.x + 16, top: hover.y + 16 }} role="presentation">
            <CountryDetail f={hovFeature} e={entryFor(hovFeature)} year={year} datasetId={datasetId} compact />
          </div>
        )}
        {selFeature && (
          <aside className="detail-panel" aria-live="polite" aria-label={`${selFeature.properties.name} details`}>
            <button className="btn icon close" onClick={() => setSelected(null)} aria-label="Close details">
              ×
            </button>
            <CountryDetail f={selFeature} e={entryFor(selFeature)} year={year} datasetId={datasetId} />
          </aside>
        )}
        <Legend />
      </div>

      <div className="map-bottom">
        <YearScrubber years={years} value={year} onChange={setYear} />
        <p className="coverage-note">
          <strong>Reports, not children, and not a ranking of danger.</strong> {ds.country_attribution_warning.split(". ")[0]}.{" "}
          {cov && (
            <>
              In {year}, {formatExact(cov.no_country_identified)} reports ({formatPct(cov.no_country_identified_pct)}) had no country
              identified and appear on no country.{" "}
            </>
          )}
          {worldRec && (
            <>
              Shaded countries sum to {formatExact(mappedTotal)} of the published {formatExact(worldRec.estimate)} total.{" "}
            </>
          )}
          {cov && cov.not_separately_mapped.length > 0 && (
            <>
              A further {formatExact(cov.not_separately_mapped.reduce((s, x) => s + x.reports, 0))} belong to{" "}
              {cov.not_separately_mapped.length} territories with no separate shape in these boundaries (
              {cov.not_separately_mapped.slice(0, 3).map((x) => x.label.replace(/ \([A-Z]{3}\)$/, "")).join(", ")}
              {cov.not_separately_mapped.length > 3 ? " and others" : ""}); they appear in the country table.{" "}
            </>
          )}
          <button className="link-btn" onClick={onOpenMethod}>
            Methods &amp; boundaries
          </button>
        </p>
      </div>

      <StatusBar
        kind="count"
        items={[
          "Metric: CyberTipline reports received (unit = reports)",
          `Year: ${year} · ${featuresWithData.length} countries and territories listed`,
          "Counted administrative total",
          "Fixed colour scale for all years",
        ]}
      />

      {listOpen && (
        <CountryTable
          onClose={() => setListOpen(false)}
          idx={idx}
          year={year}
          onPick={(fid) => {
            setSelected(fid);
            setFocus((p) => ({ fids: [fid], key: p.key + 1 }));
            setListOpen(false);
          }}
        />
      )}
    </section>
  );
}

type Entry = ReturnType<typeof countryIndex> extends Map<string, infer V> ? V | null : never;

export function CountryDetail({
  f,
  e,
  year,
  datasetId,
  compact,
}: {
  f: CountryFeature;
  e: Entry;
  year: number;
  datasetId: string;
  compact?: boolean;
}) {
  const series = useMemo(() => (f.properties.join_iso3 ? countrySeries(datasetId, f.properties.join_iso3) : []), [datasetId, f]);
  const prev = series.find((p) => p.year === year - 1)?.value ?? null;
  const cur = e?.reports.estimate ?? null;
  const change = percentChange(prev, cur);
  return (
    <div className={compact ? "country-detail compact" : "country-detail"}>
      <h3>{f.properties.name}</h3>
      {e ? (
        <>
          <p className="detail-big">{formatExact(e.reports.estimate)}</p>
          <p className="detail-unit">reports in {year}</p>
          {change !== null && (
            <p className="detail-change">
              {formatSigned(change, (x) => formatPct(x, 1))} vs {year - 1}
            </p>
          )}
          {series.length > 1 && (
            <div className="detail-spark">
              <Sparkline points={series} highlight={year} />
              <span className="spark-range">
                {series[0].year}–{series[series.length - 1].year}
              </span>
            </div>
          )}
          {!compact && (
            <>
              <p className="detail-fine">{e.reports.source_locator}</p>
              <p className="detail-fine">
                Reports are attributed by geographic indicators for the reported incident, usually the upload location — not the location of
                a child. Affected by VPNs and proxies.
              </p>
              <SourceLink href={e.reports.source_url}>Source PDF</SourceLink>
            </>
          )}
        </>
      ) : (
        <>
          <p className="detail-big detail-missing">Not listed</p>
          <p className="detail-unit">no row for {year} in this release</p>
          {!compact && <p className="detail-fine">Not listed is not the same as zero. This country has no published row for this year.</p>}
        </>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <p className="legend-title">Reports received</p>
      <ul className="legend-bins">
        {legendBins().map((b) => (
          <li key={b.label}>
            <span className="swatch" style={{ background: b.color }} title={b.label} />
            <span className="bin-tick">{b.tick}</span>
          </li>
        ))}
      </ul>
      <p className="legend-missing">
        <span className="swatch swatch-missing" /> Not listed for this year (not zero)
      </p>
    </div>
  );
}

function CountryTable({
  onClose,
  idx,
  year,
  onPick,
}: {
  onClose: () => void;
  idx: ReturnType<typeof countryIndex>;
  year: number;
  onPick: (fid: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const rows = COUNTRY_FEATURES.filter((f) => f.properties.join_iso3).map((f) => ({ f, e: idx.get(f.properties.join_iso3!) ?? null }));
  const withData = rows.filter((r) => r.e).sort((a, b) => b.e!.reports.estimate - a.e!.reports.estimate);
  const missing = rows.filter((r) => !r.e).sort((a, b) => a.f.properties.name.localeCompare(b.f.properties.name));
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="list-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="list-title">CyberTipline reports by country, {year}</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        <table>
          <caption className="sr-only">Reports received, highest first</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Country or territory</th>
              <th scope="col">Reports</th>
            </tr>
          </thead>
          <tbody>
            {withData.map(({ f, e }, i) => (
              <tr key={f.properties.fid}>
                <td className="rank">{i + 1}</td>
                <th scope="row">
                  <button className="link-btn" onClick={() => onPick(f.properties.fid)}>
                    {f.properties.name}
                  </button>
                </th>
                <td className="num">{formatExact(e!.reports.estimate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missing.length > 0 && (
          <details>
            <summary>{missing.length} countries and territories with no row for {year}</summary>
            <p className="detail-fine">{missing.map((m) => m.f.properties.name).join(", ")}</p>
          </details>
        )}
      </div>
    </div>
  );
}
