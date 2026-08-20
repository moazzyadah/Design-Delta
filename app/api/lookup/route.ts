import { NextResponse } from "next/server";
import {
  MATERIALITY_F,
  countyCeiling,
  fortyguardBlock,
  geocode,
  type LookupResult,
} from "@/lib/lookup";
import cache from "@/data/block_cache.json";

export const runtime = "nodejs";
export const maxDuration = 60;

type CacheEntry = { blockPeakF: number; hoursAboveCeiling: number };

/** Nearest cached block within ~7km, so the demo keeps answering after the
 *  hackathon API key expires on 30 Aug — judging runs to 14 Sept. */
function fromCache(lat: number, lon: number): CacheEntry | null {
  let best: { d: number; e: CacheEntry } | null = null;
  for (const e of cache as Array<CacheEntry & { lat: number; lon: number }>) {
    const d = Math.hypot(e.lat - lat, (e.lon - lon) * Math.cos((lat * Math.PI) / 180));
    if (d < 0.065 && (!best || d < best.d)) best = { d, e };
  }
  return best?.e ?? null;
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

  let block: CacheEntry | null = null;
  let source: LookupResult["source"] = "unavailable";

  const key = process.env.FORTYGUARD_API_KEY;
  if (key) {
    try {
      block = await fortyguardBlock(place.lat, place.lon, row.cooling_design_temp_F, key);
      source = "live";
    } catch {
      block = null;
    }
  }
  if (!block) {
    block = fromCache(place.lat, place.lon);
    if (block) source = "cache";
  }

  if (!block) {
    return NextResponse.json({
      ...base,
      note: "Block-level temperature is not cached for this address yet, and the live API did not answer. The county ceiling above is still exact.",
    });
  }

  const deltaF = Math.round((row.cooling_design_temp_F - block.blockPeakF) * 10) / 10;

  return NextResponse.json({
    ...base,
    ...block,
    deltaF,
    material: Math.abs(deltaF) >= MATERIALITY_F,
    source,
  });
}
