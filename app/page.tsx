const rows = [
  { county: "San Diego", ceiling: 105, station: "Borrego Desert Park", coast: 81 },
  { county: "Los Angeles", ceiling: 102, station: "Hillcrest Center", coast: 78 },
  { county: "Alameda", ceiling: 97, station: "Concord", coast: 80 },
];

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>Design Delta</h1>
      <p style={{ fontSize: "1.1rem", color: "#9fb0c9", lineHeight: 1.6 }}>
        In the US, the HVAC system in your home is sized against a single
        county-wide design temperature ceiling — often set by a weather station
        nowhere near you. Type your address, see the number the code allows,
        the number your nearest station measures, and the number your own block
        actually reaches.
      </p>
      <table style={{ marginTop: "2rem", borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9fb0c9" }}>
            <th style={{ padding: "0.5rem 0" }}>County</th>
            <th>Legal ceiling</th>
            <th>Governing station</th>
            <th>Coastal blocks measure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.county} style={{ borderTop: "1px solid #223049" }}>
              <td style={{ padding: "0.6rem 0" }}>{r.county}</td>
              <td>{r.ceiling}°F</td>
              <td>{r.station}</td>
              <td>~{r.coast}°F</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "2rem", color: "#6d7f9b" }}>
        Full address lookup launching for FortyGuard Hackathon&apos;26.
      </p>
    </main>
  );
}
