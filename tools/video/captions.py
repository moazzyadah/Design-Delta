"""
Render every caption and title card as a transparent PNG, using the site's own
typography so the burned-in layer reads as part of the product rather than as
something bolted on afterwards.

    python3 tools/video/captions.py
"""
import pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(".tmp/video/cards")
W, H = 1600, 900

INK = "#102027"
CORAL = "#f7913f"

CSS = """
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
* { margin: 0; box-sizing: border-box; }
html, body { width: 1600px; height: 900px; background: transparent; }
body { font-family: 'IBM Plex Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

/* Lower-third caption over live footage. */
.cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 130px 96px 64px;
       background: linear-gradient(to top, rgba(16,32,39,.97) 42%, rgba(16,32,39,0)); }
.cap .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: .14em;
               text-transform: uppercase; color: #f7913f; margin-bottom: 14px; }
.cap .line { font-size: 40px; line-height: 1.28; color: #fff; font-weight: 500;
             max-width: 1230px; letter-spacing: -0.01em; }
.cap .line b { font-weight: 600; color: #ffc48c; }
.cap .sub { margin-top: 16px; font-size: 24px; color: rgba(255,255,255,.7); max-width: 1130px; }

/* Full-screen title card between chapters. */
.title { position: absolute; inset: 0; background: #102027; display: flex;
         flex-direction: column; justify-content: center; padding: 0 120px; }
.title .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 21px; letter-spacing: .16em;
                 text-transform: uppercase; color: #f7913f; margin-bottom: 26px; }
.title h1 { font-size: 76px; line-height: 1.1; color: #fff; font-weight: 600;
            max-width: 1280px; letter-spacing: -0.02em; }
.title p { margin-top: 28px; font-size: 30px; line-height: 1.5;
           color: rgba(255,255,255,.72); max-width: 1120px; }
.title .quote { border-left: 4px solid #f7913f; padding-left: 30px; }
"""


def cap(kicker, line, sub=None):
    s = f'<div class="sub">{sub}</div>' if sub else ""
    return f'<div class="cap"><div class="kicker">{kicker}</div><div class="line">{line}</div>{s}</div>'


def title(kicker, h1, p=None, quote=False):
    body = f'<p>{p}</p>' if p else ""
    cls = "title quote" if quote else "title"
    inner = f'<div class="{"quote" if quote else ""}"><h1>{h1}</h1>{body}</div>'
    return f'<div class="title"><div class="kicker">{kicker}</div>{inner}</div>'


CARDS = {
    # ── title cards ─────────────────────────────────────────────
    "t0_open": title(
        "FortyGuard Hackathon'26 · Future Buildings &amp; Energy",
        "Design&nbsp;Delta",
        "Every air conditioner in an American home is sized from one number — "
        "and that number comes from a weather station.",
    ),
    "t1_rule": title(
        "The rule",
        "&ldquo;the weather station that&rsquo;s <span style='color:#f7913f'>geographically closest</span> to the home&rdquo;",
        "EPA · ENERGY STAR guidance for residential design temperatures",
        quote=True,
    ),
    "t2_question": title(
        "The question",
        "How often is the closest station the wrong one?",
        "We tiled three California metros with FortyGuard reads and checked every block.",
    ),
    "t3_cost": title(
        "What it costs",
        "The wrong station buys the wrong equipment.",
        "Same archetype house, sized from each temperature.",
    ),
    "t4_close": title(
        "design-delta.wsool.ai",
        "420,135 US homes were rated this way last year.",
        "A one-page check on the first number every one of them starts from. "
        "No login — and it keeps answering after the API key expires.",
    ),
    # ── lower-third captions ────────────────────────────────────
    "c1_hero": cap(
        "The problem",
        "Closest on a map is <b>not</b> closest in climate.",
        "A house can sit four miles from its station — and on the other side of a marine layer.",
    ),
    "c2_table": cap(
        "The measurement",
        "5,299 blocks · Los Angeles, San Diego, Fresno · July 2024",
        "Every block compared against the station a designer would actually be told to use.",
    ),
    "c3_map_sd": cap(
        "San Diego · 26.2% misassigned",
        "Orange: the station reads too <b>hot</b>. Blue: too <b>cold</b>.",
        "The pattern is the marine layer. One county, two climates, one station each.",
    ),
    "c4_map_fresno": cap(
        "Fresno · the control",
        "A flat, uniform valley: <b>0%</b>.",
        "The tool does not cry wolf. It flags terrain, and only terrain.",
    ),
    "c5_sensitivity": cap(
        "Is the answer just the threshold?",
        "Fresno stays at <b>0%</b> at every bar from 3°F to 10°F.",
        "The 5°F bar is a practitioner rule of thumb, so we publish the whole curve.",
    ),
    "c6_topanga": cap(
        "Topanga, Santa Monica mountains",
        "Its nearest station reads <b>14.7°F cooler</b> than this block.",
        "Size from KSMO and you buy 1.5 tons for a house that needs 2. It will not hold in a heat wave.",
    ),
    "c7_delmar": cap(
        "Del Mar, on the coast",
        "The opposite error: the station reads <b>14.1°F too hot</b>.",
        "2 tons for a house that needs 1.5 — oversized, short-cycling, and it never pulls the humidity out.",
    ),
    "c8_downtown": cap(
        "Downtown Los Angeles",
        "Nearest station 5.2 km away, <b>0.9°F</b> off. The tool says so.",
        "Saying nothing is wrong matters as much as catching what is.",
    ),
    "c9_validation": cap(
        "Is the model itself trustworthy?",
        "Checked against NOAA at <b>42 stations</b>.",
        "Its one bias compresses the coast-inland gradient — so these numbers are understated, not inflated.",
    ),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H})
        for name, html in CARDS.items():
            pg.set_content(
                f"<style>{CSS}</style>{html}", wait_until="networkidle"
            )
            pg.wait_for_timeout(250)
            pg.screenshot(path=str(OUT / f"{name}.png"), omit_background=True)
            print(f"  {name}.png")
        b.close()
    print(f"\n{len(CARDS)} cards in {OUT}")


if __name__ == "__main__":
    main()
