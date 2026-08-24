"use client";

import { useState } from "react";
import type { LookupResult } from "@/lib/lookup";

// One address per outcome: a station reading too cool, one reading too hot, and
// one that is simply right. Each has a block peak above the 75°F indoor setpoint,
// so the equipment panel describes the temperature gap rather than our
// assumed solar gain.
const EXAMPLES = [
  "120 S Topanga Canyon Blvd, Topanga, CA 90290",
  "1050 Camino Del Mar, Del Mar, CA 92014",
  "200 N Spring St, Los Angeles, CA 90012",
];

export default function LookupForm() {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function run(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setResult(data);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          run(address);
        }}
      >
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, city, state"
          aria-label="US street address"
          autoComplete="street-address"
        />
        <button className="btn" disabled={busy}>
          {busy ? "Reading the block…" : "Show the gap"}
        </button>
      </form>

      <p className="examples">
        Try{" "}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            {i > 0 && " · "}
            <button
              type="button"
              onClick={() => {
                setAddress(ex);
                run(ex);
              }}
            >
              {ex.split(",")[1].trim()}
            </button>
          </span>
        ))}
      </p>

      {error && <p className="err">{error}</p>}

      {result && (
        <>
          {result.note && <p className="err">{result.note}</p>}

          {result.assignment && result.blockPeakF !== null && (
            <>
              <div className="numbers">
                <div className="num">
                  <div className="k">Your block&apos;s modelled peak</div>
                  <div className="v">{result.blockPeakF}°F</div>
                  <div className="s">
                    Hottest modelled hour, July 2024, 100 m tiles
                  </div>
                </div>
                <div className="num accent">
                  <div className="k">
                    Nearest station — {result.assignment.nearest.km} km away
                  </div>
                  <div className="v">{result.assignment.nearest.julyPeakF}°F</div>
                  <div className="s">
                    <strong>{result.assignment.nearest.icao}</strong>{" "}
                    {result.assignment.nearest.name} · off by{" "}
                    {Math.abs(result.assignment.errNearestF)}°F
                  </div>
                </div>
                <div className="num">
                  <div className="k">
                    Best thermal match — {result.assignment.bestMatch.km} km away
                  </div>
                  <div className="v">{result.assignment.bestMatch.julyPeakF}°F</div>
                  <div className="s">
                    <strong>{result.assignment.bestMatch.icao}</strong>{" "}
                    {result.assignment.bestMatch.name} · off by{" "}
                    {Math.abs(result.assignment.errBestF)}°F
                  </div>
                </div>
              </div>

              {(() => {
                const a = result.assignment!;
                const material = Math.abs(a.errNearestF) >= 5;
                const swap =
                  material && a.bestClearsBar && a.bestMatch.icao !== a.nearest.icao;
                return (
                  <div className={`verdict ${material ? "material" : "minor"}`}>
                    <b>
                      {swap
                        ? `Use ${a.bestMatch.icao}, not ${a.nearest.icao}.`
                        : material
                        ? `No station within 40 miles describes this block well.`
                        : `${a.nearest.icao} is a fair stand-in here.`}
                    </b>
                    EPA guidance points designers to the geographically closest
                    station. For this block that is {a.nearest.icao} at{" "}
                    {a.nearest.km} km, whose modelled July peak misses the block by{" "}
                    {Math.abs(a.errNearestF)}°F.{" "}
                    {swap
                      ? `${a.bestMatch.icao} is farther away at ${a.bestMatch.km} km but matches within ${Math.abs(a.errBestF)}°F. A thermally similar station beats a merely close one — but the substitution is a professional judgement, not an automatic correction.`
                      : material
                      ? `The closest verified alternative, ${a.bestMatch.icao}, is still ${Math.abs(a.errBestF)}°F out. This block sits in a gap in the station network; we will not invent a replacement for it.`
                      : "No verified station within 40 miles matches better."}
                  </div>
                );
              })()}

              {result.equipment && (
                <div
                  className={`verdict ${
                    result.equipment.direction === "aligned" ? "minor" : "material"
                  }`}
                  style={{ marginTop: 12 }}
                >
                  <b>
                    {result.equipment.direction === "aligned"
                      ? `Either way this home lands on ${result.equipment.atBlockTons} tons.`
                      : `${result.equipment.atNearestTons} tons vs ${result.equipment.atBlockTons} tons — ${Math.abs(result.equipment.deltaTons)} ton${Math.abs(result.equipment.deltaTons) === 1 ? "" : "s"} ${result.equipment.direction}.`}
                  </b>
                  {result.equipment.direction === "undersized" &&
                    `Sized from ${result.assignment.nearest.icao}'s numbers, a typical 2,000 ft² home gets ${result.equipment.atNearestTons} tons of cooling; its own block calls for ${result.equipment.atBlockTons}. An undersized system cannot hold 75°F through a heat event.`}
                  {result.equipment.direction === "oversized" &&
                    `Sized from ${result.assignment.nearest.icao}'s numbers, a typical 2,000 ft² home gets ${result.equipment.atNearestTons} tons of cooling; its own block calls for ${result.equipment.atBlockTons}. An oversized system short-cycles and dehumidifies poorly.`}
                  {result.equipment.direction === "aligned" &&
                    "The station gap is not large enough to change the equipment selection for this archetype."}{" "}
                  <span className="mono" style={{ display: "block", marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Illustrative ACCA-style sensible estimate, not a Manual J:
                    2,000 ft² single storey, R-13 walls, R-38 ceiling, 15%
                    glazing (U 0.30, SHGC 0.30), 0.5 ACH, 75°F indoor, +15%
                    duct gain, SHR 0.8, half-ton equipment steps.
                  </span>
                </div>
              )}
            </>
          )}

          {/* The Standard 310 county cap is context, not a verdict. It is a
              multi-decade 1% design temperature and cannot be subtracted from a
              single modelled July peak, so it no longer renders as a delta. */}
          <p className="context-line">
            For context: {result.county} County&apos;s Standard 310 grading cap is{" "}
            <strong>{result.ceilingF}°F</strong>, set by {result.station}
            {result.hoursAboveCeiling !== null && (
              <> — this block spent {result.hoursAboveCeiling} of July&apos;s 744 hours above it</>
            )}
            .
          </p>

          <p className="examples mono" style={{ marginTop: 16 }}>
            {result.address} · {result.lat.toFixed(4)}, {result.lon.toFixed(4)} ·
            block estimate{" "}
            {result.source === "live"
              ? "read live from the FortyGuard model"
              : "from FortyGuard model reads precomputed for July 2024"}
          </p>
        </>
      )}
    </div>
  );
}
