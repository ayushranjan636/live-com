import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRY_FEATURES, WorldMap, type CountryFeature } from "../components/WorldMap";
import { StatusBar } from "../components/Common";
import { coverageAt, eraksha, validateCoverage, type ScenarioRow } from "../data/eraksha";
import { useReducedMotion } from "../lib/hooks";
import { COVERAGE } from "../lib/scales";

const STORAGE_KEY = "eraksha.scenario.v1";
const SCENARIO_LABEL = "Scenario—not a forecast and not NCMEC data";
const CURRENT_YEAR = new Date().getFullYear();

/**
 * eRaksha's reach as a sequence that plays by itself: what is true today, then the
 * stated targets. Two are counts, two are targets — the visual keeps them distinct.
 * There is no year picker; the stages advance on their own.
 */
const HOME_ISO = "IND";

const STAGES = [
  {
    id: "now",
    when: "Today",
    families: 100,
    caption: "families actively protected",
    detail: "Live on eRaksha right now, in India",
    scope: "India",
    kind: "now" as const,
    offset: 0,
  },
  {
    id: "waiting",
    when: "This year",
    families: 10_000,
    caption: "families on the waiting list",
    detail: "Signed up and waiting to be onboarded",
    scope: "India",
    kind: "now" as const,
    offset: 0,
  },
  {
    id: "y3",
    when: "Within 3 years",
    families: 1_000_000,
    caption: "families — target",
    detail: "Stated target across India",
    scope: "India",
    kind: "target" as const,
    offset: 3,
  },
  {
    id: "y5",
    when: "Within 5 years",
    families: 5_000_000,
    caption: "families — target",
    detail: "Stated five-year goal, beyond India",
    scope: "Worldwide ambition",
    kind: "target" as const,
    offset: 5,
  },
];

const STAGE_MS = 5000;

// Charcoal while the figure is a count; ochre once it is a target. Never the blue of
// the NCMEC report ramp, so "families reached" can never be read as "reports".
const STAGE_HOME_FILL = ["#9aa0aa", "#3f4654", "#b06c14", "#96560f"];
const AMBITION_FILL = "#f2e7d6";

