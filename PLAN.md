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

## Days 1–3 · The misassignment atlas

The Impact number the pitch currently lacks.

- Pick 3 metros: Los Angeles, San Diego, and one inland control (Sacramento or Fresno).
- For each: grid the metro, pull FortyGuard exceedance per cell, pull candidate NOAA stations.
- For every cell compute: geographically-nearest station vs thermally-most-similar station (hourly-profile correlation, or exceedance-hours distance).
- Output: **% of cells where the two disagree**, the distribution of implied design-temperature error, and the worst case.
- **Checkpoint, end of Day 3.** If disagreement is rare (<5% of cells, errors <3°F), narrow the pitch honestly to boundary-zone homes rather than inflating it. Degraded but still shippable.

## Days 4–5 · Close the loop to equipment

Kills the "no demonstrated outcome" objection.

- One archetype home (floor area, envelope, glazing, orientation — stated openly).
- Simplified ACCA-style sensible load at both design temperatures.
- Show the equipment consequence: tonnage, cost delta, and the short-cycling/humidity story when oversized.
- One panel. Every assumption printed on screen.

## Day 6 · Output a decision, not a map

`Use KBUR, not KLAX — hourly-profile correlation 0.94 vs 0.71. You are on the inland side of the marine-layer boundary.`

Show the similarity method in the UI; that is where the Technical Execution points are.

## Day 7 · Freeze

- Precompute every tile, station record and similarity score into static JSON.
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
