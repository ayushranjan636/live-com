# live-com

Exhibition display for **eRaksha**, built for India Mobile Congress. Shows the scale of
reported online child sexual exploitation worldwide, where reports come from, and
eRaksha's reach and stated targets.

Runs fully offline: all data and map geometry are bundled into the build, so the booth
needs no network and no figure can appear as a loading placeholder.

## Screens

1. **Live count** — a ticking worldwide figure, split into a *counted* part (published
   NCMEC annual totals, 2020–2025) and a *projected* part (reports since 1 Jan of the
   first unpublished year, at the latest published year's average pace). The two are
   drawn to scale and labelled separately.
2. **World map** — CyberTipline reports by country, on a fixed log-spaced colour scale
   so a colour change between years is a real change in reports.
3. **eRaksha** — families reached today and the stated 3- and 5-year targets, as a
   self-advancing sequence.

## Data integrity

Every figure traces to a row in `data/processed/burden_records.csv`, each carrying its
own `source_url` and `source_locator` (exact table, row and column).

- `scripts/extract_ncmec.py` reads the source PDFs in `data/raw/ncmec/` and **fails**
  unless, for each year, parsed rows plus residuals equal the grand total printed in
  that PDF.
- `scripts/build-data.mjs` joins country names to ISO3 through an explicit table
  (`data/reference/ncmec_country_iso3.json`); there is no fuzzy matching, so an unlisted
  name fails the build.
- A per-second pace may only be derived from a flow measure. Asking for one from a
  prevalence stock throws (`src/lib/methods.ts`).

Reports are a count of *reports*, not of children, and country figures are not a ranking
of danger. See `docs/METHODOLOGY.md` and `docs/DATA_AUDIT.md`.

NCMEC and WHO do not endorse eRaksha.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # vitest
npm run build    # offline bundle into dist/
```

Rebuild the data snapshot (needs the source PDFs in `data/raw/`):

```bash
python3 scripts/extract_ncmec.py
node scripts/build-data.mjs
```

## Tech

React 18, TypeScript, Vite, D3 (`d3-geo` Equal Earth projection), TopoJSON. Map geometry
is Natural Earth 1:10m Admin-0, India point-of-view.
