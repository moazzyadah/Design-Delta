// Shared pieces for the misassignment atlas (PLAN.md, Days 1-3).
// All FortyGuard reads are July 2024, the peak cooling month, matching the app.
import fs from "node:fs";

export const FG = "https://api.fortyguard.com/v1";
export const RAW_DIR = ".tmp/atlas/raw";

export const WINDOW = {
  filter_type: 4,
  start_date: "2024-07-01",
  end_date: "2024-07-31",
  start_time: "00:00",
  end_time: "23:00",
};

export const THRESH_C = 35.0; // 95°F — the tail threshold used across the project
export const CHUNK_HALF = 0.02; // sampled chunk = 0.04° box (~4 km)
export const STATION_HALF = 0.01; // station block = 0.02° box (~2 km)
export const ASSIGNABLE_KM = 64.4; // 40 miles — mirrors RESNET 310's station radius

export const c2f = (c) => (c * 9) / 5 + 32;

// Populated-area boxes; `land` is a rough ocean mask for chunk centers.
export const METROS = {
  fresno: {
    name: "Fresno",
    box: { w: -119.95, s: 36.65, e: -119.6, n: 36.9 },
    step: 0.1,
    land: () => true,
  },
  la: {
    name: "Los Angeles",
    box: { w: -118.68, s: 33.93, e: -117.95, n: 34.32 },
    step: 0.1,
    land: (lat, lon) => !(lon < -118.47 && lat < 34.02),
  },
  sd: {
    name: "San Diego",
    box: { w: -117.28, s: 32.55, e: -116.9, n: 33.05 },
    step: 0.1,
    land: (lat, lon) => !(lon < -117.18 && lat < 32.72),
  },
};

export function chunkCenters(metro) {
  const { box, step, land } = metro;
  const out = [];
  for (let lat = box.s + step / 2; lat < box.n; lat += step)
    for (let lon = box.w + step / 2; lon < box.e; lon += step)
      if (land(lat, lon)) out.push({ lat: r4(lat), lon: r4(lon) });
  return out;
}

// Candidate stations a designer could actually be assigned: real US surface
// stations (WBAN set) still reporting through the study window. Pad reaches
// ~40 miles beyond the box so every cell sees its full assignable set.
export function loadStations(box, pad = 0.6) {
  const rows = fs.readFileSync(".tmp/isd.csv", "utf8").split("\n").slice(1);
  const out = new Map();
  for (const line of rows) {
    const f = line.split('","').map((s) => s.replace(/^"|"$/g, ""));
    if (f.length < 11) continue;
    const [usaf, wban, name, ctry, state, icao, lat, lon, elev, , end] = f;
    if (ctry !== "US" || state !== "CA" || wban === "99999") continue;
    if (Number(end) < 20240801) continue;
    const la = Number(lat), lo = Number(lon);
    if (la < box.s - pad || la > box.n + pad || lo < box.w - pad || lo > box.e + pad)
      continue;
    out.set(usaf + wban, {
      id: usaf + wban, name, icao, lat: la, lon: lo, elevM: Number(elev),
    });
  }
  return [...out.values()];
}

export function km(aLat, aLon, bLat, bLon) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLon = (bLon - aLon) * d;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function boxAround(lat, lon, half) {
  const [w, s, e, n] = [lon - half, lat - half, lon + half, lat + half];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    ],
  };
}

export async function submitAndPoll(body, key, budgetMs = 300000) {
  const res = await fetch(`${FG}/heatmap`, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const submitted = await res.json();
  const id = submitted?.data?.activity_id;
  if (!id) throw new Error(`submit: ${submitted?.message ?? res.status}`);

  const started = Date.now();
  let wait = 4000;
  while (Date.now() - started < budgetMs) {
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 1.4, 15000);
    const s = await fetch(`${FG}/status/${id}`, {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(30000),
    });
    const j = await s.json();
    const st = j?.data?.status;
    if (st === "Completed") return { id, result: j.data.result };
    if (st === "Failed") throw new Error(`task ${id} failed`);
  }
  throw new Error(`task ${id} still processing after ${budgetMs}ms`);
}

// Compact a map_data FeatureCollection into [latCentroid, lonCentroid, value].
export function compactTiles(mapData, prop) {
  return mapData.features.map((f) => {
    const ring = f.geometry.coordinates[0];
    let la = 0, lo = 0;
    for (const [x, y] of ring) { lo += x; la += y; }
    return [r4(la / ring.length), r4(lo / ring.length), f.properties[prop]];
  });
}

export const r4 = (x) => Math.round(x * 1e4) / 1e4;
