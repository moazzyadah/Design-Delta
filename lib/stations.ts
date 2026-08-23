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
  /** False when no verified station within 40 miles gets inside the 5°F bar. */
  bestClearsBar: boolean;
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
const MATERIALITY_F = 5;
/** Matches within this of the best are treated as equals, so distance decides. */
const MATCH_TOLERANCE_F = 1;

// Two pools, deliberately, and the same split the atlas uses in
// tools/atlas/build-full.mjs.
//
// `all` answers "which station is nearest" — every station with modelled data
// counts, because dropping candidates only pushes the nearest one farther away
// and inflates the error we are reporting. Restricting this pool to verified
// stations alone would have the app print a material error in downtown Los
// Angeles on the strength of a station 16 km away while an unverified one sits
// 5 km away and within 1°F.
//
// `recommendable` answers "which station should you use instead" — only
// stations whose modelled peak was checked against NOAA, because the tool
// should not send someone to a station it never verified.
const validated = new Set(
  validation.stations.filter((s) => s.measuredF !== null).map((s) => s.icao)
);

const all: AtlasStation[] = [];
for (const atlas of [laAtlas, sdAtlas, fresnoAtlas]) {
  for (const s of atlas.stations as AtlasStation[]) {
    if (typeof s.maxF !== "number" || !s.icao) continue;
    if (all.some((x) => x.icao === s.icao)) continue;
    all.push(s);
  }
}
const recommendable = all.filter((s) => validated.has(s.icao));

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLon = (bLon - aLon) * d;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const r1 = (x: number) => Math.round(x * 10) / 10;

type Candidate = { s: AtlasStation; km: number };

const within = (lat: number, lon: number, pool: AtlasStation[]): Candidate[] =>
  pool
    .map((s) => ({ s, km: km(lat, lon, s.lat, s.lon) }))
    .filter((x) => x.km <= ASSIGNABLE_KM);

const ref = (c: Candidate): StationRef => ({
  icao: c.s.icao,
  name: c.s.name ?? c.s.icao,
  km: r1(c.km),
  julyPeakF: c.s.maxF,
});

/**
 * The station question for one block: the geographically-nearest station vs the
 * verified one whose modelled July peak best matches the block's.
 */
export function stationAssignment(
  lat: number,
  lon: number,
  blockPeakF: number
): Assignment | null {
  const nearby = within(lat, lon, all);
  const options = within(lat, lon, recommendable);
  if (!nearby.length || !options.length) return null;

  const nearest = nearby.reduce((a, b) => (b.km < a.km ? b : a));

  // Among stations that match the block about equally well, prefer the closest.
  // Without this the recommendation drifts to whichever station happens to sit
  // at the far edge of the 40-mile radius.
  const err = (c: Candidate) => Math.abs(c.s.maxF - blockPeakF);
  const floor = Math.min(...options.map(err));
  const bestMatch = options
    .filter((c) => err(c) <= floor + MATCH_TOLERANCE_F)
    .reduce((a, b) => (b.km < a.km ? b : a));

  return {
    nearest: ref(nearest),
    bestMatch: ref(bestMatch),
    errNearestF: r1(nearest.s.maxF - blockPeakF),
    errBestF: r1(bestMatch.s.maxF - blockPeakF),
    bestClearsBar: err(bestMatch) < MATERIALITY_F,
  };
}
