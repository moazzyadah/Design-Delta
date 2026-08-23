/**
 * Illustrative ACCA-style sensible load for one openly-stated archetype home.
 * NOT a Manual J calculation — it exists to show what a design-temperature
 * gap does to equipment selection, with every assumption on screen.
 */
export const ARCHETYPE = {
  floorFt2: 2000,
  ceilingHeightFt: 9,
  wallR: 13,
  ceilingR: 38,
  glazingPctOfFloor: 15,
  glazingU: 0.3,
  indoorF: 75,
  infiltrationAch: 0.5,
  internalGainBtuh: 3000, // people + appliances at peak
  solarGainBtuh: 3600, // through glazing at peak hour (SHGC 0.30)
  ductFactor: 1.15,
  latentFactor: 1.25, // SHR ~0.8
};

export type Equipment = {
  atNearestTons: number;
  atBlockTons: number;
  deltaTons: number;
  direction: "undersized" | "oversized" | "aligned";
};

const A = ARCHETYPE;
const side = Math.sqrt(A.floorFt2);
const glazingFt2 = (A.glazingPctOfFloor / 100) * A.floorFt2;
const wallFt2 = 4 * side * A.ceilingHeightFt - glazingFt2;
// BTU/h per °F of indoor-outdoor difference: conduction + infiltration
const uaPerF =
  wallFt2 / A.wallR +
  A.floorFt2 / A.ceilingR +
  glazingFt2 * A.glazingU +
  1.1 * ((A.infiltrationAch * A.floorFt2 * A.ceilingHeightFt) / 60);

function coolingTons(designF: number) {
  const sensible =
    uaPerF * Math.max(0, designF - A.indoorF) + A.solarGainBtuh + A.internalGainBtuh;
  return (sensible * A.ductFactor * A.latentFactor) / 12000;
}

/** Round up to the half-ton units equipment actually comes in. */
const unitTons = (t: number) => Math.max(1.5, Math.ceil(t * 2) / 2);

export function equipmentDelta(
  nearestF: number,
  blockF: number
): Equipment | null {
  // Below the indoor setpoint the conduction term is zero and the whole load is
  // the assumed solar and internal gain, so the tonnage would describe our
  // constants rather than the temperature difference the tool exists to show.
  if (blockF <= A.indoorF || nearestF <= A.indoorF) return null;

  const atNearestTons = unitTons(coolingTons(nearestF));
  const atBlockTons = unitTons(coolingTons(blockF));
  const deltaTons = Math.round((atNearestTons - atBlockTons) * 10) / 10;
  return {
    atNearestTons,
    atBlockTons,
    deltaTons,
    direction:
      deltaTons < 0 ? "undersized" : deltaTons > 0 ? "oversized" : "aligned",
  };
}
