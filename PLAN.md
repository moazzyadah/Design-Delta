# Design Delta — build plan

Deadline **30 August 2026, 23:59 GST**. Submission form accepts resubmissions; the latest one counts.

## The decision this product changes

A home-energy designer must pick a weather station to source the outdoor design temperature from. EPA tells them to pick the **geographically closest** one. We tell them whether that station is **thermally representative** of the address, and which nearby station is.

Not a compliance claim. Not a Manual J replacement. A representativeness check on a choice that is already required.

## Settled — do not revisit without new evidence

- **Ship this, do not pivot.** Ruled 21 Aug after an adversarial review (Codex, gpt-5.6-sol xhigh) demanded a pivot to mosquito-surveillance ML and an independent arbiter ruled against it: higher ceiling, roughly 20% chance of the predictive lift it depends on, no fallback inside the remaining days.
- **The false premise is dead.** Standard 310's Appendix A county value is a *grading cap*, not a legally mandated design input. It does not arrive through IRC M1401.3, and California uses Title 24 rather than the IRC mechanical chapter. Never reintroduce "legal ceiling", "governing station", "required to use".
- **FortyGuard is a model, not a measurement.** Say "modelled estimate" everywhere.
- **Test the tail, never the mean.** Monthly-mean comparison showed a 0.9°F gap and would have killed the project; the exceedance tail comparison showed −36.4 h in Pasadena. Design temperature is a tail property.
- **No login, ever, in front of the tool.** Organiser requirement: the demo must work in incognito. Accounts, if added, save reports only — never gate the lookup.

## Days 1–3 · The misassignment atlas — ✅ DONE 21 Aug

Built in `tools/atlas/` (run → build → validate), results in `data/atlas/`, method and numbers in README.

- 1,262 one-km cells across LA / San Diego / Fresno (control), 45 candidate NOAA stations, July 2024, 194 FortyGuard reads, zero failures.
- Headline: **San Diego 24.9%** of cells ≥5°F off with the nearest station (23.3% fixable by a better station), **LA 9.5%** (all fixable), **Fresno 0%** — the control that keeps the claim honest.
- Worst cases: Topanga −20.1°F (assigned Santa Monica → undersizing), SD coast +16.1°F (assigned Miramar → oversizing).
- External validation vs NOAA at 42 stations: median |Δ| 4.2°F, r = 0.969; the model compresses the coast-inland gradient, so atlas rates are conservative.
- **Checkpoint ruling: full claim stands.** 24.9% ≫ the 5% narrowing trigger. No pitch narrowing needed.

## Days 4–5 · Close the loop to equipment — ✅ DONE 21 Aug

`lib/equipment.ts` + panel in the lookup results. One archetype (2,000 ft², R-13/R-38, 15% glazing, 0.5 ACH, every assumption printed on screen), ACCA-style sensible load at the nearest station's temp vs the block's, half-ton equipment steps. Verified live: Topanga = 1.5 vs 2.5 tons (undersized), La Jolla = 2.0 vs 1.5 (oversized), Fresno = aligned. Deliberately fed by **station-vs-block**, never ceiling-vs-block — the cap framing is dead.

## Day 6 · Output a decision, not a map — ✅ DONE 21 Aug (peak-match version)

Shipped in the lookup UI: "Use KNRS, not KNKX" — nearest verified station vs best thermal match within 40 miles, both with their modelled July peaks and errors. Candidates are restricted to the 42 NOAA-validated stations (`lib/stations.ts`). In-app matching is 1-D on modelled July peak (works from live or cached reads alike); the atlas's richer 2-feature matching stays the atlas methodology. Optional polish later: surface the atlas map visually.

## Day 7 · Freeze

- Precompute every tile, station record and similarity score into static JSON.
- Seed `block_cache.json` from the 1,262 atlas cells so cache-mode covers all three metros — note the atlas exceedance is at 95°F while the app's is at the county ceiling; cache entries need `hoursAboveCeiling` recomputed or approximated honestly.
- Out-of-coverage addresses redirect gracefully to the three demo metros.
- Verify in incognito, on a phone, with the API key removed from the environment.

## Days 8–9 · Submit

- 3-minute video, opening on the EPA "geographically closest" quote, then the Pasadena table.
- Add **hackathon@fortyguard.com** as a repository collaborator.
- Submit at https://forms.gle/jLgBzVTG1NhJ3gNe6 — primary track **Future Buildings & Energy**. Submit early; resubmit if anything improves.
- Confirm the deployed demo answers with the key removed.

## Owner actions

- [ ] Add `hackathon@fortyguard.com` as a collaborator before submitting (Day 8).
- [ ] Optional: a free Supabase project (URL + anon key) if saved reports are wanted. Not a blocker.
