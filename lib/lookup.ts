import counties from "@/data/resnet_appendix_a_ca.json";

export type CountyRow = {
  county: string;
  state: string;
  cooling_design_temp_F: number;
  heating_design_temp_F: number | null;
  station: string;
  notes: string;
};

import type { Assignment } from "@/lib/stations";
import type { Equipment } from "@/lib/equipment";

export type LookupResult = {
  address: string;
  county: string;
  state: string;
  lat: number;
  lon: number;
  ceilingF: number;
  station: string;
  blockPeakF: number | null;
  hoursAboveCeiling: number | null;
  deltaF: number | null;
  material: boolean | null;
  source: "live" | "cache" | "unavailable";
  note?: string;
  assignment?: Assignment | null;
  equipment?: Equipment | null;
};

/**
 * The bar this tool calls "material". It is a practitioner rule of thumb, not a
 * value published by any standard — data/atlas/summary_full.json carries the
 * full sensitivity curve so the headline can be read at any other bar.
 */
export const MATERIALITY_F = 5;

const c2f = (c: number) => (c * 9) / 5 + 32;
const f2c = (f: number) => ((f - 32) * 5) / 9;

export function countyCeiling(county: string): CountyRow | null {
  const key = county.replace(/\s+County$/i, "").trim().toLowerCase();
  return (
    (counties as CountyRow[]).find((r) => r.county.toLowerCase() === key) ?? null
  );
}

/** US Census Geocoder — free, keyless, and stays up long after our API key expires. */
export async function geocode(address: string) {
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress" +
    `?address=${encodeURIComponent(address)}` +
    "&benchmark=Public_AR_Current&vintage=Current_Current&format=json";

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);

  const match = (await res.json())?.result?.addressMatches?.[0];
  if (!match) return null;

  return {
    matched: match.matchedAddress as string,
    lat: match.coordinates.y as number,
    lon: match.coordinates.x as number,
    county: match.geographies.Counties[0].NAME as string,
    state: match.geographies.States?.[0]?.STUSAB as string | undefined,
  };
}

const FG = "https://api.fortyguard.com/v1";

function boxAround(lat: number, lon: number, halfDeg = 0.01) {
  const [w, s, e, n] = [lon - halfDeg, lat - halfDeg, lon + halfDeg, lat + halfDeg];
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

async function submitAndPoll(body: unknown, key: string, budgetMs = 55000) {
  const res = await fetch(`${FG}/heatmap`, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const submitted = await res.json();
  const id = submitted?.data?.activity_id;
  if (!id) throw new Error(submitted?.message ?? "submit failed");

  const started = Date.now();
  let wait = 3000;
  while (Date.now() - started < budgetMs) {
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 1.5, 12000);

    const s = await fetch(`${FG}/status/${id}`, {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(20000),
    });
    const j = await s.json();
    if (j?.data?.status === "Completed") return j.data.result;
    if (j?.data?.status === "Failed") throw new Error("FortyGuard task failed");
  }
  throw new Error("FortyGuard task still processing past our budget");
}

/**
 * Two FortyGuard reads for one address, over the peak cooling month:
 *  - tcm       → what the block actually peaks at
 *  - exceedance → hours the block spent above its own county's legal ceiling
 */
export async function fortyguardBlock(
  lat: number,
  lon: number,
  ceilingF: number,
  key: string
) {
  const aoi = boxAround(lat, lon);
  const window = {
    filter_type: 4,
    start_date: "2024-07-01",
    end_date: "2024-07-31",
    start_time: "00:00",
    end_time: "23:00",
  };

  const [peak, exceed] = await Promise.all([
    submitAndPoll(
      { polygon_aoi: aoi, date_time: window, granularity: 100, analytic_type: "tcm" },
      key
    ),
    submitAndPoll(
      {
        polygon_aoi: aoi,
        date_time: window,
        granularity: 100,
        analytic_type: "exceedance",
        threshold: Number(f2c(ceilingF).toFixed(2)),
        direction: "above",
      },
      key
    ),
  ]);

  // Median, not max. Each tile already carries its own July maximum, so the
  // median describes the block while the max describes its single worst spot.
  // Station blocks in data/atlas are medians too — mixing the two would compare
  // a block's hot spot against a station's typical tile.
  const tiles = peak.map_data.features as Array<{
    properties: { max_temperature: number };
  }>;
  const sorted = tiles.map((t) => t.properties.max_temperature).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const blockPeakC =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    blockPeakF: Math.round(c2f(blockPeakC) * 10) / 10,
    hoursAboveCeiling: Math.round((exceed.stats_data.mean as number) * 10) / 10,
  };
}
