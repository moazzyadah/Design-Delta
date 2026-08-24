"""
The "under the hood" chapter.

The rest of the film shows the product surface. Technical Execution is 35% of
the score and a FortyGuard judge wants to see their API actually used, so these
cards show the machinery: the architecture, one real request and its real
response, and the pipeline printing the published numbers.

Every value here was captured from a live run — nothing is illustrative.

    python3 tools/video/engine.py
"""
import pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(".tmp/video/cards")
W, H = 1600, 900

CSS = """
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
* { margin: 0; box-sizing: border-box; }
html, body { width: 1600px; height: 900px; background: #102027; }
body { font-family: 'IBM Plex Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased;
       padding: 74px 92px; color: #fff;
       display: flex; flex-direction: column; justify-content: center; }
.kicker { font-family: 'IBM Plex Mono', monospace; font-size: 19px; letter-spacing: .15em;
          text-transform: uppercase; color: #f7913f; margin-bottom: 20px; }
h2 { font-size: 46px; font-weight: 600; letter-spacing: -0.015em; margin-bottom: 30px; }

/* terminal */
.term { background: #0b171d; border: 1px solid rgba(255,255,255,.13); border-radius: 12px;
        padding: 30px 34px; font-family: 'IBM Plex Mono', monospace; font-size: 21px;
        line-height: 1.72; color: rgba(255,255,255,.9); }
.term .p { color: #f7913f; }
.term .c { color: rgba(255,255,255,.45); }
.term .g { color: #7fd6a8; }
.term .b { color: #6cc4e2; }
.term .dim { color: rgba(255,255,255,.62); }

/* architecture */
.arch { display: flex; align-items: stretch; gap: 18px; margin-top: 12px; }
.box { flex: 1; background: #16292f; border: 1px solid rgba(255,255,255,.14);
       border-radius: 12px; padding: 24px 22px; }
.box.hi { border-color: #f7913f; background: #1d2b2c; }
.box .n { font-family: 'IBM Plex Mono', monospace; font-size: 15px; color: #f7913f;
          letter-spacing: .12em; margin-bottom: 12px; }
.box h3 { font-size: 25px; font-weight: 600; margin-bottom: 10px; }
.box p { font-size: 17px; line-height: 1.5; color: rgba(255,255,255,.68); }
.arrow { display: flex; align-items: center; color: rgba(255,255,255,.3); font-size: 30px; }

.scale { display: flex; gap: 54px; margin-top: 44px; }
.scale div .v { font-size: 54px; font-weight: 600; letter-spacing: -0.02em; }
.scale div .l { font-size: 17px; color: rgba(255,255,255,.6); margin-top: 4px; }
"""

