"""
Record the demo footage straight off the live site.

One Playwright context per shot, so each produces its own clean clip with no
cutting needed. Pacing is deliberate: the caption burned on later has to be
readable, so every shot holds well past the point where the page has settled.

    python3 tools/video/record.py
"""
import pathlib
import shutil
from playwright.sync_api import sync_playwright

SITE = "https://design-delta.wsool.ai/"
OUT = pathlib.Path(".tmp/video/clips")
W, H = 1600, 900

# (name, seconds, action) — action drives the page, then the clip holds.
SHOTS = []


def shot(name, secs):
    def deco(fn):
        SHOTS.append((name, secs, fn))
        return fn
    return deco


def settle(pg, ms=900):
    pg.wait_for_timeout(ms)


def glide(pg, selector, extra=0):
    """Scroll a section to a stable position rather than snapping to it."""
    pg.evaluate(
        """([sel, extra]) => {
            const el = document.querySelector(sel);
            const y = el.getBoundingClientRect().top + window.scrollY - 90 + extra;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }""",
        [selector, extra],
    )
    pg.wait_for_timeout(1400)


def centre(pg, selector, index=0):
    """Put one specific element in the middle of frame — the caption names it,
    so it has to be the thing on screen."""
    pg.evaluate(
        """([sel, i]) => {
            const el = document.querySelectorAll(sel)[i];
            const r = el.getBoundingClientRect();
            const y = r.top + window.scrollY - (window.innerHeight - r.height) / 2;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }""",
        [selector, index],
    )
    pg.wait_for_timeout(1500)


@shot("01_hero", 11)
def _(pg):
    settle(pg, 1600)


@shot("02_table", 10)
def _(pg):
    glide(pg, "#evidence")


@shot("03_map_sd", 12)
def _(pg):
    centre(pg, ".atlas-panel", 0)


@shot("04_map_fresno", 9)
def _(pg):
    centre(pg, ".atlas-panel", 1)


@shot("05_sensitivity", 9)
def _(pg):
    glide(pg, ".sensitivity", extra=-40)


@shot("06_topanga", 15)
def _(pg):
    pg.get_by_role("button", name="Topanga").click()
    pg.wait_for_selector(".verdict", timeout=30000)
    pg.wait_for_timeout(700)
    glide(pg, ".numbers")


@shot("07_delmar", 14)
def _(pg):
    pg.get_by_role("button", name="Del Mar").click()
    pg.wait_for_selector(".verdict", timeout=30000)
    pg.wait_for_timeout(700)
    glide(pg, ".numbers")


@shot("08_downtown", 12)
def _(pg):
    pg.get_by_role("button", name="Los Angeles").click()
    pg.wait_for_selector(".verdict", timeout=30000)
    pg.wait_for_timeout(700)
    glide(pg, ".numbers")


@shot("09_validation", 11)
def _(pg):
    # The validation paragraph is the last figcaption in the dark chapter.
    centre(pg, "#evidence figcaption", 1)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--force-prefers-reduced-motion=false"])
        for name, secs, action in SHOTS:
            raw = OUT / f"_{name}"
            ctx = browser.new_context(
                viewport={"width": W, "height": H},
                device_scale_factor=1,
                record_video_dir=str(raw),
                record_video_size={"width": W, "height": H},
            )
            pg = ctx.new_page()
            pg.goto(SITE, wait_until="networkidle")
            pg.wait_for_timeout(400)
            action(pg)
            pg.wait_for_timeout(int(secs * 1000))
            ctx.close()

            produced = next(raw.glob("*.webm"))
            produced.rename(OUT / f"{name}.webm")
            shutil.rmtree(raw)
            print(f"  {name}.webm")
        browser.close()

    print(f"\n{len(SHOTS)} clips in {OUT}")


if __name__ == "__main__":
    main()
