// Turn the exceedance ladder into a 1% cooling design temperature per block.
//
// The 1% value is the dry-bulb exceeded about 88 hours a year — the quantity
// ACCA Manual J and the ENERGY STAR guidance actually use. It is not a window
// maximum, and that distinction is the whole point: a maximum is one hour in
// thousands and moves with whatever heat event lands in the window, which is
// how the same atlas produced 26.2% on July and 12.7% on July–September.
//
// Per cell, take the median hours across its tiles at each ladder rung, then
// interpolate to the threshold where the count crosses 88. Exceedance decays
// roughly exponentially with threshold, so the interpolation is linear in
// log(hours).
//
// Caveat, stated in the output: the ladder covers July–September. Hours above a
// 1% threshold outside those months are not zero everywhere, so the crossing is
// reached slightly late and the resulting temperature is a mild underestimate.
// It is the same underestimate for a block and for its station, so the
// difference between them — the only thing the atlas reports — is unaffected.
//
//   node tools/atlas/build-p1.mjs [metro]
import fs from "node:fs";
import path from "node:path";
import { RAW_DIR, ASSIGNABLE_KM, km } from "./lib.mjs";

const slug = process.argv[2] ?? "sd";
const OUT = "data/atlas";
const TARGET_HOURS = 88; // 1% of 8,760
const MATERIAL_F = 5;
const MONTH_TAGS = ["202407", "202408", "202409"];

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (x) => Math.round(x * 10) / 10;
const cellKey = (la, lo) => `${Math.round(la * 100)}_${Math.round(lo * 100)}`;

const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));
const validated = new Set(
  JSON.parse(fs.readFileSync(`${OUT}/validation.json`)).stations
    .filter((s) => s.measuredF !== null).map((s) => s.icao)
);

/**
 * Hours above each threshold, summed over the three months. A rung is only
 * usable if all three months are present — a partial sum undercounts hours and
 * would push the crossing to a lower temperature.
 */
function rungs(prefix) {
  const byThreshold = new Map();
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const m = f.match(/_(-?\d+)_(\d{6})\.json$/);
    if (!m) continue;
    const [, tF, tag] = m;
    if (!MONTH_TAGS.includes(tag)) continue;
    const entry = byThreshold.get(+tF) ?? { months: new Set(), tiles: new Map() };
    entry.months.add(tag);
    for (const [la, lo, v] of JSON.parse(fs.readFileSync(path.join(RAW_DIR, f))).tiles) {
      const k = `${Math.round(la * 1e4)}_${Math.round(lo * 1e4)}`;
      const cur = entry.tiles.get(k) ?? { la, lo, h: 0 };
      cur.h += v;
      entry.tiles.set(k, cur);
    }
    byThreshold.set(+tF, entry);
  }
  return [...byThreshold.entries()]
    .filter(([, e]) => e.months.size === MONTH_TAGS.length)
    .sort((a, b) => a[0] - b[0]);
}

/** Threshold where hours cross the target, interpolated in log(hours). */
function crossing(points) {
  const p = points.filter(([, h]) => h > 0).sort((a, b) => a[0] - b[0]);
  if (p.length < 2) return null;
  for (let i = 0; i < p.length - 1; i++) {
    const [ta, ha] = p[i], [tb, hb] = p[i + 1];
    if (ha >= TARGET_HOURS && hb <= TARGET_HOURS && ha > hb) {
      const f = (Math.log(ha) - Math.log(TARGET_HOURS)) / (Math.log(ha) - Math.log(hb));
      return ta + (tb - ta) * f;
    }
  }
  return null; // target outside the ladder's range
}

// ── stations ──────────────────────────────────────────────────
const season = JSON.parse(fs.readFileSync(`${OUT}/${slug}_season.json`, "utf8"));
const stations = [];
for (const s of season.stations) {
  const rs = rungs(`${slug}_ladderstn_${s.id}_`);
  const pts = rs.map(([tF, e]) => [tF, median([...e.tiles.values()].map((t) => t.h))]);
  const p1 = crossing(pts);
  if (p1 === null) continue;
  stations.push({ ...s, p1F: r1(p1), rungs: pts.map(([t, h]) => [t, r1(h)]) });
}
const recommendable = stations.filter((s) => validated.has(s.icao));

// ── cells ─────────────────────────────────────────────────────
const perCell = new Map();
const chunkPrefixes = new Set(
  files.filter((f) => f.startsWith(`${slug}_ladder_`))
    .map((f) => f.replace(/_(-?\d+)_(\d{6})\.json$/, "_"))
);

