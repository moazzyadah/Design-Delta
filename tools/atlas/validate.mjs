// External validation: FortyGuard modelled July-2024 peak at each station's
// block vs NOAA's measured hourly dry-bulb maximum at that same station.
// Free, keyless NCEI Local Climatological Data API.
//
//   node tools/atlas/validate.mjs
import fs from "node:fs";
import path from "node:path";

const NOAA_DIR = ".tmp/atlas/noaa";
fs.mkdirSync(NOAA_DIR, { recursive: true });

const stations = new Map();
for (const slug of ["fresno", "la", "sd"]) {
  const atlas = JSON.parse(fs.readFileSync(`data/atlas/${slug}.json`));
  for (const s of atlas.stations) stations.set(s.id, s);
}

async function noaaJulyMax(id) {
  const cache = path.join(NOAA_DIR, `${id}.json`);
  if (!fs.existsSync(cache)) {
    const url =
      "https://www.ncei.noaa.gov/access/services/data/v1" +
      "?dataset=local-climatological-data" +
      `&stations=${id}&startDate=2024-07-01&endDate=2024-07-31` +
      "&dataTypes=HourlyDryBulbTemperature&format=json";
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`NOAA ${res.status}`);
    fs.writeFileSync(cache, await res.text());
  }
  const rows = JSON.parse(fs.readFileSync(cache, "utf8"));
  const temps = rows
    .map((r) => parseFloat(r.HourlyDryBulbTemperature))
    .filter((t) => Number.isFinite(t) && t > -40 && t < 140);
  return temps.length >= 200 ? Math.max(...temps) : null; // need real coverage
}

const out = [];
for (const s of stations.values()) {
  try {
    const measured = await noaaJulyMax(s.id);
    const deltaF =
      measured === null ? null : Math.round((s.maxF - measured) * 10) / 10;
    out.push({ icao: s.icao, name: s.name, modelledF: s.maxF, measuredF: measured, deltaF });
    console.log(
      `${s.icao}  modelled ${s.maxF}  measured ${measured ?? "n/a"}  delta ${deltaF ?? "-"}`
    );
  } catch (e) {
    out.push({ icao: s.icao, name: s.name, modelledF: s.maxF, measuredF: null, deltaF: null });
    console.log(`${s.icao}  NOAA fetch failed: ${e.message}`);
  }
}

const ok = out.filter((r) => r.deltaF !== null);
const absD = ok.map((r) => Math.abs(r.deltaF)).sort((a, b) => a - b);
const medianAbs = absD.length ? absD[absD.length >> 1] : null;

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const xs = ok.map((r) => r.modelledF), ys = ok.map((r) => r.measuredF);
const mx = mean(xs), my = mean(ys);
const pearson =
  xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) /
  Math.sqrt(
    xs.reduce((a, x) => a + (x - mx) ** 2, 0) *
      ys.reduce((a, y) => a + (y - my) ** 2, 0)
  );
const coastal = ok.filter((r) => r.measuredF <= 91);
const interior = ok.filter((r) => r.measuredF >= 101);

fs.writeFileSync(
  "data/atlas/validation.json",
  JSON.stringify(
    {
      note:
        "FortyGuard modelled block peak (median tile, ~2 km box, July 2024) vs " +
        "NOAA LCD measured hourly dry-bulb max at the same station, same month. " +
        "The model preserves cross-station ordering (high correlation) but " +
        "compresses the coastal-inland gradient: coastal stations read warm, " +
        "hot-interior stations read cool. Atlas misassignment magnitudes are " +
        "therefore conservative.",
      stationsCompared: ok.length,
      medianAbsDeltaF: medianAbs,
      pearsonR: Math.round(pearson * 1000) / 1000,
      coastalMeanBiasF: Math.round(mean(coastal.map((r) => r.deltaF)) * 10) / 10,
      interiorMeanBiasF: Math.round(mean(interior.map((r) => r.deltaF)) * 10) / 10,
      stations: out,
    },
    null,
    2
  )
);
console.log(
  `\n${ok.length} stations, median |delta| ${medianAbs}°F, r ${pearson.toFixed(3)}`
);
