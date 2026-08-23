import LookupForm from "./lookup-form";
import AtlasMap from "./atlas-map";
import summary from "@/data/atlas/summary_full.json";
import validation from "@/data/atlas/validation.json";

export default function Home() {
  const atlas = summary.metros;

  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">FortyGuard Hackathon&apos;26</span>
          <h1>
            One weather station
            <br />
            stands in for your block.
          </h1>
          <p className="lead">
            Every route to sizing a US home&apos;s air conditioning — Manual J for
            a permit, RESNET Standard 310 for a rated or tax-credit home, Title
            24 in California — begins with one outdoor design temperature drawn
            from one weather station that represents a whole area. That station
            can sit forty miles and three thousand feet from the house it speaks
            for. Type an address and see what it misses.
          </p>
          <div style={{ marginTop: 40 }}>
            <LookupForm />
          </div>
        </div>
      </section>

      <section className="chapter" id="evidence">
        <div className="wrap">
          <h2>How often is the nearest station the wrong one?</h2>
          <p className="lead">
            We gridded three California metros into 1 km blocks and compared each
            block&apos;s modelled July peak against every real weather station within
            forty miles. The answer depends entirely on terrain — which is the
            point.
          </p>

          <table className="evidence">
            <thead>
              <tr>
                <th>Metro</th>
                <th>Blocks</th>
                <th>Nearest station off by 5°F or more</th>
                <th>Median error</th>
                <th>Worst block</th>
              </tr>
            </thead>
            <tbody>
              {[atlas.sd, atlas.la, atlas.fresno].map((m) => (
                <tr key={m.metro}>
                  <td>{m.metro}</td>
                  <td>{m.cells.toLocaleString()}</td>
                  <td
                    className={`big ${
                      m.pctNearestOffBy5F >= 5 ? "hot" : ""
                    }`}
                  >
                    {m.pctNearestOffBy5F}%
                  </td>
                  <td>{m.medianAbsErrF}°F</td>
                  <td>
                    {m.worst.errNearestF > 0 ? "+" : ""}
                    {m.worst.errNearestF}°F · {m.worst.nearest}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <figcaption>
            Fresno is the control, and it is doing real work: in a flat valley the
            nearest-station rule is almost exactly right, so a tool that flagged
            problems there would be flagging noise. The errors concentrate where
            physical geography says they should, and they run in{" "}
            <strong>both directions</strong> — {atlas.sd.pctTooCool}% of San Diego
            blocks are assigned a station that reads too cool, {atlas.sd.pctTooHot}%
            one that reads too hot. Almost every material error disappears when the
            block is matched to a better station instead:{" "}
            {atlas.sd.pctFixableBy5F} of {atlas.sd.pctNearestOffBy5F}% in San Diego.
          </figcaption>

          <AtlasMap />

          <figcaption style={{ marginTop: 24 }}>
            <strong>Is the model itself trustworthy?</strong> We checked its
            modelled July peak against NOAA&apos;s measured maximum at{" "}
            {validation.stationsCompared} stations: median difference{" "}
            {validation.medianAbsDeltaF}°F, correlation r ={" "}
            {validation.pearsonR}. It preserves the station-to-station ordering the
            matching depends on. Its one systematic bias compresses the
            coastal-inland gradient — coastal stations read about{" "}
            {validation.coastalMeanBiasF}°F warm, hot interior stations{" "}
            {validation.interiorMeanBiasF}°F cool — which means the rates above are
            understated rather than inflated.
          </figcaption>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <h2>How the number is chosen</h2>
          <p>
            ANSI/RESNET/ACCA 310-2020 Appendix A assigns every US county a
            cooling design temperature limit. Where several stations fall inside
            the county or within forty miles of its centre, the standard takes
            the <strong>highest</strong> of them. In a county that spans coast,
            valley and desert, the desert wins.
          </p>
          <p style={{ marginTop: 16 }}>
            <strong>Where that limit binds.</strong> Standard 310 is a grading
            standard — by its own text it exists &ldquo;to support consistency in
            energy rating and labeling&rdquo; and is written for raters, auditors
            and HVAC contractors. Its ceiling governs HERS-rated homes, ENERGY
            STAR certification and the 45L tax credit — roughly 420,000 US homes
            a year. Ordinary permitted work uses Manual J&apos;s own design
            conditions, and California uses Title 24. Different tables, same
            structure: one station, assigned to an area, standing in for every
            block inside it. This tool measures that substitution; it does not
            claim any one of those tables is misapplied.
          </p>

          <div className="steps">
            <div className="step">
              <div className="n">01</div>
              <h3>Find the county</h3>
              <p>
                The US Census geocoder turns the address into coordinates and the
                county that governs it.
              </p>
            </div>
            <div className="step">
              <div className="n">02</div>
              <h3>Read the limit</h3>
              <p>
                Appendix A gives the county&apos;s ceiling and names the station
                the value came from.
              </p>
            </div>
            <div className="step">
              <div className="n">03</div>
              <h3>Model the block</h3>
              <p>
                FortyGuard&apos;s Large Temperature Model returns estimated air
                temperature over the address at 100-metre tiles, plus the hours
                it spent above the county limit.
              </p>
            </div>
            <div className="step">
              <div className="n">04</div>
              <h3>Flag what matters</h3>
              <p>
                Practitioner guidance widely treats a 5°F discrepancy as worth a
                second look. We say plainly whether the gap clears it.
              </p>
            </div>
          </div>

          <p style={{ marginTop: 40 }}>
            Substituting a nearer, better-matched station is already permitted
            where the local building authority allows it — Manual J software
            supports it directly. What has been missing is evidence for the
            house in front of you. That is all this is.
          </p>
        </div>
      </section>
    </main>
  );
}
