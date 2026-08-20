import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Delta — the design temperature your HVAC is sized with",
  description:
    "US HVAC equipment is sized against one design temperature per county. Type an address and see the number the code allows next to the number your own block actually reaches.",
  openGraph: {
    title: "Design Delta",
    description:
      "One design temperature per county. Your block is not the county. See the gap.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-head">
          <div className="wrap">
            <a className="brand" href="/">
              <span className="dot" />
              <b>Design Delta</b>
            </a>
            <nav className="head-links">
              <a href="#how">How it works</a>
              <a href="#evidence">Evidence</a>
            </nav>
          </div>
        </header>

        {children}

        <footer className="site-foot">
          <div className="wrap">
            <p>
              Built for FortyGuard Hackathon&apos;26 on the FortyGuard Temperature
              API. County limits from ANSI/RESNET/ACCA 310-2020 Appendix A;
              geocoding by the US Census Bureau.
            </p>
            <p style={{ marginTop: 8 }}>
              A study aid, not a Manual J calculation. Substituting a design
              temperature is a decision for a licensed professional and your
              local building authority.{" "}
              <a href="https://wsool.ai">Wsool</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
