// Compute the quantity designers actually use: the 1% cooling design
// temperature — the dry-bulb exceeded about 88 hours a year.
//
// Why this exists. The atlas has been reporting a window maximum: the single
// hottest modelled hour in a window. July alone gave San Diego 26.2%
// misassigned; July–September gave 12.7%. Both are defensible-looking and both
// are wrong for the purpose, because a window maximum is one hour in thousands
// and moves with whatever heat event happened to land inside the window. The
// September 2024 regional heat wave lifted coastal blocks 13.5°F and inland
// blocks 8.2°F, collapsing exactly the spatial contrast the tool measures.
//
// The 1% value is the ~88th hottest hour of the year. One heat event cannot
// move it, which is precisely why the standards use it.
//
// Method: `exceedance` returns hours above a threshold. Run a ladder of
// thresholds over July–September, sum the hours per cell, and interpolate to
// find the threshold where the count crosses 88. Thresholds are chosen per
// chunk from that chunk's own season maximum, so a coastal chunk and a desert
// chunk each get a ladder that brackets their own crossing.
//
//   node --env-file=.env tools/atlas/ladder.mjs [metro]
import fs from "node:fs";
import path from "node:path";
import {
  METROS, RAW_DIR, chunkCenters, boxAround, submitAndPoll, compactTiles, c2f, km,
} from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const slug = process.argv[2] ?? "sd";
const COVER_HALF = 0.05;
const STATION_HALF = 0.01;
const CONCURRENCY = 6;
const POLL_BUDGET_MS = 1_200_000;

const MONTHS = [
  ["2024-07-01", "2024-07-31", "202407"],
  ["2024-08-01", "2024-08-31", "202408"],
  ["2024-09-01", "2024-09-30", "202409"],
];

// Offsets below a location's own season maximum. Wide enough to bracket the
// 88-hour crossing without wasting a rung: in California the 1% value sits
// roughly 6–16°F under the season peak.
const OFFSETS_F = [-6, -11, -16];
const f2c = (f) => ((f - 32) * 5) / 9;

const season = JSON.parse(fs.readFileSync(`data/atlas/${slug}_season.json`, "utf8"));
const cells = season.cells;

/** Season maximum near a point, from the cells already built. */
function localMax(lat, lon) {
  let best = null, bestD = Infinity;
  for (const c of cells) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best?.maxF ?? null;
}

const jobs = [];
for (const c of chunkCenters(METROS[slug])) {
  const base = localMax(c.lat, c.lon);
  if (base === null) continue;
  for (const off of OFFSETS_F) {
    const tF = Math.round(base + off);
    for (const [start, end, tag] of MONTHS) {
      jobs.push({
        id: `${slug}_ladder_${c.lat}_${c.lon}_${tF}_${tag}`,
        lat: c.lat, lon: c.lon, half: COVER_HALF, tF, start, end,
      });
    }
  }
}
for (const s of season.stations) {
  for (const off of OFFSETS_F) {
    const tF = Math.round(s.maxF + off);
    for (const [start, end, tag] of MONTHS) {
      jobs.push({
        id: `${slug}_ladderstn_${s.id}_${tF}_${tag}`,
        lat: s.lat, lon: s.lon, half: STATION_HALF, tF, start, end,
      });
    }
  }
}

const todo = jobs.filter((j) => !fs.existsSync(path.join(RAW_DIR, `${j.id}.json`)));
console.log(`${jobs.length} ladder jobs for ${slug}, ${todo.length} to run`);

let done = 0, failed = 0;
const started = Date.now();

async function worker() {
  while (todo.length) {
    const j = todo.shift();
    try {
      const { id, result } = await submitAndPoll(
        {
          polygon_aoi: boxAround(j.lat, j.lon, j.half),
          date_time: {
            filter_type: 4,
            start_date: j.start, end_date: j.end,
            start_time: "00:00", end_time: "23:00",
          },
          granularity: 100,
          analytic_type: "exceedance",
          threshold: Number(f2c(j.tF).toFixed(2)),
          direction: "above",
        },
        key,
        POLL_BUDGET_MS
      );
      fs.writeFileSync(
        path.join(RAW_DIR, `${j.id}.json`),
        JSON.stringify({
          job: j, activity_id: id, thresholdF: j.tF,
          tiles: compactTiles(result.map_data, "value"),
        })
      );
      done++;
      const rate = done / ((Date.now() - started) / 60000);
      console.log(
        `ok   ${j.id}  (${done} done, ${failed} failed, ${todo.length} left, ` +
        `${rate.toFixed(1)}/min, ~${Math.round(todo.length / rate)}min remaining)`
      );
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.id}: ${e.message}`);
      if (failed >= 15 && failed > done) {
        console.log("!! too many failures — stopping");
        todo.length = 0;
      }
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`finished: ${done} ok, ${failed} failed`);
