// Build the bundled, offline map geometry from Natural Earth (public domain).
//
// Input : data/raw/naturalearth/ne_10m_admin_0_countries_ind.geojson
//         Natural Earth v5.1.x Admin-0 countries, "India point of view" worldview.
//         Chosen because the exhibition is in India: this worldview renders India's
//         boundaries as officially claimed by the Government of India.
// Output: src/generated/world.topo.json  (simplified TopoJSON, bundled into the app)
//
// Join key rule (documented in docs/METHODOLOGY.md):
//   join_iso3 = ISO_A3_EH when ADM0_A3 === ISO_A3_EH (normal countries)
//             = ISO_A3_EH for a reviewed allowlist of features whose ADM0_A3 differs
//             = null otherwise (minor dependencies, leases, indeterminate areas) —
//               these are drawn but never receive a country's value.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mapshaper = require("mapshaper");

const SRC = "data/raw/naturalearth/ne_10m_admin_0_countries_ind.geojson";
const OUT = "src/generated/world.topo.json";

// Reviewed exceptions where ADM0_A3 !== ISO_A3_EH but the feature IS the country.
const ALLOW = { PSX: "PSE", SDS: "SSD", ALD: "ALA" };

const g = JSON.parse(readFileSync(SRC, "utf8"));
const unjoined = [];
for (const f of g.features) {
  const p = f.properties;
  const eh = p.ISO_A3_EH;
  let join = null;
  if (/^[A-Z]{3}$/.test(eh) && p.ADM0_A3 === eh) join = eh;
  else if (ALLOW[p.ADM0_A3]) join = ALLOW[p.ADM0_A3];
  else unjoined.push(`${p.NAME} (${p.ADM0_A3}, ${p.TYPE})`);
  f.properties = {
    fid: p.ADM0_A3,
    name: p.NAME_EN || p.NAME,
    join_iso3: join,
    type: p.TYPE,
  };
}

const input = { "in.json": JSON.stringify(g) };
const cmd =
  "-i in.json -simplify 6% weighted keep-shapes -clean -o out.json format=topojson quantization=100000 id-field=fid";
const out = await mapshaper.applyCommands(cmd, input);
mkdirSync("src/generated", { recursive: true });
const topo = JSON.parse(out["out.json"]);
topo.metadata = {
  source: "Natural Earth 1:10m Admin 0 – Countries, India point-of-view (ne_10m_admin_0_countries_ind)",
  source_url:
    "https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries_ind.geojson",
  version: "Natural Earth vector repository master, VERSION file 5.2.0-pre (latest tagged release v5.1.2)",
  licence: "Public domain (Natural Earth terms of use: https://www.naturalearthdata.com/about/terms-of-use/)",
  retrieved_at: "2026-10-06",
  processing: "mapshaper: simplify 6% (weighted Visvalingam, keep-shapes), clean, TopoJSON quantization 1e5",
  unjoined_features: unjoined,
};
writeFileSync(OUT, JSON.stringify(topo));
console.log(`Wrote ${OUT} (${(JSON.stringify(topo).length / 1024).toFixed(0)} KB); unjoined features: ${unjoined.length}`);
