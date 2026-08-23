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
- Headline (recomputed 23 Aug on contiguous coverage, `build-full.mjs`): **San Diego 26.2%** of cells ≥5°F off with the nearest station, **LA 11.8%**, **Fresno 0%** — the control that keeps the claim honest. Supersedes the sampled-grid 24.9/9.5/0.
- Worst cases: Topanga −20.0°F (assigned Santa Monica → undersizing), La Jolla coast +17.8°F (assigned Montgomery Field → oversizing).
- ⚠️ **Station-set sensitivity, published openly.** Restricting *nearest* to NOAA-verified stations only would raise LA to 20.1%; dropping candidates pushes the nearest station farther away and inflates the error. The wider, lower number is the one published. SD is 25.8% either way.
- External validation vs NOAA at 42 stations: median |Δ| 4.2°F, r = 0.969; the model compresses the coast-inland gradient, so atlas rates are conservative.
- **Checkpoint ruling: full claim stands.** 26.2% ≫ the 5% narrowing trigger. No pitch narrowing needed.

## Days 4–5 · Close the loop to equipment — ✅ DONE 21 Aug

`lib/equipment.ts` + panel in the lookup results. One archetype (2,000 ft², R-13/R-38, 15% glazing, 0.5 ACH, every assumption printed on screen), ACCA-style sensible load at the nearest station's temp vs the block's, half-ton equipment steps. Verified live: Topanga = 1.5 vs 2.5 tons (undersized), La Jolla = 2.0 vs 1.5 (oversized), Fresno = aligned. Deliberately fed by **station-vs-block**, never ceiling-vs-block — the cap framing is dead.

## Day 6 · Output a decision, not a map — ✅ DONE 21 Aug (peak-match version)

Shipped in the lookup UI: "Use KNRS, not KNKX" — nearest verified station vs best thermal match within 40 miles, both with their modelled July peaks and errors. Candidates are restricted to the 42 NOAA-validated stations (`lib/stations.ts`). In-app matching is 1-D on modelled July peak (works from live or cached reads alike); the atlas's richer 2-feature matching stays the atlas methodology. The atlas map is now surfaced on the page — see Day 7.

## Day 7 · Freeze — in progress 23 Aug

- [x] `tools/atlas/ceiling.mjs` — 49 extra reads giving hours above each metro's **own county ceiling** (LA 102°F, SD 105°F, Fresno 104°F). The atlas's 95°F tail threshold is the right statistic for station matching but is not the number the app reports, so it could not be reused.
- [x] `tools/atlas/freeze.mjs` — collapses every read into one `data/block_cache.json` covering all three metros on a ~1 km grid.
- [x] API route is now **cache-first, live-second**: the demo answers with no key at all, and a live call only ever fills an address never precomputed. A cached hour count is suppressed rather than shown if the address's county ceiling differs from the one it was counted against.
- [x] `tools/atlas/cover.mjs` — the atlas sampled 0.04° chunks every 0.1°, covering only ~16% of each metro. Testing with the key removed exposed it: a downtown Fresno address returned "unavailable". 104 contiguous 0.1° reads now tile all three metro boxes with no gaps → **5,300 cached cells**, 143 KB.
- [x] Live path corrected to match the cache: block peak is the **median** tile, not the max. Station blocks in `data/atlas` are medians, so the old live max compared a block's hot spot against a station's typical tile.
- [x] Out-of-coverage addresses say so plainly and point at the three metros.
- [x] Verified with `FORTYGUARD_API_KEY=` empty: La Jolla, Borrego, Topanga, Fresno, downtown LA and the Getty all answer from cache; a non-California address returns a clean message.
- [x] Atlas published on the site: `app/atlas-map.tsx` replaces the old county-ceiling evidence chapter. Two SVG panels (San Diego speckled, Fresno entirely clean) plus the three-metro table and the NOAA validation line. Diverging palette #2E93B5 / #D9762A validated against the dark surface with the dataviz validator — CVD ΔE 18.2 protan, 25.6 normal, both inside the dark lightness band. Station tags hidden under 720px.
- [ ] Verify in incognito on a phone.

## Days 8–9 · Submit

- 3-minute video, opening on the EPA "geographically closest" quote, then the Pasadena table.
- Add **hackathon@fortyguard.com** as a repository collaborator.
- Submit at https://forms.gle/jLgBzVTG1NhJ3gNe6 — primary track **Future Buildings & Energy**. Submit early; resubmit if anything improves.
- Confirm the deployed demo answers with the key removed.

## Owner actions

- [x] Repo is **public** with an MIT LICENSE (done 23 Aug). Original decision: make `github.com/moazzyadah/Design-Delta` **public** instead of adding a collaborator (Settings → Danger Zone → Change visibility). Confirmed clean of secrets before this was suggested. If it stays private instead, add `hackathon@fortyguard.com` as a collaborator before submitting.
- [ ] Demo video (max 3 min, YouTube/Loom unlisted) — deferred to after 24 Aug (Monday). Script: open on the EPA "geographically closest" quote, then the misassignment atlas map + table (SD 26.2%), then show the lookup tool live going through La Jolla/Borrego/Topanga, close on the equipment-tons consequence.
- [ ] Optional: a free Supabase project (URL + anon key) if saved reports are wanted. Not a blocker.
- [ ] Submission form: everything except the collaborator question and the video link is drafted (see chat 21 Aug) — title, pitch, tracks, audience, coverage, API usage, AI-tools disclosure, API key (in `.env`), repo link, live demo link (verified working, no-login).
