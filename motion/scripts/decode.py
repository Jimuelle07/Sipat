"""Decodes exact frames from a rendered MP4 with Remotion's bundled ffmpeg (accurate seek, one frame each).
python scripts/decode.py <video.mp4> <outDir> <width|0> <frame> [frame ...]  ->  <outDir>/f<frame>.png
Width 0 keeps full resolution. Assumes 60 fps.
"""
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

video, out, width, *frames = sys.argv[1:]
ffmpeg = next((Path(__file__).resolve().parent.parent / "node_modules" / "@remotion").glob("compositor-*/ffmpeg*"))
out_dir = Path(out)
out_dir.mkdir(parents=True, exist_ok=True)


def grab(n: int) -> None:
    target = out_dir / f"f{n:04d}.png"
    # Frame n has pts n/60; accurate seek returns the first frame at or after the time.
    subprocess.run([str(ffmpeg), "-v", "error", "-y", "-ss", f"{max(0, n / 60 - 0.001):.4f}", "-i", video, "-frames:v", "1", str(target)], check=True)
    if int(width):
        im = Image.open(target)
        im.resize((int(width), round(im.height * int(width) / im.width)), Image.LANCZOS).save(target)


picks = sorted({int(f) for f in frames})
with ThreadPoolExecutor(6) as pool:
    list(pool.map(grab, picks))
print(f"{len(picks)} frames -> {out_dir}")
