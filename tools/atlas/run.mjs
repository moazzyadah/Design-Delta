// Fetch stage of the misassignment atlas. Resumable: each job caches to
// .tmp/atlas/raw/<jobId>.json and is skipped on rerun.
//
//   node --env-file=.env tools/atlas/run.mjs <metro|all> [maxJobs]
import fs from "node:fs";
import path from "node:path";
import {
  METROS, WINDOW, THRESH_C, CHUNK_HALF, STATION_HALF, RAW_DIR, ASSIGNABLE_KM,
  chunkCenters, loadStations, boxAround, submitAndPoll, compactTiles, km,
} from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const which = process.argv[2] ?? "all";
const maxJobs = Number(process.argv[3] ?? Infinity);
const CONCURRENCY = 4;

fs.mkdirSync(RAW_DIR, { recursive: true });

function jobsFor(slug) {
  const metro = METROS[slug];
  const jobs = [];
  const add = (kind, ref, lat, lon, half) => {
    for (const analytic of ["tcm", "exceedance"]) {
      jobs.push({
        id: `${slug}_${kind}_${ref}_${analytic}`,
        slug, kind, ref, lat, lon, half, analytic,
      });
    }
  };
  const chunks = chunkCenters(metro);
  for (const c of chunks)
    add("chunk", `${c.lat}_${c.lon}`, c.lat, c.lon, CHUNK_HALF);
  const reachable = loadStations(metro.box).filter((s) =>
    chunks.some((c) => km(c.lat, c.lon, s.lat, s.lon) <= ASSIGNABLE_KM + 5)
  );
  for (const s of reachable)
    add("station", s.id, s.lat, s.lon, STATION_HALF);
  return jobs;
}

const slugs = which === "all" ? Object.keys(METROS) : [which];
let jobs = slugs.flatMap(jobsFor);
const total = jobs.length;
jobs = jobs.filter((j) => !fs.existsSync(path.join(RAW_DIR, `${j.id}.json`)));
jobs = jobs.slice(0, maxJobs);
console.log(`${total} jobs total, ${jobs.length} to run`);

let done = 0, failed = 0;

async function runJob(j) {
  const body = {
    polygon_aoi: boxAround(j.lat, j.lon, j.half),
    date_time: WINDOW,
    granularity: 100,
    analytic_type: j.analytic,
    ...(j.analytic === "exceedance"
      ? { threshold: THRESH_C, direction: "above" }
      : {}),
  };
  const { id, result } = await submitAndPoll(body, key);
  const prop = j.analytic === "tcm" ? "max_temperature" : "value";
  const out = {
    job: j,
    activity_id: id,
    stats: result.stats_data ?? null,
    tiles: compactTiles(result.map_data, prop),
  };
  fs.writeFileSync(path.join(RAW_DIR, `${j.id}.json`), JSON.stringify(out));
}

async function worker() {
  while (jobs.length) {
    const j = jobs.shift();
    try {
      await runJob(j);
      done++;
      console.log(`ok   ${j.id}  (${done} done, ${failed} failed, ${jobs.length} left)`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.id}: ${e.message}`);
      fs.appendFileSync(
        path.join(RAW_DIR, "_failures.log"),
        `${j.id}\t${e.message}\n`
      );
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`finished: ${done} ok, ${failed} failed`);
