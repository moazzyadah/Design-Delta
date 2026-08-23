// Day-7 freeze, part 2: collapse every atlas read into one static cache the
// deployed demo serves from. Participant API access ends 30 Aug; judging runs
// to 14 Sept, so the site must answer with no key at all.
//
//   node tools/atlas/freeze.mjs
import fs from "node:fs";
import path from "node:path";
import { METROS, RAW_DIR, CEILING_F, c2f } from "./lib.mjs";

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (x) => Math.round(x * 10) / 10;
const cellKey = (la, lo) => `${Math.round(la * 100)}_${Math.round(lo * 100)}`;

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
const out = [];

for (const slug of Object.keys(METROS)) {
  const cells = {};
  const add = (file, field) => {
    const j = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file)));
    for (const [la, lo, v] of j.tiles) {
      const c = (cells[cellKey(la, lo)] ??= {
        lat: Math.round(la * 100) / 100,
        lon: Math.round(lo * 100) / 100,
        peak: [], ceil: [],
      });
      c[field].push(v);
    }
  };

  // Contiguous coverage (cover.mjs) supersedes the atlas's sampled chunks;
  // fall back to the samples only where coverage was never fetched.
  const full = files.filter((f) => f.startsWith(`${slug}_full_`));
  if (full.length) {
    for (const f of full) add(f, f.endsWith("_tcm.json") ? "peak" : "ceil");
  } else {
    for (const f of files) {
      if (f.startsWith(`${slug}_ceil_`)) add(f, "ceil");
      else if (f.startsWith(`${slug}_chunk_`) && f.endsWith("_tcm.json")) add(f, "peak");
    }
  }

  let kept = 0;
  for (const c of Object.values(cells)) {
    if (c.peak.length < 20 || c.ceil.length < 20) continue;
    out.push([
      c.lat, c.lon,
      r1(c2f(median(c.peak))),
      r1(median(c.ceil)),
      CEILING_F[slug],
    ]);
    kept++;
  }
  console.log(`${slug}: ${kept} cells cached (ceiling ${CEILING_F[slug]}°F)`);
}

// Demo points outside the three metro boxes, kept so the examples always answer.
// ceiling null = hours were counted against whatever ceiling applied when read.
const SEEDS = [
  [33.255, -116.375, 115.0, 171.4, null], // Borrego Springs, the station that sets San Diego's cap
];
for (const s of SEEDS) {
  if (out.some((c) => Math.hypot(c[0] - s[0], c[1] - s[1]) < 0.02)) continue;
  out.push(s);
}

fs.writeFileSync(
  "data/block_cache.json",
  JSON.stringify({
    note:
      "Precomputed FortyGuard reads, July 2024, 100 m tiles, median per ~1 km cell. " +
      "Columns: [lat, lon, blockPeakF, hoursAboveCountyCeilingF, countyCeilingF]. " +
      "Built by tools/atlas/cover.mjs + freeze.mjs.",
    rows: out,
  })
);
const kb = Math.round(fs.statSync("data/block_cache.json").size / 1024);
console.log(`\nwrote data/block_cache.json — ${out.length} rows, ${kb} KB`);