for (const prefix of chunkPrefixes) {
  const rs = rungs(prefix);
  if (rs.length < 2) continue;
  const pooled = new Map();
  for (const [tF, e] of rs) {
    for (const t of e.tiles.values()) {
      const k = cellKey(t.la, t.lo);
      const c = pooled.get(k) ?? { lat: Math.round(t.la * 100) / 100, lon: Math.round(t.lo * 100) / 100, byT: new Map() };
      const arr = c.byT.get(tF) ?? [];
      arr.push(t.h);
      c.byT.set(tF, arr);
      pooled.set(k, c);
    }
  }
  for (const [k, c] of pooled) {
    if ([...c.byT.values()][0].length < 20) continue;
    const pts = [...c.byT.entries()].map(([tF, hs]) => [tF, median(hs)]);
    const p1 = crossing(pts);
    if (p1 === null) continue;
    perCell.set(k, { lat: c.lat, lon: c.lon, p1F: r1(p1) });
  }
}

// ── the comparison ────────────────────────────────────────────
const cells = [];
for (const c of perCell.values()) {
  const near = stations.map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
    .filter((x) => x.km <= ASSIGNABLE_KM);
  const pool = recommendable.map((s) => ({ s, km: km(c.lat, c.lon, s.lat, s.lon) }))
    .filter((x) => x.km <= ASSIGNABLE_KM);
  if (near.length < 2 || !pool.length) continue;
  const nearest = near.reduce((a, b) => (b.km < a.km ? b : a));
  const best = pool.reduce((a, b) =>
    Math.abs(b.s.p1F - c.p1F) < Math.abs(a.s.p1F - c.p1F) ? b : a);
  cells.push({
    ...c,
    nearest: nearest.s.icao, nearestKm: r1(nearest.km),
    errNearestF: r1(nearest.s.p1F - c.p1F),
    similar: best.s.icao, errSimilarF: r1(best.s.p1F - c.p1F),
  });
}

const abs = cells.map((c) => Math.abs(c.errNearestF));
const material = cells.filter((c) => Math.abs(c.errNearestF) >= MATERIAL_F);
const worst = cells.reduce((a, b) =>
  Math.abs(b.errNearestF) > Math.abs(a.errNearestF) ? b : a);

const out = {
  metro: season.metro,
  quantity: "1% cooling design temperature (dry-bulb exceeded ~88 h/yr)",
  window: "July–September 2024 exceedance ladder",
  caveat:
    "Hours above the threshold outside July–September are not counted, so each " +
    "1% value is a mild underestimate. The same underestimate applies to a block " +
    "and to its station, so the difference between them is unaffected.",
  targetHours: TARGET_HOURS,
  materialityF: MATERIAL_F,
  cells: cells.length,
  stations: stations.length,
  pctNearestOffBy5F: r1((100 * material.length) / cells.length),
  medianAbsErrF: r1(median(abs)),
  sensitivity: [3, 4, 5, 6, 8, 10].map((bar) => ({
    barF: bar,
    pct: r1((100 * cells.filter((c) => Math.abs(c.errNearestF) >= bar).length) / cells.length),
  })),
  worst,
  stationP1: stations.map((s) => ({ icao: s.icao, p1F: s.p1F, seasonMaxF: s.maxF })),
};

fs.writeFileSync(`${OUT}/${slug}_p1.json`, JSON.stringify({ ...out, cellList: cells }));
fs.writeFileSync(`${OUT}/summary_p1_${slug}.json`, JSON.stringify(out, null, 2));

const jul = JSON.parse(fs.readFileSync(`${OUT}/summary_full.json`)).metros[slug];
const sea = JSON.parse(fs.readFileSync(`${OUT}/summary_season.json`)).metros[slug];
console.log(`\n${out.metro} — nearest station off by 5°F or more\n`);
console.log(`  July maximum        ${String(jul.pctNearestOffBy5F).padStart(6)}%   (${jul.cells} cells)`);
console.log(`  Jul–Sep maximum     ${String(sea.pctNearestOffBy5F).padStart(6)}%   (${sea.cells} cells)`);
console.log(`  1% design temp      ${String(out.pctNearestOffBy5F).padStart(6)}%   (${out.cells} cells)  <- the quantity standards use`);
console.log(`\n  median |error|      ${out.medianAbsErrF}°F`);
console.log(`  worst               ${out.worst.errNearestF > 0 ? "+" : ""}${out.worst.errNearestF}°F · ${out.worst.nearest} at ${out.worst.nearestKm} km`);
console.log(`\n  station 1% values:`);
for (const s of out.stationP1.slice(0, 8)) {
  console.log(`    ${s.icao.padEnd(8)} 1%=${String(s.p1F).padStart(6)}°F   season max=${String(s.seasonMaxF).padStart(6)}°F`);
}
