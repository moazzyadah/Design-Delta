import { NextResponse } from "next/server";
import {
  MATERIALITY_F,
  countyCeiling,
  fortyguardBlock,
  geocode,
  type LookupResult,
} from "@/lib/lookup";
import cache from "@/data/block_cache.json";
import { stationAssignment } from "@/lib/stations";
import { equipmentDelta } from "@/lib/equipment";

export const runtime = "nodejs";
export const maxDuration = 60;

type Block = { blockPeakF: number; hoursAboveCeiling: number | null };

/** [lat, lon, blockPeakF, hoursAboveCountyCeiling, countyCeilingF] */
type CacheRow = [number, number, number, number, number | null];

/** ~2.2 km. Cached cells sit on a ~1.1 km grid, so a real hit is always closer. */
const CACHE_RADIUS_DEG = 0.02;

/**
 * Cache first, live second. Participant API access ends 30 Aug while judging
 * runs to 14 Sept, so every demo address must answer from static data with no
 * key present. A live call only ever fills in an address we never precomputed.
 */
function fromCache(lat: number, lon: number, ceilingF: number): Block | null {
  let best: { d: number; row: CacheRow } | null = null;
  for (const row of cache.rows as CacheRow[]) {
    const d = Math.hypot(
      row[0] - lat,
      (row[1] - lon) * Math.cos((lat * Math.PI) / 180)
    );
    if (d < CACHE_RADIUS_DEG && (!best || d < best.d)) best = { d, row };
  }
  if (!best) return null;

  // Cached hours were counted against the metro's own county ceiling. If this
  // address resolves to a different ceiling, the peak still holds but the hour
  // count does not — report it as unavailable rather than quietly mismatched.
  const [, , blockPeakF, hours, rowCeiling] = best.row;
  const hoursValid = rowCeiling === null || rowCeiling === ceilingF;
  return { blockPeakF, hoursAboveCeiling: hoursValid ? hours : null };
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "Enter a street address." }, { status: 400 });
  }

  let place;
  try {
    place = await geocode(address);
  } catch {
    return NextResponse.json(
      { error: "The US Census geocoder did not respond. Try again in a moment." },
      { status: 502 }
    );
  }
  if (!place) {
    return NextResponse.json(
      { error: "No US address matched. Include the street, city and state." },
      { status: 404 }
    );
  }

  const row = countyCeiling(place.county);
  if (!row) {
    return NextResponse.json(
      {
        error: `${place.county} County is outside this preview. California counties are loaded today; the full 3,142-county table is the same source and is next.`,
      },
      { status: 404 }
    );
  }

  const base: LookupResult = {
    address: place.matched,
    county: place.county,
    state: row.state,
    lat: place.lat,
    lon: place.lon,
    ceilingF: row.cooling_design_temp_F,
    station: row.station,
    blockPeakF: null,
    hoursAboveCeiling: null,
    deltaF: null,
    material: null,
    source: "unavailable",
  };

  let block = fromCache(place.lat, place.lon, row.cooling_design_temp_F);
  let source: LookupResult["source"] = block ? "cache" : "unavailable";

  const key = process.env.FORTYGUARD_API_KEY;
  if (!block && key) {
    try {
      block = await fortyguardBlock(place.lat, place.lon, row.cooling_design_temp_F, key);
      source = "live";
    } catch {
      block = null;
    }
  }

  if (!block) {
    return NextResponse.json({
      ...base,
      note: "Block-level temperature is precomputed for Los Angeles, San Diego and Fresno. This address sits outside those areas — try one of the examples above. The county limit shown is still exact.",
    });
  }

  const deltaF = Math.round((row.cooling_design_temp_F - block.blockPeakF) * 10) / 10;
  const assignment = stationAssignment(place.lat, place.lon, block.blockPeakF);
  const equipment = assignment
    ? equipmentDelta(assignment.nearest.julyPeakF, block.blockPeakF)
    : null;

  return NextResponse.json({
    ...base,
    ...block,
    deltaF,
    material: Math.abs(deltaF) >= MATERIALITY_F,
    source,
    assignment,
    equipment,
  });
}
