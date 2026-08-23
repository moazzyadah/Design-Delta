// Recompute the misassignment atlas over the CONTIGUOUS coverage (cover.mjs)
// instead of the sampled chunks. Four times the cells, no gaps, and the same
// peak-based station matching the shipped app uses in lib/stations.ts — so the
// published statistic and the tool a judge clicks describe the same method.
//
//   node tools/atlas/build-full.mjs
import fs from "node:fs";
import path from "node:path";
import { METROS, RAW_DIR, ASSIGNABLE_KM, km, c2f } from "./lib.mjs";

const OUT = "data/atlas";
const MATERIAL_F = 5;

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

// Two different station sets, deliberately.
//
// "Nearest" is drawn from EVERY real station with modelled data. Dropping
// candidates can only push the nearest station farther away and inflate the
// error, so the wider set is the conservative one. In Los Angeles the choice
// is worth 11.7% vs 20.1% — excluding two unvalidated stations (Mount Wilson,
// downtown LA/USC) would nearly double the headline. San Diego is 25.8% either
// way.
//
// "Best match" is drawn only from stations whose modelled peak was checked
// against NOAA, because the tool should not recommend a station it never
// verified. This is the same gate lib/stations.ts applies in the app.
const validation = JSON.parse(fs.readFileSync(`${OUT}/validation.json`));
const validated = new Set(
  validation.stations.filter((s) => s.measuredF !== null).map((s) => s.icao)
);

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
const summary = {};

for (const slug of Object.keys(METROS)) {
  const stations = JSON.parse(fs.readFileSync(`${OUT}/${slug}.json`)).stations;
  const recommendable = stations.filter((s) => validated.has(s.icao));

  const raw = {};
  for (const f of files.filter((f) => f.startsWith(`${slug}_full_`) && f.endsWith("_tcm.json"))) {
    for (const [la, lo, v] of JSON.parse(fs.readFileSync(path.join(RAW_DIR, f))).tiles) {
      const k = `${Math.round(la * 100)}_${Math.round(lo * 100)}`;
      (raw[k] ??= { lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100, v: [] })
        .v.push(v);
    }
  }

  const cells = [];
  for (const c of Object.values(raw)) {
    if (c.v.length < 20) continue;
    const maxF = r1(c2f(median(c.v)));
    const cand = stations
      .map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
      .filter((x) => x.km <= ASSIGNABLE_KM);
    if (cand.length < 2) continue;

    const near = cand.reduce((a, b) => (b.km < a.km ? b : a));
    const pool = recommendable
      .map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
      .filter((x) => x.km <= ASSIGNABLE_KM);
    if (!pool.length) continue;
    const best = pool.reduce((a, b) =>
      Math.abs(b.s.maxF - maxF) < Math.abs(a.s.maxF - maxF) ? b : a
    );
    cells.push({
      lat: c.lat, lon: c.lon, maxF,
      nearest: near.s.icao, nearestKm: r1(near.km),
      errNearestF: r1(near.s.maxF - maxF),
      similar: best.s.icao, errSimilarF: r1(best.s.maxF - maxF),
    });
  }

  const abs = cells.map((c) => Math.abs(c.errNearestF));
  const material = cells.filter((c) => Math.abs(c.errNearestF) >= MATERIAL_F);
  const fixable = material.filter((c) => Math.abs(c.errSimilarF) < MATERIAL_F);
  const worst = cells.reduce((a, b) =>
    Math.abs(b.errNearestF) > Math.abs(a.errNearestF) ? b : a
  );

  // The 5°F bar is a practitioner rule of thumb, not a published standard, and
  // one constant produces every headline. Publish the whole curve so the result
  // can be read at any bar a reader prefers — and so the Fresno control can be
  // seen holding at zero wherever the bar sits.
  const sensitivity = [3, 4, 5, 6, 8, 10].map((bar) => ({
    barF: bar,
    pct: r1((100 * cells.filter((c) => Math.abs(c.errNearestF) >= bar).length) / cells.length),
  }));

  summary[slug] = {
    metro: METROS[slug].name,
    cells: cells.length,
    stations: stations.length,
    sensitivity,
    pctNearestOffBy5F: r1((100 * material.length) / cells.length),
    pctFixableBy5F: r1((100 * fixable.length) / cells.length),
    pctTooHot: r1((100 * cells.filter((c) => c.errNearestF >= MATERIAL_F).length) / cells.length),
    pctTooCool: r1((100 * cells.filter((c) => c.errNearestF <= -MATERIAL_F).length) / cells.length),
    medianAbsErrF: r1(median(abs)),
    p90AbsErrF: r1(pct(abs, 90)),
    worst,
  };

  fs.writeFileSync(
    `${OUT}/${slug}_full.json`,
    JSON.stringify({ metro: METROS[slug].name, window: "July 2024", stations, cells })
  );
  console.log(slug, JSON.stringify(summary[slug]));
}

fs.writeFileSync(
  `${OUT}/summary_full.json`,
  JSON.stringify(
    {
      window: "July 2024",
      method:
        "Contiguous 100 m FortyGuard reads pooled to ~1 km cells (median tile). " +
        "Nearest station is drawn from every real station with modelled data within " +
        "40 miles — the conservative set, since dropping candidates only pushes the " +
        "nearest one farther away. Best match is drawn only from stations verified " +
        "against NOAA, the same gate lib/stations.ts applies in the app.",
      materialityF: MATERIAL_F,
      metros: summary,
    },
    null,
    2
  )
);
console.log("\nwrote", `${OUT}/summary_full.json`);

// Slim payload for the on-page map: only what the SVG draws.
const map = {};
for (const slug of ["sd", "fresno"]) {
  const a = JSON.parse(fs.readFileSync(`${OUT}/${slug}_full.json`));
  map[slug] = {
    metro: a.metro,
    box: METROS[slug].box,
    cells: a.cells.map((c) => [c.lat, c.lon, c.errNearestF]),
    stations: a.stations.map((s) => [s.lat, s.lon, s.icao]),
    pct: summary[slug].pctNearestOffBy5F,
  };
}
fs.writeFileSync(
  `${OUT}/map.json`,
  JSON.stringify({
    note: "Cells: [lat, lon, nearestStationErrorF]. Stations: [lat, lon, icao].",
    ...map,
  })
);
console.log("wrote", `${OUT}/map.json`, Math.round(fs.statSync(`${OUT}/map.json`).size / 1024) + " KB");
