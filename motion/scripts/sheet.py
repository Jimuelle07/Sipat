"""Contact sheet: python scripts/sheet.py <out.png> <cols> <img> [img ...]. Labels each tile with its frame time."""
import re
import sys

from PIL import Image, ImageDraw, ImageFont

out, cols, *paths = sys.argv[1:]
cols = int(cols)
pad, label = 12, 30
w0, h0 = Image.open(paths[0]).size
tw, th = (640, 360) if w0 >= h0 else (360, 640)
rows = (len(paths) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + label + pad) + pad), (16, 22, 32))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("arial.ttf", 18)
except OSError:
    font = ImageFont.load_default()
for i, p in enumerate(paths):
    im = Image.open(p).convert("RGB")
    im.thumbnail((tw, th), Image.LANCZOS)
    x = pad + (i % cols) * (tw + pad)
    y = pad + (i // cols) * (th + label + pad)
    sheet.paste(im, (x, y + label))
    m = re.search(r"(\d+)\.png$", p)
    text = f"f{int(m.group(1))}  {int(m.group(1)) / 60:.2f}s" if m else p
    draw.text((x, y + 6), text, fill=(227, 239, 251), font=font)
sheet.save(out)
print(out)
