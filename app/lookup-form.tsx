"use client";

import { useState } from "react";
import type { LookupResult } from "@/lib/lookup";

const EXAMPLES = [
  "1298 Prospect St, La Jolla, CA 92037",
  "590 Palm Canyon Dr, Borrego Springs, CA 92004",
  "120 S Topanga Canyon Blvd, Topanga, CA 90290",
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
          <div className="numbers">
            <div className="num">
              <div className="k">{result.county} County allows up to</div>
              <div className="v">{result.ceilingF}°F</div>
              <div className="s">
                Set by <strong>{result.station}</strong>
              </div>
            </div>

            <div className="num">
              <div className="k">Your block&apos;s modelled peak</div>
              <div className="v">
                {result.blockPeakF !== null ? `${result.blockPeakF}°F` : "—"}
              </div>
              <div className="s">Hottest modelled hour, July 2024, 100 m tiles</div>
            </div>

            <div className="num accent">
              <div className="k">Hours your block spent above the limit</div>
              <div className="v">
                {result.hoursAboveCeiling !== null ? result.hoursAboveCeiling : "—"}
              </div>
              <div className="s">Out of 744 hours in the month</div>
            </div>
          </div>

          {result.note && <p className="err">{result.note}</p>}

          {result.deltaF !== null && (
            <div className={`verdict ${result.material ? "material" : "minor"}`}>
              <b>
                {result.deltaF > 0
                  ? `The limit sits ${result.deltaF}°F above your block.`
                  : `Your block runs ${Math.abs(result.deltaF)}°F above the limit.`}
              </b>
              {result.material
                ? "Practitioner guidance treats a 5°F discrepancy as worth correcting. This one clears that bar — worth raising with whoever selects the design station."
                : "Inside the 5°F band practitioners treat as immaterial. The county number is a reasonable stand-in for this block."}
            </div>
          )}

          {result.assignment && result.blockPeakF !== null && (
            <>
              <div className="numbers" style={{ marginTop: 20 }}>
                <div className="num">
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

              <div
                className={`verdict ${
                  Math.abs(result.assignment.errNearestF) >= 5 ? "material" : "minor"
                }`}
              >
                <b>
                  {Math.abs(result.assignment.errNearestF) >= 5 &&
                  result.assignment.bestMatch.icao !== result.assignment.nearest.icao
                    ? `Use ${result.assignment.bestMatch.icao}, not ${result.assignment.nearest.icao}.`
                    : `${result.assignment.nearest.icao} is a fair stand-in here.`}
                </b>
                EPA guidance points designers to the geographically closest
                station. For this block that is {result.assignment.nearest.icao},
                whose modelled July peak misses the block by{" "}
                {Math.abs(result.assignment.errNearestF)}°F.{" "}
                {result.assignment.bestMatch.icao !== result.assignment.nearest.icao
                  ? `${result.assignment.bestMatch.icao} matches within ${Math.abs(result.assignment.errBestF)}°F. Only NOAA-verified stations within 40 miles are considered.`
                  : "No verified station within 40 miles matches better."}
              </div>

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
