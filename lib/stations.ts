import laAtlas from "@/data/atlas/la.json";
import sdAtlas from "@/data/atlas/sd.json";
import fresnoAtlas from "@/data/atlas/fresno.json";
import validation from "@/data/atlas/validation.json";

export type StationRef = {
  icao: string;
  name: string;
  km: number;
  julyPeakF: number;
};

export type Assignment = {
  nearest: StationRef;
  bestMatch: StationRef;
  errNearestF: number;
  errBestF: number;
};

type AtlasStation = {
  id: string;
  lat: number;
  lon: number;
  maxF: number;
  icao: string;
  name?: string;
};

const ASSIGNABLE_KM = 64.4; // 40 miles — RESNET 310's own station radius

// Only stations whose modelled July peak we verified against NOAA's measured
// maximum (data/atlas/validation.json). No unverified candidates.
const validated = new Set(
  validation.stations.filter((s) => s.measuredF !== null).map((s) => s.icao)
);

const stations: AtlasStation[] = [];
for (const atlas of [laAtlas, sdAtlas, fresnoAtlas]) {
  for (const s of atlas.stations as AtlasStation[]) {
    if (!s.icao?.startsWith("K") || !validated.has(s.icao)) continue;
    if (stations.some((x) => x.icao === s.icao)) continue;
    stations.push(s);
  }
}

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLon = (bLon - aLon) * d;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * The station question for one block: the geographically-nearest verified
 * station vs the one whose modelled July peak best matches the block's.
 */
export function stationAssignment(
  lat: number,
  lon: number,
  blockPeakF: number
): Assignment | null {
  const inRange = stations
    .map((s) => ({ s, km: km(lat, lon, s.lat, s.lon) }))
    .filter((x) => x.km <= ASSIGNABLE_KM);
  if (inRange.length < 2) return null;

  const nearest = inRange.reduce((a, b) => (b.km < a.km ? b : a));
  const best = inRange.reduce((a, b) =>
    Math.abs(b.s.maxF - blockPeakF) < Math.abs(a.s.maxF - blockPeakF) ? b : a
  );

  const ref = (x: { s: AtlasStation; km: number }): StationRef => ({
    icao: x.s.icao,
    name: x.s.name ?? x.s.icao,
    km: r1(x.km),
    julyPeakF: x.s.maxF,
  });

  return {
    nearest: ref(nearest),
    bestMatch: ref(best),
    errNearestF: r1(nearest.s.maxF - blockPeakF),
    errBestF: r1(best.s.maxF - blockPeakF),
  };
}
