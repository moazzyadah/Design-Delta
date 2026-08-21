// Build stage of the misassignment atlas: raw FortyGuard reads -> per-cell
// nearest-vs-most-similar station comparison.
//
//   node tools/atlas/build.mjs
import fs from "node:fs";
import path from "node:path";
import { METROS, RAW_DIR, ASSIGNABLE_KM, km, c2f, loadStations } from "./lib.mjs";

const OUT_DIR = "data/atlas";
fs.mkdirSync(OUT_DIR, { recursive: true });

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

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
const summary = {};

for (const slug of Object.keys(METROS)) {
  const jobs = files
    .filter((f) => f.startsWith(`${slug}_`))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, f))));

  // --- stations: one block read each; need both tcm and exceedance
  const stations = {};
  for (const j of jobs.filter((x) => x.job.kind === "station")) {
    const s = (stations[j.job.ref] ??= {
      id: j.job.ref, lat: j.job.lat, lon: j.job.lon,
    });
    const vals = j.tiles.map((t) => t[2]);
    if (j.job.analytic === "tcm") s.maxF = r1(c2f(median(vals)));
    else s.hrs = r1(median(vals));
  }
  const meta = new Map(loadStations(METROS[slug].box).map((s) => [s.id, s]));
  const stationList = Object.values(stations)
    .filter((s) => s.maxF !== undefined && s.hrs !== undefined)
    .map((s) => {
      const m = meta.get(s.id);
      return { ...s, icao: m?.icao || s.id, name: m?.name, elevM: m?.elevM };
    });

  // --- cells: pool chunk tiles into a 0.01° grid, median per cell
  const cellsRaw = {};
  for (const j of jobs.filter((x) => x.job.kind === "chunk")) {
    for (const [la, lo, v] of j.tiles) {
      const key = `${Math.round(la * 100)}_${Math.round(lo * 100)}`;
      const c = (cellsRaw[key] ??= {
        lat: Math.round(la * 100) / 100,
        lon: Math.round(lo * 100) / 100,
        tcm: [], exc: [],
      });
      c[j.job.analytic === "tcm" ? "tcm" : "exc"].push(v);
    }
  }
  const cells = Object.values(cellsRaw)
    .filter((c) => c.tcm.length >= 20 && c.exc.length >= 20)
    .map((c) => ({
      lat: c.lat, lon: c.lon,
      maxF: r1(c2f(median(c.tcm))),
      hrs: r1(median(c.exc)),
    }));

  // --- normalize features across the metro, then match each cell
  const std = (a) => {
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
  };
  const sMax = std(cells.map((c) => c.maxF));
  const sHrs = std(cells.map((c) => c.hrs));

  for (const c of cells) {
    const cand = stationList
      .map((s) => ({
        s,
        km: km(c.lat, c.lon, s.lat, s.lon),
        feat: Math.hypot((s.maxF - c.maxF) / sMax, (s.hrs - c.hrs) / sHrs),
      }))
      .filter((x) => x.km <= ASSIGNABLE_KM);
    if (!cand.length) continue;
    const near = cand.reduce((a, b) => (b.km < a.km ? b : a));
    const sim = cand.reduce((a, b) => (b.feat < a.feat ? b : a));
    c.nearest = near.s.icao;
    c.nearestKm = r1(near.km);
    c.errNearestF = r1(near.s.maxF - c.maxF);
    c.similar = sim.s.icao;
    c.errSimilarF = r1(sim.s.maxF - c.maxF);
  }

  const matched = cells.filter((c) => c.nearest);
  const absErr = matched.map((c) => Math.abs(c.errNearestF));
  const material = matched.filter((c) => Math.abs(c.errNearestF) >= 5);
  const fixable = material.filter((c) => Math.abs(c.errSimilarF) < 5);
  const worst = matched.reduce((a, b) =>
    Math.abs(b.errNearestF) > Math.abs(a.errNearestF) ? b : a
  );

  summary[slug] = {
    metro: METROS[slug].name,
    cells: matched.length,
    stations: stationList.length,
    pctNearestNotMostSimilar: r1(
      (100 * matched.filter((c) => c.similar !== c.nearest).length) /
        matched.length
    ),
    pctNearestOffBy5F: r1((100 * material.length) / matched.length),
    pctFixableBy5F: r1((100 * fixable.length) / matched.length),
    medianAbsErrF: r1(median(absErr)),
    p90AbsErrF: r1(pct(absErr, 90)),
    worst,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, `${slug}.json`),
    JSON.stringify(
      { metro: METROS[slug].name, window: "July 2024",
        stations: stationList, cells: matched },
      null, 0
    )
  );
  console.log(slug, JSON.stringify(summary[slug]));
}

fs.writeFileSync(
  path.join(OUT_DIR, "summary.json"),
  JSON.stringify({ window: "July 2024", threshold_F: 95, metros: summary }, null, 2)
);
console.log("wrote", OUT_DIR);
