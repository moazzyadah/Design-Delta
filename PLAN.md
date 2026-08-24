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

## Day 8 · Independent audit — ✅ DONE 24 Aug

Six independent reviewers (statistician, engineer, FortyGuard platform, building-science practitioner, hostile judge, product strategist), a planner, and a skeptic whose only job was to attack the plan. 36 findings. Fixed in commit e9e3f91:

- **Out-of-state addresses were answered rather than rejected.** `1 Front St, Brooklyn NY` returned `Kings County, CA, ceiling 102°F, station Corcoran California` and the note called it exact. County names repeat across states — Kings, Orange, Lake, Nevada, Sierra, Humboldt, Butte, Trinity. Guard on state first. This was the one defect that survived key expiry and asserted a false number as authoritative.
- **The app and the atlas computed "nearest station" from different pools**, so downtown LA showed a material verdict from a station 16 km away while KCQT sat 5 km away and 0.9°F off. 245 cells carried a false material flag. Same pool now; recommendations stay verified-only.
- **The recommendation had no distance term** and drifted to the 40-mile edge. Near-equal matches now break on distance; a match that cannot clear the 5°F bar is reported as no match instead of being sold as a fix.
- **Equipment returns null below the 75°F setpoint** — La Jolla's peak is 74.1°F, so its tonnage was entirely our assumed solar gain, not the station gap.
- **Demo addresses replaced.** Borrego returned null for both flagship panels; La Jolla sat below setpoint. Now Topanga (undersizing), Del Mar (oversizing), downtown LA (rule works).
- **Sensitivity curve published.** SD 51.5/39.5/26.2/18.5/9.1/4.8% at 3/4/5/6/8/10°F; Fresno holds at **0% at every bar**.
- **420,135 HERS-rated homes sourced** to RESNET's 2026 trends report; "governs" dropped from copy about a voluntary standard.

### Deliberately NOT done, with reasons

- **Equipment-panel rewrite (planner ranked #5, 4 h).** The skeptic implemented the spec and it returned null on 53.3% of material cells — worse than the 34.1% self-contradiction it was meant to fix, and it would have broken the panel the video opens on. Left alone except the setpoint guard.
- **Out-of-sample holdout refetch (5 h).** Real circularity in the "fixable" column, but it damages one column, not the headline, and it is 5 h of API work against a hard 30 Aug expiry. Relabelled as in-sample instead.
- **New FortyGuard endpoints** (env_params, satellite/street-view segmentation, persistence, time_of_measure). All would deepen Technical Execution, all land in video week. A half-wired endpoint scores worse than one honest sentence explaining why only /v1/heatmap was used.
- **ACS population weighting, 1%-design-temp calibration, raw-archive commit.** Each replaces every published number days before recording.

## Video — ✅ first cut built 24 Aug

`tools/video/` — three scripts, fully reproducible: `record.py` drives the live
site with Playwright and captures one clip per shot; `captions.py` renders every
caption and title card as a transparent PNG using the site's own typography;
`compose.py` burns them in and crossfades the joins.

**No voiceover, by design.** The organisers require the product shown working, so
the base layer is real footage, never slides. Captions carry the argument — they
read faster than narration for an international panel and remove any accent risk.

Output: `.tmp/video/design-delta-demo.mp4`, 2:02, 1600×900, 8 MB. Under the
3-minute cap with room to extend a hold if needed.

Deliberate choices: La Jolla never appears (its block peak is below the model's
indoor setpoint); the county-cap verdict was demoted out of the result cards
before recording, so the first thing on screen is the station question.

## Days 8–9 · Submit

- 3-minute video. **Record it twice**: a first cut against today's working build immediately, submit the form with it, then re-record only if later work lands. The form accepts resubmissions and the latest counts, so this makes "no video at the deadline" impossible. Open on the EPA "geographically closest" quote, then the San Diego atlas map, then Topanga in the live tool. Do NOT open on La Jolla — its block peak is below the indoor setpoint.
- Add **hackathon@fortyguard.com** as a repository collaborator.
- Submit at https://forms.gle/jLgBzVTG1NhJ3gNe6 — primary track **Future Buildings & Energy**. Submit early; resubmit if anything improves.
- Confirm the deployed demo answers with the key removed.

## Owner actions

- [x] Repo is **public** with an MIT LICENSE (done 23 Aug). Original decision: make `github.com/moazzyadah/Design-Delta` **public** instead of adding a collaborator (Settings → Danger Zone → Change visibility). Confirmed clean of secrets before this was suggested. If it stays private instead, add `hackathon@fortyguard.com` as a collaborator before submitting.
- [ ] Demo video (max 3 min, YouTube/Loom unlisted) — deferred to after 24 Aug (Monday). Script: open on the EPA "geographically closest" quote, then the misassignment atlas map + table (SD 26.2%), then show the lookup tool live going through La Jolla/Borrego/Topanga, close on the equipment-tons consequence.
- [ ] Optional: a free Supabase project (URL + anon key) if saved reports are wanted. Not a blocker.
- [ ] Submission form: everything except the collaborator question and the video link is drafted (see chat 21 Aug) — title, pitch, tracks, audience, coverage, API usage, AI-tools disclosure, API key (in `.env`), repo link, live demo link (verified working, no-login).
