"""
Assemble the demo video: title cards, live footage, burned-in captions.

No voiceover by design — the organisers require the product shown working, and
captions carry the argument more reliably than narration for an international
panel. Every segment is rendered to a normalised mp4 first, then concatenated,
so the join is frame-exact.

    python3 tools/video/compose.py
"""
import pathlib
import subprocess

CLIPS = pathlib.Path(".tmp/video/clips")
CARDS = pathlib.Path(".tmp/video/cards")
WORK = pathlib.Path(".tmp/video/segments")
OUT = pathlib.Path(".tmp/video/design-delta-demo.mp4")

W, H, FPS = 1600, 900, 30
FADE = 0.45        # opening fade-up and closing fade-out only
XFADE = 0.5        # crossfade between every pair of segments

# (kind, source, seconds, caption or None, start offset into the clip)
TIMELINE = [
    ("card", "t0_open", 5.0, None, 0),
    ("card", "t1_rule", 7.0, None, 0),
    ("clip", "01_hero", 9.0, "c1_hero", 2.2),
    ("card", "t2_question", 5.0, None, 0),
    ("clip", "02_table", 10.0, "c2_table", 2.2),
    ("clip", "03_map_sd", 12.0, "c3_map_sd", 2.4),
    ("clip", "04_map_fresno", 9.0, "c4_map_fresno", 2.4),
    ("clip", "05_sensitivity", 9.0, "c5_sensitivity", 2.4),
    ("card", "t3_cost", 5.0, None, 0),
    ("clip", "06_topanga", 15.0, "c6_topanga", 4.6),
    ("clip", "07_delmar", 13.0, "c7_delmar", 4.6),
    ("clip", "08_downtown", 11.0, "c8_downtown", 4.6),
    # Technical Execution is 35% of the score and the surface shows none of it.
    ("card", "e1_arch", 11.0, None, 0),
    ("card", "e2_api", 12.0, None, 0),
    ("card", "e3_pipeline", 12.0, None, 0),
    ("clip", "09_validation", 11.0, "c9_validation", 2.4),
    ("card", "t4_close", 8.0, None, 0),
]

ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "19",
       "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def build_card(name, dur, dest):
    run(["ffmpeg", "-y", "-loop", "1", "-i", str(CARDS / f"{name}.png"),
         "-t", f"{dur}", "-vf", f"scale={W}:{H}", *ENC, str(dest)])


def build_clip(name, dur, caption, start, dest):
    src = CLIPS / f"{name}.webm"
    if caption:
        # Caption fades in once the shot has settled, then holds to the end.
        flt = (
            f"[0:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"scale={W}:{H},fps={FPS}[v];"
            f"[1:v]format=rgba,fps={FPS},"
            f"fade=t=in:st=0.5:d=0.5:alpha=1[c];"
            f"[v][c]overlay=0:0:shortest=1[out]"
        )
        run(["ffmpeg", "-y", "-i", str(src), "-loop", "1", "-i",
             str(CARDS / f"{caption}.png"), "-filter_complex", flt,
             "-map", "[out]", "-t", f"{dur}", *ENC, str(dest)])
    else:
        run(["ffmpeg", "-y", "-i", str(src), "-ss", f"{start}", "-t", f"{dur}",
             "-vf", f"scale={W}:{H}", *ENC, str(dest)])


def stitch(parts, durations, dest):
    """
    Crossfade every join instead of concatenating fade-outs into fade-ins —
    consecutive shots meeting at black read as chapter breaks and made a
    two-minute film feel twice as long.
    """
    inputs = []
    for p in parts:
        inputs += ["-i", str(p)]

    steps, prev, elapsed = [], "[0:v]", durations[0]
    for i in range(1, len(parts)):
        offset = elapsed - XFADE
        label = "[vout]" if i == len(parts) - 1 else f"[x{i}]"
        steps.append(
            f"{prev}[{i}:v]xfade=transition=fade:duration={XFADE}:"
            f"offset={offset:.3f}{label}"
        )
        prev = label
        elapsed = offset + XFADE + durations[i] - XFADE
    total = elapsed

    chain = ";".join(steps) + (
        f";[vout]fade=t=in:st=0:d={FADE},"
        f"fade=t=out:st={total - FADE:.2f}:d={FADE}[final]"
    )
    run(["ffmpeg", "-y", *inputs, "-filter_complex", chain,
         "-map", "[final]", *ENC, str(dest)])
    return total


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    parts, durations = [], []
    for i, (kind, src, dur, caption, start) in enumerate(TIMELINE):
        dest = WORK / f"{i:02d}_{src}.mp4"
        if kind == "card":
            build_card(src, dur, dest)
        else:
            build_clip(src, dur, caption, start, dest)
        parts.append(dest)
        durations.append(dur)
        print(f"  {dest.name}  {dur}s")

    total = stitch(parts, durations, OUT)
    mins, secs = divmod(total, 60)
    size = OUT.stat().st_size / 1048576
    print(f"\n{OUT}  —  {int(mins)}:{secs:04.1f}  ·  {size:.1f} MB")


if __name__ == "__main__":
    main()
