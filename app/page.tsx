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
            One design temperature
            <br />
            per county.
          </h1>
          <p className="lead">
            Every air conditioner installed under a US permit is sized against a
            single outdoor design temperature — one number covering an entire
            county, taken from one weather station that may sit forty miles and
            three thousand feet away from the house it governs. Type an address
            and see that number next to what the block actually reaches.
          </p>
          <div style={{ marginTop: 40 }}>
            <LookupForm />
          </div>
        </div>
      </section>

      <section className="chapter" id="evidence">
        <div className="wrap">
          <h2>San Diego County, one legal number: 105°F</h2>
          <p className="lead">
            That limit is set by Borrego Desert Park, a station in the
            Anza-Borrego desert. It also governs the coast, sixty miles west
            across a mountain range. Here is what each place actually did in the
            same month, measured at 100-metre resolution.
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
            {home.tiles} tiles. A house on the coast is sized for a desert it
            never experiences.
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
              <h3>Measure the block</h3>
              <p>
                FortyGuard returns air temperature over the address at 100-metre
                tiles, plus the hours it spent above the county limit.
              </p>
            </div>
            <div className="step">
              <div className="n">04</div>
              <h3>Apply ACCA&apos;s own bar</h3>
              <p>
                ACCA treats a 5°F discrepancy as worth correcting. We say plainly
                whether the gap clears it.
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