function formatFamilies(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} million`;
  return n.toLocaleString("en-US");
}

/** The current stage, large: the figure, what it counts, and how far along we are. */
function ReachStage({ stage, shown }: { stage: (typeof STAGES)[number]; shown: number }) {
  const pct = (stage.families / STAGES[STAGES.length - 1].families) * 100;
  return (
    <section className={`stage stage-${stage.kind}`} aria-live="polite">
      <p className="stage-when">{stage.when}</p>
      <p className="stage-n">
        {formatFamilies(shown)} <span className="stage-caption">{stage.caption}</span>
      </p>
      <div className="stage-bar" role="img" aria-label={`${formatFamilies(stage.families)} of a 5 million family goal`}>
        <span className="stage-bar-fill" style={{ width: `${Math.max(0.4, pct)}%` }} />
      </div>
      <p className="stage-detail">
        {stage.detail}
        {stage.kind === "target" && <span className="stage-flag"> Target, not a forecast</span>}
      </p>
    </section>
  );
}

/** Eases the headline figure up to the stage value so growth is felt, not just read. */
function useCountUp(target: number, animate: boolean) {
  const [n, setN] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (!animate) {
      fromRef.current = target;
      setN(target);
      return;
    }
    const from = fromRef.current;
    const t0 = performance.now();
    const DUR = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return n;
}

function loadScenario(): ScenarioRow[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => /^[A-Z]{3}$/.test(r.country_iso3) && Number.isInteger(r.year)) : [];
  } catch {
    return [];
  }
}

export function ErakshaPage({ onOpenMethod }: { onOpenMethod: () => void }) {
  const verified = useMemo(() => validateCoverage(eraksha.coverage), []);
  const [scenario, setScenario] = useState<ScenarioRow[]>(loadScenario);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftIso, setDraftIso] = useState("");
  const [draftYear, setDraftYear] = useState(CURRENT_YEAR + 1);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario)), [scenario]);

  const reduced = useReducedMotion();
  // The sequence plays on its own. Choosing a stage directly stops it advancing, so a
  // visitor is never fighting the animation.
  const [stageIdx, setStageIdx] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const id = setInterval(() => setStageIdx((i) => (i + 1) % STAGES.length), STAGE_MS);
    return () => clearInterval(id);
  }, [held]);

  const stage = STAGES[stageIdx];
  const year = CURRENT_YEAR + stage.offset;
  const shown = useCountUp(stage.families, !reduced);

  const status = coverageAt(year, verified, scenario);
  const styleFor = (f: CountryFeature) => {
    const iso = f.properties.join_iso3;
    const s = iso ? status.get(iso) : undefined;
    // Verified coverage and scenario entries always win over the stage illustration.
    if (s === "active") return { fill: COVERAGE.active };
    if (s === "planned") return { fill: COVERAGE.planned, pattern: "planned" as const, stroke: "#96560f" };
    if (s === "scenario") return { fill: COVERAGE.none, pattern: "scenario" as const, stroke: "#96560f" };
    if (iso === HOME_ISO) return { fill: STAGE_HOME_FILL[stageIdx] };
    if (stage.scope === "Worldwide ambition") return { fill: AMBITION_FILL };
    return { fill: COVERAGE.none };
  };

  const countries = useMemo(
    () => COUNTRY_FEATURES.filter((f) => f.properties.join_iso3).map((f) => ({ iso: f.properties.join_iso3!, name: f.properties.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const nameOf = (iso: string) => countries.find((c) => c.iso === iso)?.name ?? iso;
  const sel = COUNTRY_FEATURES.find((f) => f.properties.fid === selected);
  const selIso = sel?.properties.join_iso3 ?? null;
  const hasVerified = verified.length > 0;
  const activeN = [...status.values()].filter((s) => s === "active").length;
  const plannedN = [...status.values()].filter((s) => s === "planned").length;
  const scenN = [...status.values()].filter((s) => s === "scenario").length;

  return (
    <section className="page page-eraksha" aria-labelledby="er-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">eRaksha · families protected</p>
          <h1 id="er-title" className="page-title">
            Safeguarding children online <span className="title-year">{stage.when}</span>
          </h1>
        </div>
        <div className="map-tools">
          <button className="btn ghost" onClick={() => setPlannerOpen((v) => !v)} aria-expanded={plannerOpen}>
            {plannerOpen ? "Close scenario planner" : "Scenario planner"}
          </button>
        </div>
      </header>

      {!hasVerified && (
        <div className="notice" role="status">
          <strong>No verified eRaksha coverage has been supplied for this display.</strong> No country is shown as actual coverage. Expansion
          shown here comes only from the scenario planner and is labelled “{SCENARIO_LABEL}”.
        </div>
      )}
      {eraksha.organisation.description && (
        <p className="org-desc">
          {eraksha.organisation.description} <span className="detail-fine">({eraksha.organisation.description_source})</span>
        </p>
      )}

      <ReachStage stage={stage} shown={shown} />

      <div className="map-stage">
        <WorldMap
          styleFor={styleFor}
          label={`Map of where eRaksha protects families, ${stage.when}. Colour shows where the service reaches, not any change in report counts.`}
          selected={selected}
          onSelect={setSelected}
        />
        <div className="legend" aria-label="Coverage legend">
          <p className="legend-title">Where eRaksha reaches</p>
          <ul>
            <li>
              <span className="sw" style={{ background: STAGE_HOME_FILL[stageIdx] }} /> India — {stage.when.toLowerCase()}
            </li>
            {stage.scope === "Worldwide ambition" && (
              <li>
                <span className="sw" style={{ background: AMBITION_FILL }} /> Beyond India — ambition
              </li>
            )}
            {activeN > 0 && (
              <li>
                <span className="sw" style={{ background: COVERAGE.active }} /> Active — verified ({activeN})
              </li>
            )}
            {plannedN > 0 && (
              <li>
                <span className="sw sw-planned" /> Planned — verified plan ({plannedN})
              </li>
            )}
            {scenN > 0 && (
              <li>
                <span className="sw sw-scenario" /> Scenario entry ({scenN})
              </li>
            )}
          </ul>
          <p className="legend-missing">
            Shows where the service reaches. It does not show prevention, protection, or any change in the report counts.
          </p>
        </div>
        {sel && (
          <aside className="detail-panel" aria-live="polite">
            <button className="btn icon close" onClick={() => setSelected(null)} aria-label="Close details">
              ×
            </button>
            <h2>{sel.properties.name}</h2>
            {selIso && verified.filter((c) => c.country_iso3 === selIso).length > 0 ? (
              verified
                .filter((c) => c.country_iso3 === selIso)
                .map((c, i) => (
                  <dl key={i}>
                    <dt>Status</dt>
                    <dd>{c.status === "active" ? "Active (verified)" : "Planned (verified plan)"}</dd>
                    <dt>Scope</dt>
                    <dd>{c.scope}</dd>
                    <dt>{c.status === "active" ? "Since" : "Planned for"}</dt>
                    <dd>{c.start}</dd>
                    {c.users_reached != null && (
                      <>
                        <dt>Reached</dt>
                        <dd>
                          {c.users_reached.toLocaleString("en-US")} — {c.users_reached_definition}
                        </dd>
                      </>
                    )}
                    <dt>Evidence</dt>
                    <dd>
                      {c.evidence} (as of {c.as_of})
                    </dd>
                  </dl>
                ))
            ) : (
              <p className="detail-missing">No verified eRaksha coverage recorded.</p>
            )}
            {selIso && scenario.some((s) => s.country_iso3 === selIso) && (
              <p className="scenario-tag">
                Scenario entry: from {scenario.find((s) => s.country_iso3 === selIso)!.year}. {SCENARIO_LABEL}.
              </p>
            )}
          </aside>
        )}
      </div>

      {plannerOpen && (
        <div className="planner" role="region" aria-label="Scenario planner">
          <p className="scenario-banner">{SCENARIO_LABEL}</p>
          <p className="detail-fine">
            Add countries and years to show a possible rollout. Entries stay on this device only. They are not eRaksha commitments and
            include no number of people reached or health effects.
          </p>
          <form
            className="planner-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftIso) return;
              setScenario((s) => [...s.filter((r) => r.country_iso3 !== draftIso), { id: `${draftIso}-${draftYear}`, country_iso3: draftIso, year: draftYear }]);
              setDraftIso("");
            }}
          >
            <label>
              Country
              <select value={draftIso} onChange={(e) => setDraftIso(e.target.value)}>
                <option value="">Choose…</option>
                {countries.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From year
              <input type="number" min={CURRENT_YEAR - 10} max={CURRENT_YEAR + 15} value={draftYear} onChange={(e) => setDraftYear(Number(e.target.value))} />
            </label>
            <button className="btn primary" type="submit" disabled={!draftIso}>
              Add to scenario
            </button>
            <button className="btn" type="button" onClick={() => setScenario([])} disabled={!scenario.length}>
              Clear all
            </button>
          </form>
          {scenario.length > 0 && (
            <ul className="planner-list">
              {[...scenario]
                .sort((a, b) => a.year - b.year)
                .map((s) => (
                  <li key={s.id}>
                    {nameOf(s.country_iso3)} — from {s.year}{" "}
                    <button className="btn small" onClick={() => setScenario((x) => x.filter((r) => r.id !== s.id))} aria-label={`Remove ${nameOf(s.country_iso3)}`}>
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="map-bottom">
        <ol className="stage-track" aria-label="Growth stages">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                className={`stage-step ${i === stageIdx ? "on" : ""} ${s.kind === "target" ? "target" : ""}`}
                aria-current={i === stageIdx ? "step" : undefined}
                onClick={() => {
                  setStageIdx(i);
                  setHeld(true);
                }}
              >
                <span className="stage-step-when">{s.when}</span>
                <span className="stage-step-n">{formatFamilies(s.families)}</span>
                {i === stageIdx && !held && !reduced && <span className="stage-step-bar" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ol>
        {held && (
          <button className="btn small" onClick={() => setHeld(false)}>
            Resume
          </button>
        )}
        <details className="rate-panel">
          <summary>Impact estimates</summary>
          <p>
            <strong>Not available.</strong> No study of eRaksha's effect on a defined, measured outcome has been supplied. Being available
            in a country does not show that any child was protected or that any report was prevented, so this display estimates no impact. It
            would need a measured outcome and study population, the baseline frequency, the eligible population, adoption and retention
            assumptions, a defined effect size, a time horizon, a sensitivity analysis, and limits on applying results elsewhere.{" "}
            <button className="link-btn" onClick={onOpenMethod}>
              Methodology
            </button>
          </p>
        </details>
      </div>

      <StatusBar
        kind={scenario.length ? "scenario" : "coverage"}
        items={[
          "Shows service availability, not outcomes for children",
          hasVerified ? `Verified coverage reviewed ${eraksha.last_reviewed ?? "—"}` : "Verified coverage: none supplied",
          scenario.length ? SCENARIO_LABEL : "No scenario entries",
          "NCMEC does not endorse eRaksha",
        ]}
      />
    </section>
  );
}
