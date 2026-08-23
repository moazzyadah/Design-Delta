import mapData from "@/data/atlas/map.json";

/**
 * Where the nearest-station rule breaks, drawn from the atlas.
 *
 * Three states, not a continuous ramp — the cut is the tool's own 5°F
 * materiality bar, so the colour says exactly what the headline number counts.
 * Palette validated against this dark surface (#102027): CVD separation
 * ΔE 18.2 protan, 25.6 normal; both slots inside the dark lightness band.
 */
const WARM = "#D9762A"; // nearest station reads ≥5°F hotter → oversizing risk
const COOL = "#2E93B5"; // nearest station reads ≥5°F cooler → undersizing risk
const FINE = "#3d4f57"; // within 5°F — recessive on purpose; the story is the errors

type Panel = {
  metro: string;
  box: { w: number; s: number; e: number; n: number };
  cells: [number, number, number][];
  stations: [number, number, string][];
  pct: number;
};

function Map({ panel, caption }: { panel: Panel; caption: string }) {
  // Bound the drawing by the cells that exist, not the nominal metro box —
  // coverage chunks stop short of the box edge and would leave an empty band.
  const lats = panel.cells.map((c) => c[0]);
  const lons = panel.cells.map((c) => c[1]);
  const box = {
    s: Math.min(...lats) - 0.005,
    n: Math.max(...lats) + 0.005,
    w: Math.min(...lons) - 0.005,
    e: Math.max(...lons) + 0.005,
  };
  const W = 1000;
  const H = Math.round((W * (box.n - box.s)) / (box.e - box.w));
  const x = (lon: number) => ((lon - box.w) / (box.e - box.w)) * W;
  const y = (lat: number) => ((box.n - lat) / (box.n - box.s)) * H;
  const cw = (W / (box.e - box.w)) * 0.01;
  const ch = (H / (box.n - box.s)) * 0.01;
  const inFrame = panel.stations.filter(
    ([lat, lon]) => lat >= box.s && lat <= box.n && lon >= box.w && lon <= box.e
  );

  return (
    <figure className="atlas-panel">
      {/* Edge cells straddle the box boundary, so pad by half a cell each way. */}
      <svg
        viewBox={`${-cw / 2} ${-ch / 2} ${W + cw} ${H + ch}`}
        role="img"
        aria-label={caption}
      >
        {panel.cells.map(([lat, lon, err], i) => (
          <rect
            key={i}
            x={x(lon) - cw / 2}
            y={y(lat) - ch / 2}
            width={cw}
            height={ch}
            fill={err >= 5 ? WARM : err <= -5 ? COOL : FINE}
          >
            <title>
              {`${lat.toFixed(2)}, ${lon.toFixed(2)} — nearest station reads ${
                err > 0 ? "+" : ""
              }${err}°F vs this block`}
            </title>
          </rect>
        ))}
        {inFrame.map(([lat, lon, icao]) => (
          <g key={icao}>
            <circle cx={x(lon)} cy={y(lat)} r={7} fill="#102027" stroke="#fff" strokeWidth={2}>
              <title>{icao}</title>
            </circle>
            <text x={x(lon)} y={y(lat) - 14} textAnchor="middle" className="atlas-tag">
              {icao}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <strong>{panel.metro}</strong> — {caption}
      </figcaption>
    </figure>
  );
}

export default function AtlasMap() {
  const sd = mapData.sd as Panel;
  const fresno = mapData.fresno as Panel;

  return (
    <>
      <div className="atlas-legend">
        <span>
          <i style={{ background: COOL }} />
          Station ≥5°F <strong>cooler</strong> — undersizing risk
        </span>
        <span>
          <i style={{ background: WARM }} />
          Station ≥5°F <strong>hotter</strong> — oversizing risk
        </span>
        <span>
          <i style={{ background: FINE }} />
          Within 5°F — rule works
        </span>
        <span>
          <i className="dot" />
          Weather station
        </span>
      </div>

      <div className="atlas-grid">
        <Map
          panel={sd}
          caption={`${sd.pct}% of blocks misassigned. The coast and the inland valleys sit in one county, separated by the marine layer.`}
        />
        <Map
          panel={fresno}
          caption={`${fresno.pct}% misassigned. A flat, thermally uniform valley — the nearest station is the right station.`}
        />
      </div>
    </>
  );
}
