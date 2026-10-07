import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import App from "./App";
import { CounterPage } from "./pages/CounterPage";
import { MapPage, CountryDetail } from "./pages/MapPage";
import { MotionContext } from "./lib/hooks";
import { COUNTRY_FEATURES } from "./components/WorldMap";
import { countryIndex, coverageFor, snapshot, worldRecord } from "./data/snapshot";

const DS = snapshot.default_dataset_id;
const LAST = 2025;
const reduced = (node: React.ReactNode) => (
  <MotionContext.Provider value={{ reduced: true, override: true, setOverride: () => {} }}>{node}</MotionContext.Provider>
);

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "#/");
});

describe("live counter page", () => {
  it("shows the counted total, the projected part, and labels which is which", () => {
    render(reduced(<CounterPage datasetId={DS} onOpenMethod={() => {}} />));
    const counted = [2020, 2021, 2022, 2023, 2024, 2025].reduce((s, y) => s + worldRecord(DS, y)!.estimate, 0);
    expect(screen.getByText(counted.toLocaleString("en-US"))).toBeTruthy();
    expect(screen.getByText(/Counted\./)).toBeTruthy();
    expect(screen.getByText(/Projected/)).toBeTruthy();
    // The projection must be described as a projection, not as live reporting.
    expect(screen.getByText(/not live reporting/)).toBeTruthy();
    expect(screen.getByText(/NCMEC publishes annual totals/)).toBeTruthy();
  });

  it("states the unit is reports, not children", () => {
    render(reduced(<CounterPage datasetId={DS} onOpenMethod={() => {}} />));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/reports to NCMEC's CyberTipline/);
    expect(screen.getByText(/each report is a report, not a child/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/mental disorder/i);
  });

  it("has no play, pause or replay control anywhere on the main screen", () => {
    render(reduced(<CounterPage datasetId={DS} onOpenMethod={() => {}} />));
    for (const name of [/^play$/i, /^pause$/i, /^replay/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("ticks upward as real time passes", async () => {
    vi.useFakeTimers();
    render(reduced(<CounterPage datasetId={DS} onOpenMethod={() => {}} />));
    const read = () => Number(document.querySelector(".headline-live")!.textContent!.replace(/\D/g, ""));
    const before = read();
    await act(async () => void vi.advanceTimersByTime(60_000));
    const after = read();
    expect(after).toBeGreaterThan(before);
    vi.useRealTimers();
  });

  it("shows every published annual total as a visible bar with its source", () => {
    render(reduced(<CounterPage datasetId={DS} onOpenMethod={() => {}} />));
    for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) {
      expect(screen.getByText(String(y))).toBeTruthy();
      expect(screen.getByText(worldRecord(DS, y)!.estimate.toLocaleString("en-US"))).toBeTruthy();
    }
    expect(document.querySelectorAll(".bar-fill").length).toBe(6);
  });
});

describe("world map page", () => {
  it("renders a non-empty path for every country shape", () => {
    const { container } = render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    const paths = container.querySelectorAll("path.country");
    expect(paths.length).toBe(COUNTRY_FEATURES.length);
    // Regression guard for the collapsed-map bug: every path must have real geometry.
    const empty = [...paths].filter((p) => (p.getAttribute("d") ?? "").length < 10);
    expect(empty).toHaveLength(0);
  });

  it("gives countries with data a colour and countries with no row the missing pattern", () => {
    const { container } = render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    const idx = countryIndex(DS, LAST);
    const colouredCount = [...container.querySelectorAll("path.country")].filter((p) => p.getAttribute("fill")!.startsWith("#")).length;
    expect(colouredCount).toBe(
      COUNTRY_FEATURES.filter((f) => f.properties.join_iso3 && idx.has(f.properties.join_iso3)).length,
    );
    expect(container.querySelector('path[data-fid="IND"]')!.getAttribute("fill")).toMatch(/^#/);
  });

  it("selection shows the exact published count and its source locator", () => {
    const { container } = render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    fireEvent.click(container.querySelector('path[data-fid="VNM"]')!);
    const panel = screen.getByLabelText("Vietnam details");
    expect(within(panel).getByText("588,858")).toBeTruthy();
    expect(within(panel).getByText(/Reports by Country/)).toBeTruthy();
    expect(within(panel).getByText(/not the location of a child/)).toBeTruthy();
  });

  it("countries with no row say 'Not listed', never zero", () => {
    const f = COUNTRY_FEATURES.find((x) => x.properties.join_iso3 === "IND")!;
    render(<CountryDetail f={f} e={null} year={LAST} datasetId={DS} />);
    expect(screen.getByText("Not listed")).toBeTruthy();
    expect(screen.getByText(/Not listed is not the same as zero/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b0 reports\b/);
  });

  it("warns that country figures are not a ranking of danger, and reports unassigned volume", () => {
    render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    expect(screen.getByText(/Reports, not children, and not a ranking of danger/)).toBeTruthy();
    const cov = coverageFor(LAST)!;
    expect(screen.getByText(new RegExp(cov.no_country_identified.toLocaleString("en-US")))).toBeTruthy();
  });

  it("switching year changes the data shown, with no play control", () => {
    render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    expect(screen.queryByRole("button", { name: /^play$/i })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "2023" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/2023/);
  });

  it("country search selects a country; an accessible table is available", () => {
    render(reduced(<MapPage datasetId={DS} onOpenMethod={() => {}} />));
    fireEvent.change(screen.getByLabelText("Find a country"), { target: { value: "india" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByLabelText("India details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Country table" }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByRole("table")).toBeTruthy();
    expect(within(dlg).getAllByRole("row").length).toBeGreaterThan(100);
  });
});

describe("app shell", () => {
  it("keyboard navigation moves between the three pages and opens methodology", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/CyberTipline reports by country/);
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Safeguarding children online/);
    fireEvent.keyDown(window, { key: "m" });
    expect(screen.getByRole("dialog", { name: "Methodology" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Methodology" })).toBeNull();
  });

  it("eRaksha page shows no actual coverage and labels scenarios", () => {
    history.replaceState(null, "", "#/eraksha");
    const { container } = render(<App />);
    expect(screen.getByText(/No verified eRaksha coverage has been supplied/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scenario planner" }));
    expect(screen.getAllByText(/Scenario—not a forecast/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "IND" } });
    fireEvent.change(screen.getByLabelText("From year"), { target: { value: String(new Date().getFullYear()) } });
    fireEvent.click(screen.getByRole("button", { name: "Add to scenario" }));
    expect(container.querySelector('path[data-fid="IND"]')!.getAttribute("fill")).toBe("url(#dots-scenario)");
    expect(screen.getByText(/Not available\./)).toBeTruthy();
  });

  it("presentation mode advances through pages on a timer", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Present" }));
    await act(async () => {
      vi.advanceTimersByTime(18_100);
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/CyberTipline reports by country/);
    vi.useRealTimers();
  });

  it("never uses disorder or prevalence language anywhere in the shell", () => {
    render(<App />);
    expect(document.body.textContent).not.toMatch(/mental disorder|prevalence/i);
  });
});

describe("eRaksha growth sequence", () => {
  it("advances through the stages on its own, with no year picker", async () => {
    vi.useFakeTimers();
    history.replaceState(null, "", "#/eraksha");
    render(<App />);
    // Years are no longer selectable here: the sequence plays by itself.
    expect(screen.queryByRole("radiogroup", { name: /coverage year/i })).toBeNull();
    expect(document.querySelector(".stage-n")!.textContent).toMatch(/^100 /);
    await act(async () => void vi.advanceTimersByTime(5_100));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/This year/);
    vi.useRealTimers();
  });

  it("shows every stage figure and flags the two that are targets, not forecasts", () => {
    history.replaceState(null, "", "#/eraksha");
    render(reduced(<App />));
    for (const label of [/^Today$/, /^This year$/, /^Within 3 years$/, /^Within 5 years$/]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("10,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 million").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 million").length).toBeGreaterThan(0);
  });

  it("selecting a stage holds the sequence until resumed", () => {
    history.replaceState(null, "", "#/eraksha");
    render(reduced(<App />));
    fireEvent.click(screen.getByRole("button", { name: /Within 5 years/ }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Within 5 years/);
    expect(screen.getByText(/Target, not a forecast/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("never presents a target as a measured outcome", () => {
    history.replaceState(null, "", "#/eraksha");
    render(reduced(<App />));
    fireEvent.click(screen.getByRole("button", { name: /Within 3 years/ }));
    expect(screen.getByText(/Shows service availability, not outcomes for children/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/cases resolved|children saved|abuse prevented/i);
  });
});

describe("offline", () => {
  it("source code makes no network requests", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    for (const f of walk("src").filter((x) => /\.(ts|tsx)$/.test(x) && !x.includes(".test."))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|import\(["']https?:/);
    }
  });
  it("built bundle (if present) references no external scripts, styles or fonts", () => {
    if (!existsSync("dist/index.html")) return;
    const html = readFileSync("dist/index.html", "utf8");
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)="https?:\/\//);
    const assets = readdirSync("dist/assets");
    expect(assets.some((a) => a.endsWith(".woff2"))).toBe(true);
    for (const a of assets.filter((x) => x.endsWith(".css"))) expect(readFileSync(join("dist/assets", a), "utf8")).not.toMatch(/url\(https?:/);
  });
});
