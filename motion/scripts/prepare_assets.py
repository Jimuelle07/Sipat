"""Builds motion/public from the app's real assets (read-only): trimmed mascots, the Ionicons
font the app renders its icons with, and a paper-grain tile. Run from motion/: python scripts/prepare_assets.py
"""
import json
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

MOTION = Path(__file__).resolve().parent.parent
REPO = MOTION.parent
PUBLIC = MOTION / "public"
BLOCK = 8  # component labelling runs on an 8x max-pooled alpha mask


def main_silhouette(alpha: np.ndarray) -> np.ndarray:
    """Keeps the connected regions that make up the character, dropping stray paint specks."""
    h, w = alpha.shape
    small = alpha[: h - h % BLOCK, : w - w % BLOCK].reshape(h // BLOCK, BLOCK, w // BLOCK, BLOCK).max(axis=(1, 3)) > 24
    labels = np.zeros(small.shape, dtype=np.int32)
    areas = [0]
    for y, x in zip(*np.nonzero(small)):
        if labels[y, x]:
            continue
        label = len(areas)
        labels[y, x] = label
        queue, area = deque([(y, x)]), 0
        while queue:
            cy, cx = queue.popleft()
            area += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < small.shape[0] and 0 <= nx < small.shape[1] and small[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
        areas.append(area)
    largest = max(areas)
    keep_ids = [i for i, a in enumerate(areas) if i and a >= largest * 0.02]
    keep = np.isin(labels, keep_ids)
    # One block of dilation so anti-aliased edges are never clipped by the coarse mask.
    grown = keep.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        grown |= np.roll(np.roll(keep, dy, axis=0), dx, axis=1)
    full = np.kron(grown, np.ones((BLOCK, BLOCK), dtype=bool))
    out = np.zeros((h, w), dtype=bool)
    out[: full.shape[0], : full.shape[1]] = full
    return out


def mascots() -> dict:
    meta = {}
    (PUBLIC / "mascot").mkdir(parents=True, exist_ok=True)
    for name in ("before", "during", "after"):
        im = Image.open(REPO / "assets" / "character" / f"{name}.png").convert("RGBA")
        rgba = np.array(im)
        rgba[..., 3] = np.where(main_silhouette(rgba[..., 3]), rgba[..., 3], 0)
        trimmed = Image.fromarray(rgba)
        box = trimmed.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        trimmed = trimmed.crop(box)
        height = 1400
        trimmed = trimmed.resize((round(trimmed.width * height / trimmed.height), height), Image.LANCZOS)
        trimmed.save(PUBLIC / "mascot" / f"{name}.png", optimize=True)
        # box is in the original 3072x4096 canvas, so the film can keep the art's own relative scale.
        meta[name] = {"w": trimmed.width, "h": trimmed.height, "box": list(box), "canvas": [im.width, im.height]}
        print(name, box, trimmed.size)
    return meta


def icons() -> None:
    src = REPO / "node_modules" / "@expo" / "vector-icons" / "build" / "vendor" / "react-native-vector-icons"
    (PUBLIC / "fonts").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src / "Fonts" / "Ionicons.ttf", PUBLIC / "fonts" / "Ionicons.ttf")
    glyphs = json.loads((src / "glyphmaps" / "Ionicons.json").read_text(encoding="utf-8"))
    used = [
        "airplane", "alert-circle", "arrow-undo", "battery-full", "camera", "chatbubble-ellipses-outline",
        "checkmark", "checkmark-circle", "chevron-down", "chevron-up", "close", "document-text-outline",
        "home", "book-outline", "call-outline", "people-outline", "sparkles", "warning", "search",
        "send", "cellular",
    ]
    (MOTION / "src" / "lib" / "ionicons.json").write_text(json.dumps({k: glyphs[k] for k in used}, indent=1), encoding="utf-8")


def app_icon() -> None:
    # The header avatar the app's Screen.tsx renders (assets/agi-sipat-logo.png), for the final phone screen.
    shutil.copyfile(REPO / "assets" / "agi-sipat-logo.png", PUBLIC / "app-icon.png")


def grain() -> None:
    rng = np.random.default_rng(7)
    noise = rng.normal(128, 40, (512, 512)).clip(0, 255).astype(np.uint8)
    Image.fromarray(noise, "L").save(PUBLIC / "grain.png", optimize=True)


if __name__ == "__main__":
    meta = mascots()
    (MOTION / "src" / "lib" / "mascots.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    icons()
    app_icon()
    grain()
