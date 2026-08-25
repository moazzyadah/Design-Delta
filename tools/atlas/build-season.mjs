// Rebuild the atlas over the three-month peak season (July–September 2024)
// instead of July alone, and report how much the headline actually moves.
//
// Per tile, take the maximum across the three months; per ~1 km cell, take the
// median of those tile maxima. Same statistic as build-full.mjs, wider window —
// so the July and season numbers are directly comparable and any change is the
// window, not the method.
//
//   node tools/atlas/build-season.mjs
import fs from "node:fs";
import path from "node:path";
import { METROS, RAW_DIR, ASSIGNABLE_KM, km, c2f } from "./lib.mjs";

const OUT = "data/atlas";
const MATERIAL_F = 5;
const MONTH_TAGS = ["202408", "202409"]; // July arrives via the _full_ files

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const r1 = (x) => Math.round(x * 10) / 10;
const tileKey = (la, lo) => `${Math.round(la * 1e4)}_${Math.round(lo * 1e4)}`;
const cellKey = (la, lo) => `${Math.round(la * 100)}_${Math.round(lo * 100)}`;

const validated = new Set(
  JSON.parse(fs.readFileSync(`${OUT}/validation.json`)).stations
    .filter((s) => s.measuredF !== null)
    .map((s) => s.icao)
);

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));

/** Highest value each tile reached in any month we have for it. */
function tileMaxima(matcher) {
  const peak = new Map();
  let months = 0;
  for (const f of files.filter(matcher)) {
    months++;
    for (const [la, lo, v] of JSON.parse(fs.readFileSync(path.join(RAW_DIR, f))).tiles) {
      const k = tileKey(la, lo);
      const cur = peak.get(k);
      if (!cur || v > cur.v) peak.set(k, { la, lo, v });
    }
  }
  return { peak, months };
}

const EXPECTED_MONTHS = 1 + MONTH_TAGS.length; // July + the season tags
const summary = {};
const gaps = [];

