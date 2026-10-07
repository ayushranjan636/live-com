import raw from "../../data/eraksha/eraksha.json";

export type CoverageStatus = "active" | "planned";

export interface CoverageEntry {
  country_iso3: string;
  status: CoverageStatus;
  scope: string;
  start: string; // YYYY-MM or YYYY
  users_reached: number | null;
  users_reached_definition: string | null;
  evidence: string;
  as_of: string;
}

export interface ErakshaData {
  organisation: { name: string; description: string | null; description_source: string | null; website: string | null };
  coverage: CoverageEntry[];
  outcome_evidence: unknown[];
  last_reviewed: string | null;
  reviewed_by: string | null;
}

export const eraksha = raw as unknown as ErakshaData;

export function validateCoverage(entries: unknown[]): CoverageEntry[] {
  return entries.map((e, i) => {
    const c = e as CoverageEntry;
    if (!/^[A-Z]{3}$/.test(c.country_iso3)) throw new Error(`coverage[${i}]: bad country_iso3`);
    if (c.status !== "active" && c.status !== "planned") throw new Error(`coverage[${i}]: status must be active|planned`);
    if (!c.evidence) throw new Error(`coverage[${i}]: evidence is required`);
    if (!/^\d{4}(-\d{2})?$/.test(c.start)) throw new Error(`coverage[${i}]: start must be YYYY or YYYY-MM`);
    if (c.users_reached != null && !c.users_reached_definition) throw new Error(`coverage[${i}]: users_reached needs a definition`);
    return c;
  });
}

/** Scenario rows typed by visitors/staff. Never persisted into the verified file. */
export interface ScenarioRow {
  id: string;
  country_iso3: string;
  year: number;
}

export function startYear(c: { start: string }) {
  return Number(c.start.slice(0, 4));
}

/**
 * Status of each country at a timeline year.
 *  - verified active: start <= year
 *  - verified planned: shown as planned (never as active, even after its date passes,
 *    until the file is updated with evidence of launch)
 *  - scenario: start <= year, separate layer
 */
export function coverageAt(year: number, verified: CoverageEntry[], scenario: ScenarioRow[]) {
  const m = new Map<string, "active" | "planned" | "scenario">();
  for (const c of verified) {
    if (c.status === "active" && startYear(c) <= year) m.set(c.country_iso3, "active");
  }
  for (const c of verified) {
    if (c.status === "planned" && !m.has(c.country_iso3)) m.set(c.country_iso3, "planned");
  }
  for (const s of scenario) {
    if (s.year <= year && !m.has(s.country_iso3)) m.set(s.country_iso3, "scenario");
  }
  return m;
}