CARDS = {
    "e1_arch": """
<div class="kicker">Under the hood</div>
<h2>Four stages, 834 lines, no manual steps</h2>
<div class="arch">
  <div class="box hi">
    <div class="n">01 · FETCH</div><h3>FortyGuard</h3>
    <p>350 heatmap reads. <code>tcm</code> for peak, <code>exceedance</code> for the
    tail. 100 m tiles, July 2024. Resumable — every response cached to disk.</p>
  </div>
  <div class="arrow">&rarr;</div>
  <div class="box">
    <div class="n">02 · VALIDATE</div><h3>NOAA</h3>
    <p>Modelled station peak against NOAA's measured maximum. Independent source,
    free, keyless. Nothing ships unchecked.</p>
  </div>
  <div class="arrow">&rarr;</div>
  <div class="box">
    <div class="n">03 · ANALYSE</div><h3>The atlas</h3>
    <p>Tiles pooled to 1 km cells. Nearest station vs best thermal match, for
    every cell, against every station within 40 miles.</p>
  </div>
  <div class="arrow">&rarr;</div>
  <div class="box hi">
    <div class="n">04 · FREEZE</div><h3>Static cache</h3>
    <p>5,300 cells to JSON. The demo answers with no API key at all — so it keeps
    working after access ends on 30 August.</p>
  </div>
</div>
<div class="scale">
  <div><div class="v">350</div><div class="l">FortyGuard reads · 0 failed</div></div>
  <div><div class="v">5,299</div><div class="l">blocks analysed</div></div>
  <div><div class="v">42</div><div class="l">stations checked vs NOAA</div></div>
  <div><div class="v">0</div><div class="l">API calls the live demo needs</div></div>
</div>
""",
    "e2_api": """
<div class="kicker">One real request</div>
<h2>Submit, poll, read the tiles</h2>
<div class="term">
<span class="p">$</span> curl -X POST https://api.fortyguard.com/v1/heatmap \\<br>
&nbsp;&nbsp;-H <span class="g">"api-key: $FORTYGUARD_API_KEY"</span> -d '{<br>
&nbsp;&nbsp;&nbsp;&nbsp;<span class="b">"polygon_aoi"</span>: { ...Topanga, 0.02&deg; box... },<br>
&nbsp;&nbsp;&nbsp;&nbsp;<span class="b">"date_time"</span>: { "filter_type": 4, "start_date": "2024-07-01", ... },<br>
&nbsp;&nbsp;&nbsp;&nbsp;<span class="b">"granularity"</span>: 100, <span class="b">"analytic_type"</span>: "tcm" }'<br>
<span class="dim">{"error":false,"status_code":200,</span><br>
&nbsp;<span class="dim">"data":{"activity_id":"80180239-ced8-4b84-96d1-51049836ac65"}}</span><br>
<br>
<span class="p">$</span> curl .../v1/status/80180239-ced8-4b84-96d1-51049836ac65<br>
<span class="g">status: Completed</span> <span class="c">|</span> tiles: <span class="g">389</span>
<span class="c">|</span> min <span class="g">21.0</span> mean <span class="g">22.9</span> max <span class="g">24.6</span> <span class="c">&deg;C</span>
</div>
<div class="scale" style="margin-top:34px">
  <div><div class="v" style="font-size:30px;color:rgba(255,255,255,.72);font-weight:400">
  Async submit-then-poll. <span style="color:#f7913f">start_time is local to the AOI, not UTC</span>
  — and ranges over a month return an error, so every fetch chunks monthly.</div></div>
</div>
""",
    "e3_pipeline": """
<div class="kicker">The pipeline, run end to end</div>
<h2>Every published number comes out of this</h2>
<div class="term">
<span class="p">$</span> node tools/atlas/build-full.mjs<br>
&nbsp;&nbsp;Fresno<span class="c">.......</span> cells=<span class="g">861</span>&nbsp;&nbsp; stations=<span class="g">5</span>&nbsp;&nbsp;&nbsp;
<span class="c">&rarr;</span> <span class="g">0.0%</span> misassigned<br>
&nbsp;&nbsp;Los Angeles<span class="c">..</span> cells=<span class="g">2677</span>&nbsp; stations=<span class="g">27</span>&nbsp;&nbsp;
<span class="c">&rarr;</span> <span class="b">11.8%</span> misassigned<br>
&nbsp;&nbsp;San Diego<span class="c">....</span> cells=<span class="g">1761</span>&nbsp; stations=<span class="g">13</span>&nbsp;&nbsp;
<span class="c">&rarr;</span> <span class="b">26.2%</span> misassigned<br>
<br>
<span class="p">$</span> node tools/atlas/validate.mjs<br>
&nbsp;&nbsp;<span class="g">42 stations, median |delta| 4.2&deg;F, r 0.969</span><br>
<br>
<span class="p">$</span> node tools/atlas/freeze.mjs<br>
&nbsp;&nbsp;wrote data/block_cache.json <span class="c">&mdash;</span>
<span class="g">5300 rows</span>, <span class="g">143 KB</span>
</div>
<div class="scale" style="margin-top:34px">
  <div><div class="v" style="font-size:30px;color:rgba(255,255,255,.72);font-weight:400">
  Public repo, MIT. <span style="color:#f7913f">Clone it and every figure on the site
  regenerates</span> from the same four commands.</div></div>
</div>
""",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H})
        for name, html in CARDS.items():
            pg.set_content(f"<style>{CSS}</style>{html}", wait_until="networkidle")
            pg.wait_for_timeout(250)
            pg.screenshot(path=str(OUT / f"{name}.png"))
            print(f"  {name}.png")
        b.close()


if __name__ == "__main__":
    main()