for (const slug of Object.keys(METROS)) {
  // ── stations ────────────────────────────────────────────────
  const known = JSON.parse(fs.readFileSync(`${OUT}/${slug}.json`)).stations;
  const stations = [];
  for (const s of known) {
    const { peak, months } = tileMaxima(
      (f) =>
        f === `${slug}_station_${s.id}_tcm.json` ||
        MONTH_TAGS.some((t) => f === `${slug}_seasonstn_${s.id}_${t}.json`)
    );
    if (!peak.size) continue;
    stations.push({
      ...s,
      months,
      maxF: r1(c2f(median([...peak.values()].map((p) => p.v)))),
    });
  }
  const recommendable = stations.filter((s) => validated.has(s.icao));
  if (!stations.length || !recommendable.length) {
    console.log(`${slug}: no season station data yet — skipping`);
    continue;
  }

  // A cell with three months compared against a station with one produces a
  // gap that is an artefact of what happened to download, not of climate.
  // Refuse to report until both sides cover the same months.
  const thinStations = stations.filter((s) => s.months < EXPECTED_MONTHS);
  if (thinStations.length) {
    gaps.push(
      `${slug}: ${thinStations.length}/${stations.length} stations have ` +
      `<${EXPECTED_MONTHS} months (min ${Math.min(...stations.map((s) => s.months))})`
    );
  }

  // ── cells ───────────────────────────────────────────────────
  const chunkMonths = new Set(
    files
      .filter((f) => f.startsWith(`${slug}_season_`))
      .map((f) => f.slice(-11, -5))
  );
  if (chunkMonths.size < MONTH_TAGS.length) {
    gaps.push(
      `${slug}: chunk coverage has ${chunkMonths.size}/${MONTH_TAGS.length} season months`
    );
  }

  const { peak } = tileMaxima(
    (f) =>
      (f.startsWith(`${slug}_full_`) && f.endsWith("_tcm.json")) ||
      MONTH_TAGS.some((t) => f.startsWith(`${slug}_season_`) && f.endsWith(`_${t}.json`))
  );

  const pooled = {};
  for (const { la, lo, v } of peak.values()) {
    const k = cellKey(la, lo);
    (pooled[k] ??= { lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100, v: [] })
      .v.push(v);
  }

  const cells = [];
  for (const c of Object.values(pooled)) {
    if (c.v.length < 20) continue;
    const maxF = r1(c2f(median(c.v)));
    const near = stations
      .map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
      .filter((x) => x.km <= ASSIGNABLE_KM);
    const pool = recommendable
      .map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
      .filter((x) => x.km <= ASSIGNABLE_KM);
    if (near.length < 2 || !pool.length) continue;

    const nearest = near.reduce((a, b) => (b.km < a.km ? b : a));
    const best = pool.reduce((a, b) =>
      Math.abs(b.s.maxF - maxF) < Math.abs(a.s.maxF - maxF) ? b : a
    );
    cells.push({
      lat: c.lat, lon: c.lon, maxF,
      nearest: nearest.s.icao, nearestKm: r1(nearest.km),
      errNearestF: r1(nearest.s.maxF - maxF),
      similar: best.s.icao, errSimilarF: r1(best.s.maxF - maxF),
    });
  }
  if (!cells.length) {
    console.log(`${slug}: no cells yet — skipping`);
    continue;
  }

  const abs = cells.map((c) => Math.abs(c.errNearestF));
  const material = cells.filter((c) => Math.abs(c.errNearestF) >= MATERIAL_F);
  const worst = cells.reduce((a, b) =>
    Math.abs(b.errNearestF) > Math.abs(a.errNearestF) ? b : a
  );

  summary[slug] = {
    metro: METROS[slug].name,
    monthsPerStation: Math.max(...stations.map((s) => s.months)),
    cells: cells.length,
    stations: stations.length,
    pctNearestOffBy5F: r1((100 * material.length) / cells.length),
    medianAbsErrF: r1(median(abs)),
    p90AbsErrF: r1(pct(abs, 90)),
    sensitivity: [3, 4, 5, 6, 8, 10].map((bar) => ({
      barF: bar,
      pct: r1((100 * cells.filter((c) => Math.abs(c.errNearestF) >= bar).length) / cells.length),
    })),
    worst,
  };

  fs.writeFileSync(
    `${OUT}/${slug}_season.json`,
    JSON.stringify({ metro: METROS[slug].name, window: "July–September 2024", stations, cells })
  );
}

// ── the only question that matters: did the window change the answer? ──
if (gaps.length) {
  console.log("\n⚠️  INCOMPLETE — these numbers are not comparable yet:");
  for (const g of gaps) console.log(`   ${g}`);
  console.log(
    "\nA cell with more months than its station reads hotter for a reason that\n" +
    "has nothing to do with climate. Finish the fetch before reading anything\n" +
    "into the shift below.\n"
  );
}

const july = JSON.parse(fs.readFileSync(`${OUT}/summary_full.json`)).metros;
console.log("\nmetro          July-only   Jul–Sep    shift");
for (const slug of Object.keys(summary)) {
  const a = july[slug].pctNearestOffBy5F;
  const b = summary[slug].pctNearestOffBy5F;
  const d = r1(b - a);
  console.log(
    `${summary[slug].metro.padEnd(14)} ${String(a).padStart(6)}%  ${String(b).padStart(7)}%  ` +
    `${(d > 0 ? "+" : "") + d}pt   (${summary[slug].cells} cells)`
  );
}

fs.writeFileSync(
  `${OUT}/summary_season.json`,
  JSON.stringify(
    {
      window: "July–September 2024",
      method:
        "Per tile, the maximum across the three months; per ~1 km cell, the " +
        "median of those tile maxima. Identical to the July build except for " +
        "the window, so any difference is the window and not the method.",
      materialityF: MATERIAL_F,
      metros: summary,
    },
    null,
    2
  )
);
console.log(`\nwrote ${OUT}/summary_season.json`);
