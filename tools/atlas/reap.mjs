// Recover reads whose poll timed out.
//
// A timed-out poll is not a lost job: the task was accepted, it has an
// activity_id, and it usually finishes server-side minutes later. Re-polling
// costs nothing and spends no credits, whereas resubmitting pays for the same
// work twice — which matters with a key that expires on 30 August.
//
//   node --env-file=.env tools/atlas/reap.mjs [logfile]
import fs from "node:fs";
import path from "node:path";
import { FG, RAW_DIR, compactTiles } from "./lib.mjs";

const key = process.env.FORTYGUARD_API_KEY;
if (!key) throw new Error("FORTYGUARD_API_KEY missing");

const logfile = process.argv[2] ?? ".tmp/atlas/season.log";
const log = fs.readFileSync(logfile, "utf8");

const orphans = new Map();
for (const line of log.split("\n")) {
  const m = line.match(/^FAIL (\S+): task ([0-9a-f-]{36}) still processing/);
  if (m && !fs.existsSync(path.join(RAW_DIR, `${m[1]}.json`))) orphans.set(m[1], m[2]);
}
console.log(`${orphans.size} timed-out tasks to re-poll`);

let saved = 0, pending = 0, dead = 0;
for (const [jobId, activityId] of orphans) {
  try {
    const res = await fetch(`${FG}/status/${activityId}`, {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(30000),
    });
    const j = await res.json();
    const status = j?.data?.status;

    if (status === "Completed") {
      const prop = jobId.includes("_ceil_") ? "value" : "max_temperature";
      fs.writeFileSync(
        path.join(RAW_DIR, `${jobId}.json`),
        JSON.stringify({
          job: { id: jobId, recovered: true },
          activity_id: activityId,
          tiles: compactTiles(j.data.result.map_data, prop),
        })
      );
      saved++;
      console.log(`saved   ${jobId}`);
    } else if (status === "Failed") {
      dead++;
      console.log(`dead    ${jobId} (${status})`);
    } else {
      pending++;
      console.log(`pending ${jobId} (${status})`);
    }
  } catch (e) {
    pending++;
    console.log(`error   ${jobId}: ${e.message}`);
  }
}

console.log(`\n${saved} recovered, ${pending} still pending, ${dead} genuinely failed`);
if (pending) console.log("Re-run later to pick up the ones still queued.");
