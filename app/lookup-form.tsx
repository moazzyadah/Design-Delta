"use client";

import { useState } from "react";
import type { LookupResult } from "@/lib/lookup";

const EXAMPLES = [
  "1298 Prospect St, La Jolla, CA 92037",
  "590 Palm Canyon Dr, Borrego Springs, CA 92004",
  "1 World Way, Los Angeles, CA 90045",
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
              <div className="k">Your block actually peaked at</div>
              <div className="v">
                {result.blockPeakF !== null ? `${result.blockPeakF}°F` : "—"}
              </div>
              <div className="s">Hottest hour, July 2024, 100 m tiles</div>
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
                ? "ACCA's own guidance says a 5°F discrepancy should be corrected. This one clears that bar — worth raising with whoever sizes the equipment."
                : "Under ACCA's 5°F materiality bar. The county number is a reasonable stand-in for this block."}
            </div>
          )}

          <p className="examples mono" style={{ marginTop: 16 }}>
            {result.address} · {result.lat.toFixed(4)}, {result.lon.toFixed(4)} ·
            block data {result.source === "live" ? "read live from FortyGuard" : "from cached FortyGuard reads"}
          </p>
        </>
      )}
    </div>
  );
}
