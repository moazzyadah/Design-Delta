// Day-7 freeze, part 1: hours above each metro's own county ceiling, so the
// cached demo can answer the ceiling question after API access ends 30 Aug.
// The atlas itself used a fixed 95°F tail threshold; the app reports hours
// above the county cap, which differs per county.
//
//   node --env-file=.env tools/atlas/ceiling.mjs
import fs from "node:fs";
import path from "node:path";
import {
  METROS, WINDOW, CHUNK_HALF, RAW_DIR, CEILING_F,
  chunkCenters, boxAround, submitAndPoll, compactTiles,
} from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const f2c = (f) => ((f - 32) * 5) / 9;

const jobs = [];
for (const [slug, metro] of Object.entries(METROS))
  for (const c of chunkCenters(metro))
    jobs.push({ id: `${slug}_ceil_${c.lat}_${c.lon}`, slug, ...c });

const todo = jobs.filter((j) => !fs.existsSync(path.join(RAW_DIR, `${j.id}.json`)));
console.log(`${jobs.length} ceiling jobs, ${todo.length} to run`);

let done = 0, failed = 0;
async function worker() {
  while (todo.length) {
    const j = todo.shift();
    try {
      const { id, result } = await submitAndPoll(
        {
          polygon_aoi: boxAround(j.lat, j.lon, CHUNK_HALF),
          date_time: WINDOW,
          granularity: 100,
          analytic_type: "exceedance",
          threshold: Number(f2c(CEILING_F[j.slug]).toFixed(2)),
          direction: "above",
        },
        key
      );
      fs.writeFileSync(
        path.join(RAW_DIR, `${j.id}.json`),
        JSON.stringify({
          job: j, activity_id: id, ceilingF: CEILING_F[j.slug],
          stats: result.stats_data ?? null,
          tiles: compactTiles(result.map_data, "value"),
        })
      );
      done++;
      console.log(`ok   ${j.id} (${done} done, ${todo.length} left)`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`finished: ${done} ok, ${failed} failed`);
