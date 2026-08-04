#!/usr/bin/env python3
"""Generate client/public/patterns/honeycomb.png — graphite cells, brass seam glow."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'client' / 'public' / 'patterns' / 'honeycomb.png'

BG = (22, 23, 26)  # --color-bg
CELL = (27, 28, 31)
CELL_TOP = (38, 39, 43)
CELL_BOT = (18, 19, 21)
GAP = (12, 13, 15)
BRASS = (217, 162, 79)  # --color-accent

SCALE = 2
SIZE = 20 * SCALE
W = math.sqrt(3) * SIZE
ROW_H = SIZE * 1.5
TW = int(round(W * 2))
TH = int(round(SIZE * 3))
BLEND = 0.52  # mix toward page bg for quiet contrast


def hex_pts(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
    return [
        (cx + r * math.sin(math.radians(a)), cy - r * math.cos(math.radians(a)))
        for a in range(0, 360, 60)
    ]


def main() -> None:
    pad = SIZE * 2
    iw, ih = TW + pad * 2, TH + pad * 2
    base = Image.new('RGB', (iw, ih), GAP)
    glow = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
    cells = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
    gd, cd = ImageDraw.Draw(glow), ImageDraw.Draw(cells)

    centers: list[tuple[float, float]] = []
    for row in range(-2, 10):
        for col in range(-2, 10):
            cx = pad + col * W + ((W / 2) if row % 2 else 0)
            cy = pad + row * ROW_H
            centers.append((cx, cy))

    for cx, cy in centers:
        gd.polygon(hex_pts(cx, cy, SIZE + 1.6), fill=(*BRASS, 52))
        gd.polygon(hex_pts(cx, cy, SIZE - 4.0), fill=(0, 0, 0, 0))
    glow = glow.filter(ImageFilter.GaussianBlur(2.4))

    for cx, cy in centers:
        r = SIZE - 1.8
        cd.polygon(hex_pts(cx, cy, r), fill=(*CELL, 255))
        cd.polygon(hex_pts(cx, cy - 1.6, r - 4.0), fill=(*CELL_TOP, 60))
        cd.polygon(hex_pts(cx, cy + 2.0, r - 4.8), fill=(*CELL_BOT, 85))
        cd.line(hex_pts(cx, cy, r) + [hex_pts(cx, cy, r)[0]], fill=(*BRASS, 32), width=1)

    out = Image.alpha_composite(Image.alpha_composite(base.convert('RGBA'), glow), cells)
    tile = out.crop((pad, pad, pad + TW, pad + TH)).convert('RGB')
    tile = Image.blend(Image.new('RGB', tile.size, BG), tile, BLEND)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tile.save(OUT, optimize=True)
    print(f'OK · {OUT.relative_to(ROOT)} · {tile.size[0]}×{tile.size[1]}')


if __name__ == '__main__':
    main()
