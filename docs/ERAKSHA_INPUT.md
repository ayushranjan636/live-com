# What we need from eRaksha

The display shows nothing about eRaksha that isn't backed by evidence. Please fill in `data/eraksha/eraksha.json` (or send the documents) with the following.

1. **What eRaksha does.** A one- or two-sentence description from your own published material, plus the source (website or deck, with date). Example of the level of detail needed: who it serves (age group), what it does (e.g. content filtering, reporting, counselling referral), and on which platforms.
2. **Where it operates now.** For each country: `status: "active"`, `start` (YYYY-MM), and `scope`, i.e. exactly what is covered ("national app availability", "pilot in 40 schools in Pune"). A country is shaded if *any* verified service exists there, and the scope text is shown on tap.
3. **Users or children reached** (optional). The number, its exact definition (registered accounts? monthly active? children covered by a school licence?), the date, and the source.
4. **Planned launches.** For each country: `status: "planned"`, planned date, and the document where the plan is stated (board-approved plan, MoU, public announcement). These are always shown hatched and labelled as planned, never as active.
5. **Expansion targets.** If they exist, give the source. They will be shown as labelled scenarios.
6. **Outcome evidence** (only if it exists). Study report: outcome measured, population, design (RCT, pre/post…), comparison group, effect size and its definition, follow-up period. Without this, no health-benefit figures are shown.

Example entry:

```json
{
  "country_iso3": "IND",
  "status": "active",
  "scope": "Android app available nationally",
  "start": "2025-03",
  "users_reached": null,
  "users_reached_definition": null,
  "evidence": "eRaksha launch press release, 2025-03-12",
  "as_of": "2026-10-01"
}
```

Then set `last_reviewed` and `reviewed_by`, run `npm test` (which validates the file) and `npm run booth`.
