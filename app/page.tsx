import LookupForm from "./lookup-form";
import evidence from "@/data/evidence.json";

export default function Home() {
  const [station, home] = evidence.sites;

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
          <h2>One county, one number, two different climates</h2>
          <p className="lead">
            San Diego County&apos;s Standard 310 cap is 105°F, drawn from Borrego
            Desert Park in the Anza-Borrego desert. The same county reaches the
            coast, sixty miles west across a mountain range. Here is what each place actually did in the
            same month, modelled at 100-metre resolution.
          </p>

          <table className="evidence">
            <thead>
              <tr>
                <th>Location</th>
                <th>Role</th>
                <th>Hours above 105°F, July 2024</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Borrego Desert</td>
                <td>Sets the county number</td>
                <td className="big hot">{Math.round(station.hours_above_ceiling.mean)} hours</td>
              </tr>
              <tr>
                <td>La Jolla, on the coast</td>
                <td>Sized by that same number</td>
                <td className="big">{home.hours_above_ceiling.mean} hours</td>
              </tr>
            </tbody>
          </table>

          <figcaption>
            Both rows are live FortyGuard exceedance reads over 744 hours —
            activity <span className="mono">{station.activity_id.slice(0, 8)}</span> across{" "}
            {station.tiles} tiles and{" "}
            <span className="mono">{home.activity_id.slice(0, 8)}</span> across{" "}
            {home.tiles} tiles. The cap is deliberately permissive so a legitimate Borrego
            design is not rejected — which is exactly why it cannot describe the
            coast.
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
