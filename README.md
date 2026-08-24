# Design Delta

**EPA tells every home-energy designer to use the weather station geographically closest to the house. Geographic proximity is a poor proxy for thermal similarity. This tool measures the difference.**

Live: **https://design-delta.wsool.ai** — no login, no install.

Built for **FortyGuard Hackathon'26** · Track 2, Future Buildings & Energy · solo entry.

---

## The problem

Sizing a US home's heating and cooling starts with one number: the outdoor design temperature. Every route to it — ACCA Manual J for a permit, ANSI/RESNET/ACCA 310 for a rated or tax-credit home, Title 24 in California — takes that number from a weather station chosen to stand in for the house.

EPA's ENERGY STAR guidance is explicit about how to choose:

> "the EPA recommends that designers always use the ACCA Manual J, 8th edition, 1% cooling season design temperature and 99% heating season design temperature for the **weather station that's geographically closest** to the home to be certified."

Closest on a map is not the same as closest in climate. A house can sit a few miles from its nearest station and on the other side of a marine-layer boundary or a thousand feet of elevation.

## What we measured

Hours above 95°F in July 2024 (out of 744), comparing each home's own block against the block containing its geographically-nearest weather station. Both figures come from the same FortyGuard model, so this is an internally consistent comparison.

| Home | Home block | Nearest station block | Difference |
|---|---|---|---|
| Pasadena | 35.2 h | El Monte Airport — 71.6 h | **−36.4 h** |
| Woodland Hills | 124.0 h | Van Nuys Airport — 110.4 h | **+13.6 h** |
| Mar Vista | 0 h | LAX — 0 h | 0 |
| Santa Monica | 0 h | Santa Monica Muni — 0 h | 0 |

The error runs in **both directions inside a single metro**. Pasadena's nearest station reads the hot tail as roughly twice as severe as the home actually experiences; Woodland Hills runs hotter than the station assigned to it.

**Methodological note, because it nearly produced the wrong answer:** the same comparison on *monthly mean* temperature showed a 0.9°F average gap and would have suggested there is no problem at all. Design temperature is a property of the extreme tail, not the mean. All comparisons here use `analytic_type: "exceedance"` at a high threshold.

## The misassignment atlas

How often is the nearest station the wrong one? We tiled three metros with contiguous 100 m FortyGuard reads (July 2024), pooled them into ~1 km cells, and compared every cell's modelled July peak against every real weather station within 40 miles — the same radius Standard 310 uses. Both sides of every comparison come from the same model, so the deltas are internally consistent.

| Metro | Cells | Stations | Nearest station ≥5°F off | Fixable by better station | Median abs err | p90 | Worst cell |
|---|---|---|---|---|---|---|---|
| San Diego | 1,761 | 13 | **26.2%** | 25.3% | 3.1°F | 7.7°F | +17.8°F — La Jolla coast assigned Montgomery Field (KMYF) |
| Los Angeles | 2,677 | 27 | **11.8%** | 11.6% | 1.8°F | 5.8°F | −20.0°F — Topanga assigned Santa Monica (KSMO) |
| Fresno (control) | 861 | 5 | **0%** | — | 0.2°F | 0.9°F | +2.2°F |

The control matters as much as the headline: in Fresno's thermally uniform valley the nearest-station rule works essentially perfectly, so the tool does not cry wolf everywhere. The errors concentrate exactly where physical geography says they should — marine-layer boundaries and terrain — and they run in both directions: in San Diego 14.9% of cells get a station reading too cool (undersizing risk) and 11.4% one reading too hot (oversizing). Nearly every material error disappears when the block is matched to a better station instead.

**Two station sets, deliberately.** "Nearest" is drawn from every real station with modelled data; "best match" only from the 42 stations verified against NOAA, because the tool should not recommend one it never checked. The choice matters and is reported rather than buried: restricting *nearest* to verified stations only would raise Los Angeles from 11.8% to 20.1%, because dropping candidates pushes the nearest station farther away. The lower, wider-set number is the one published. San Diego is 25.8% either way.

An earlier version of this table sampled 0.04° chunks every 0.1° — about 16% of each metro's area — and reported 24.9% / 9.5% / 0%. Contiguous coverage supersedes it; the sparse grid happened to under-sample the complex terrain where the errors live.

**External validation** ([data/atlas/validation.json](data/atlas/validation.json)): the modelled July-2024 peak at 42 station blocks was checked against NOAA's measured hourly maximum at those same stations. Median absolute difference 4.2°F, correlation r = 0.969 — the model preserves the cross-station *ordering* the similarity matching depends on. Its one systematic bias compresses the coastal-inland gradient (coastal stations read ~4°F warm, hot-interior stations ~3°F cool), which means the misassignment rates above are **understated**, not inflated.

**Does the answer depend on where the 5°F bar sits?** It is a practitioner rule of thumb, not a figure any standard publishes, and one constant produces every percentage above — so here is the whole curve.

| Bar | San Diego | Los Angeles | Fresno |
|---|---|---|---|
| 3°F | 51.5% | 28.8% | 0% |
| 4°F | 39.5% | 19.1% | 0% |
| **5°F** (used) | **26.2%** | **11.8%** | **0%** |
| 6°F | 18.5% | 9.5% | 0% |
| 8°F | 9.1% | 4.7% | 0% |
| 10°F | 4.8% | 1.7% | 0% |

San Diego stays substantial down to a strict 10°F bar, and the Fresno control stays at exactly zero at every one of them.

### Reproducing the atlas

