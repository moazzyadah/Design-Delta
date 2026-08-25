// Extend the atlas from one month to the full 2024 cooling season.
//
// The strongest objection to the published numbers is that a design temperature
// is a seasonal statistic and we measured July. The API caps a range at one
// month — two months returns Internal Server Error — so a season costs six
// calls per AOI rather than one.
//
// Ordered hottest month first and San Diego first, deliberately: participant
// API access ends 30 August, and if credits or time run out mid-run the data
// already on disk should be the data that matters most. July is not refetched;
// the contiguous coverage from cover.mjs is the same AOI and analytic.
//
//   node --env-file=.env tools/atlas/season.mjs [metro|all]
import fs from "node:fs";
import path from "node:path";
import {
  METROS, RAW_DIR, chunkCenters, boxAround, submitAndPoll, compactTiles,
} from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const COVER_HALF = 0.05;   // matches cover.mjs, so July can be reused
const STATION_HALF = 0.01; // matches run.mjs
// The API degraded sharply as the deadline approached: reads that completed in
// 48 s on 23 August were still queueing after 7 minutes on 25 August, almost
// certainly other participants fetching at once. More requests in flight and a
// much longer poll budget, because the tasks do finish — they just wait.
const CONCURRENCY = 6;
const POLL_BUDGET_MS = 1_200_000;

// August then September. July is already on disk under the _full_ name, so this
// buys a three-month peak-season window. May, June and October were dropped
// once the API slowed: they contribute almost nothing to the top of a
// California temperature distribution, and at the observed rate six months
// would have run fourteen hours against a key that expires 30 August.
const MONTHS = [
  ["2024-08-01", "2024-08-31", "202408"],
  ["2024-09-01", "2024-09-30", "202409"],
];

const ORDER = ["sd", "la", "fresno"]; // headline metro first
const which = process.argv[2] ?? "all";
const slugs = which === "all" ? ORDER : [which];

const jobs = [];
for (const [start, end, tag] of MONTHS) {
  for (const slug of slugs) {
    for (const c of chunkCenters(METROS[slug])) {
      jobs.push({
        id: `${slug}_season_${c.lat}_${c.lon}_${tag}`,
        lat: c.lat, lon: c.lon, half: COVER_HALF, start, end,
      });
    }
    const stations = JSON.parse(
      fs.readFileSync(`data/atlas/${slug}.json`, "utf8")
    ).stations;
    for (const s of stations) {
      jobs.push({
        id: `${slug}_seasonstn_${s.id}_${tag}`,
        lat: s.lat, lon: s.lon, half: STATION_HALF, start, end,
      });
    }
  }
}

const todo = jobs.filter((j) => !fs.existsSync(path.join(RAW_DIR, `${j.id}.json`)));
console.log(`${jobs.length} season jobs, ${todo.length} to run`);

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
            start_date: j.start,
            end_date: j.end,
            start_time: "00:00",
            end_time: "23:00",
          },
          granularity: 100,
          analytic_type: "tcm",
        },
        key,
        POLL_BUDGET_MS
      );
      fs.writeFileSync(
        path.join(RAW_DIR, `${j.id}.json`),
        JSON.stringify({
          job: j, activity_id: id,
          tiles: compactTiles(result.map_data, "max_temperature"),
        })
      );
      done++;
      const mins = (Date.now() - started) / 60000;
      const rate = done / mins;
      console.log(
        `ok   ${j.id}  (${done} done, ${failed} failed, ${todo.length} left, ` +
        `${rate.toFixed(1)}/min, ~${Math.round(todo.length / rate)}min remaining)`
      );
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.id}: ${e.message}`);
      fs.appendFileSync(
        path.join(RAW_DIR, "_season_failures.log"),
        `${j.id}\t${e.message}\n`
      );
      // A run of failures usually means credits are gone, not a bad AOI.
      if (failed >= 12 && failed > done) {
        console.log("!! too many consecutive failures — stopping");
        todo.length = 0;
      }
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`finished: ${done} ok, ${failed} failed`);
