// Day-7 freeze, part 1b: contiguous coverage of all three metros.
//
// The atlas sampled 0.04° chunks every 0.1°, which is fine for a statistic but
// leaves ~84% of each metro with no cached block. These chunks are 0.1° wide on
// the same 0.1° spacing, so they tile the metro boxes with no gaps — every
// address inside them resolves from static data once the API key expires.
//
//   node --env-file=.env tools/atlas/cover.mjs [metro|all]
import fs from "node:fs";
import path from "node:path";
import {
  METROS, WINDOW, THRESH_C, CEILING_F, RAW_DIR,
  chunkCenters, boxAround, submitAndPoll, compactTiles,
} from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const COVER_HALF = 0.05; // half of the 0.1° chunk spacing → contiguous
const f2c = (f) => ((f - 32) * 5) / 9;
const which = process.argv[2] ?? "all";
const slugs = which === "all" ? Object.keys(METROS) : [which];

const jobs = [];
for (const slug of slugs)
  for (const c of chunkCenters(METROS[slug]))
    for (const analytic of ["tcm", "ceil"])
      jobs.push({ id: `${slug}_full_${c.lat}_${c.lon}_${analytic}`, slug, analytic, ...c });

const todo = jobs.filter((j) => !fs.existsSync(path.join(RAW_DIR, `${j.id}.json`)));
console.log(`${jobs.length} coverage jobs, ${todo.length} to run`);

let done = 0, failed = 0;
async function worker() {
  while (todo.length) {
    const j = todo.shift();
    const body = {
      polygon_aoi: boxAround(j.lat, j.lon, COVER_HALF),
      date_time: WINDOW,
      granularity: 100,
      ...(j.analytic === "tcm"
        ? { analytic_type: "tcm" }
        : {
            analytic_type: "exceedance",
            threshold: Number(f2c(CEILING_F[j.slug]).toFixed(2)),
            direction: "above",
          }),
    };
    try {
      const { id, result } = await submitAndPoll(body, key, 420000);
      fs.writeFileSync(
        path.join(RAW_DIR, `${j.id}.json`),
        JSON.stringify({
          job: j, activity_id: id,
          ceilingF: j.analytic === "ceil" ? CEILING_F[j.slug] : null,
          tiles: compactTiles(
            result.map_data,
            j.analytic === "tcm" ? "max_temperature" : "value"
          ),
        })
      );
      done++;
      console.log(`ok   ${j.id} (${done} done, ${failed} failed, ${todo.length} left)`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.id}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`finished: ${done} ok, ${failed} failed`);