Needs a FortyGuard key in `.env` and about 350 API calls. Stages cache to `.tmp/atlas/raw/`, so a re-run resumes rather than refetching.

```bash
mkdir -p .tmp
curl -o .tmp/isd.csv https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv   # NOAA station list, not vendored

node --env-file=.env tools/atlas/run.mjs all      # station blocks + sampled chunks
node tools/atlas/build.mjs                        # station peaks -> data/atlas/{metro}.json
node tools/atlas/validate.mjs                     # NOAA check -> validation.json

node --env-file=.env tools/atlas/cover.mjs all    # contiguous coverage, 104 reads
node --env-file=.env tools/atlas/ceiling.mjs      # hours above each county ceiling
node tools/atlas/build-full.mjs                   # the published numbers -> summary_full.json
node tools/atlas/freeze.mjs                       # the static cache the demo serves
```

`build.mjs` still writes the superseded sampled-grid table to `summary.json`; the site and this README read `summary_full.json`, which `build-full.mjs` writes.

## What this is not

- **Not a Manual J calculation** and not a substitute for one.
- **Not a claim that any code or standard is being violated.** Standard 310's Appendix A county value is a grading cap, not a mandated design input — by the standard's own text it exists "to support consistency in energy rating and labeling."
- **Not measurement.** FortyGuard publishes model output from its Large Temperature Models. Every block figure here is a modelled estimate, not a thermometer reading.

Substituting a better-matched station is a decision for a licensed professional and the local building authority.

## How it works

1. **Geocode** — US Census Geocoder turns an address into coordinates and a county. Free, keyless, no expiry.
2. **County reference** — `data/resnet_appendix_a_ca.json`, all 58 California counties extracted from the official [ANSI/RESNET/ACCA 310-2020 PDF](https://www.resnet.us/wp-content/uploads/ANSIRESNETACCA_310-2020_v7.1.pdf), Appendix A.
3. **Block model** — FortyGuard `/v1/heatmap` over a small AOI around the address, at 100 m tiles.
4. **Compare** — the block against the stations that could be assigned to it.

## FortyGuard API — a real request and response

```bash
curl -X POST "https://api.fortyguard.com/v1/heatmap" \
  -H "api-key: $FORTYGUARD_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "polygon_aoi": {"type":"FeatureCollection","features":[{"type":"Feature","properties":{},
      "geometry":{"type":"Polygon","coordinates":[[[-117.27,32.83],[-117.25,32.83],
                   [-117.25,32.85],[-117.27,32.85],[-117.27,32.83]]]}}]},
    "date_time": {"filter_type": 4, "start_date": "2024-07-01", "end_date": "2024-07-31",
                  "start_time": "00:00", "end_time": "23:00"},
    "granularity": 100, "analytic_type": "exceedance",
    "threshold": 40.56, "direction": "above"
  }'
```
```json
{"error":false,"status_code":200,"message":"Heatmap Submitted Successfully",
 "data":{"activity_id":"2f382eb1-69f1-44af-8a44-c55e75d206c6"}}
```
Then `GET /v1/status/2f382eb1-69f1-44af-8a44-c55e75d206c6`:
```json
{"data":{"status":"Completed","result":{"stats_data":{
  "analytic_type":"exceedance","units":"hour","n_cells":414,
  "min":0.0,"max":0.0,"mean":0.0}}}}
```

Notes learned the hard way, in case they help another participant:
- `filter_type` belongs **inside** `date_time`; `threshold` and `direction` are **top-level**.
- `start_time` is **local** time at the AOI, not UTC.
- Date ranges longer than about a month return `Internal Server Error` — chunk monthly.
- `filter_type: 4` returns min/avg/max **aggregated over the range**, not an hourly series.
- Failed tasks cost no credits.

## Running locally

```bash
npm install
echo "FORTYGUARD_API_KEY=your_key_here" > .env.local
npm run dev
```

The app reads `data/block_cache.json` **first** and only calls the live API for an address that was never precomputed. This is deliberate: participant API access ends 30 August while judging runs to 14 September, so the deployed demo answers entirely from static data with no key present. The cache holds 5,300 cells — every ~1 km cell of Los Angeles, San Diego and Fresno, each with its modelled July peak and its hours above that county's ceiling — so those addresses resolve instantly and permanently. Addresses outside those metros say so plainly rather than failing.

Verify the frozen path yourself by running without a key:

```bash
npm run build && npm start          # no .env, no FORTYGUARD_API_KEY
curl "localhost:3000/api/lookup?address=120+S+Topanga+Canyon+Blvd,+Topanga,+CA+90290"
```

## Status

Working: address lookup, county reference for California, live FortyGuard reads with cache fallback, the exceedance comparison, the three-metro misassignment atlas with NOAA validation (`data/atlas/`), the station recommendation ("Use KNRS, not KNKX" — nearest verified station vs best thermal match within 40 miles), and the equipment-impact panel (an openly-stated 2,000 ft² archetype, ACCA-style sensible load at both temperatures, half-ton equipment steps).

Next: freeze and precache everything so the demo answers across all three metros after API access ends. See `PLAN.md`.

## Credits

FortyGuard Temperature API · US Census Bureau Geocoder · NOAA NCEI Local Climatological Data · ANSI/RESNET/ACCA 310-2020.

Repository created 20 August 2026, after the 18 August kickoff. Built with AI assistance (Claude Code); all API integration, data extraction and analysis verified against primary sources and live API responses.

Visual identity shared with [Wsool](https://wsool.ai).
