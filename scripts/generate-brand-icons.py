#!/usr/bin/env python3
"""Regenerate Spotter logos / favicons from Downloads/logo.png (or --src).

Transparent PNG throughout. Applies a cover-zoom so empty field around the
figure is reduced (~94% fill for UI; ~72% for maskable safe-zone).
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

FILL_UI = 0.88
FILL_MASKABLE = 0.72
ALPHA_THRESH = 12
# Design token --color-accent-100 — light brass plate behind the figure.
PLATE_RGB = (251, 243, 230)  # #fbf3e6

GLYPH_SIZES = [
    16,
    20,
    24,
    28,
    32,
    36,
    40,
    44,
    48,
    56,
    64,
    72,
    80,
    96,
    128,
    180,
    192,
    256,
    384,
    512,
]
SIDEBAR_SIZES = [24, 28, 32, 36, 40, 48, 56, 64]
FAVICON_SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512]
PWA_SIZES = [192, 512]
MAC_ICONSET = [
    (16, 1),
    (16, 2),
    (32, 1),
    (32, 2),
    (128, 1),
    (128, 2),
    (256, 1),
    (256, 2),
    (512, 1),
    (512, 2),
]


def solid_bbox(im: Image.Image, thresh: int = ALPHA_THRESH):
    mask = im.split()[-1].point(lambda a: 255 if a >= thresh else 0)
    return mask.getbbox() or (0, 0, im.width, im.height)


def zoomed_cover(src: Image.Image, fill: float, canvas: int = 1024) -> Image.Image:
    """Contain-zoom: full figure kept; `fill` = share of canvas for the long side."""
    im = src.convert('RGBA')
    content = im.crop(solid_bbox(im))
    cw, ch = content.size
    side = max(cw, ch)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(content, ((side - cw) // 2, (side - ch) // 2), content)
    target = max(1, int(round(canvas * fill)))
    resized = sq.resize((target, target), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    off = (canvas - target) // 2
    out.paste(resized, (off, off), resized)
    return out


def on_plate(im: Image.Image, rgb: tuple[int, int, int] = PLATE_RGB) -> Image.Image:
    """Composite transparent mark onto an opaque light-brass plate."""
    base = Image.new('RGBA', im.size, (*rgb, 255))
    return Image.alpha_composite(base, im.convert('RGBA'))


def save_png(im: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.resize((size, size), Image.Resampling.LANCZOS).save(path, format='PNG', optimize=True)


def save_ico(master: Image.Image, path: Path, sizes: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    icons = [master.resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    icons[-1].save(
        path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=icons[:-1],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--src',
        type=Path,
        default=Path.home() / 'Downloads' / 'logo.png',
        help='Source logo PNG (transparent)',
    )
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    src = args.src.expanduser().resolve()
    root: Path = args.root.resolve()
    if not src.is_file():
        raise SystemExit(f'missing source logo: {src}')

    raw = Image.open(src).convert('RGBA')
    ui = zoomed_cover(raw, FILL_UI)
    mask = zoomed_cover(raw, FILL_MASKABLE)
    plated = on_plate(ui)
    plated_mask = on_plate(mask)

    brand = root / 'brand' / 'icons'
    (brand / 'source').mkdir(parents=True, exist_ok=True)
    raw.save(brand / 'source' / 'logo.png', format='PNG', optimize=True)
    for name in (
        'spotter-logo-master-1024.png',
        'spotter-glyph-master-1024.png',
        'spotter-glyph-tight-1024.png',
        'spotter-glyph-transparent-1024.png',
    ):
        ui.save(brand / 'source' / name, format='PNG', optimize=True)
    plated.save(brand / 'source' / 'spotter-logo-plated-1024.png', format='PNG', optimize=True)
    plated.save(brand / 'source' / 'spotter-app-icon-master-1024.png', format='PNG', optimize=True)

    for size in GLYPH_SIZES:
        save_png(ui, brand / 'transparent' / f'spotter-glyph-{size}.png', size)
        save_png(ui, brand / 'transparent' / f'spotter-glyph-tight-{size}.png', size)
        save_png(ui, root / 'client' / 'public' / 'icons' / f'spotter-glyph-{size}.png', size)
        save_png(ui, root / 'client' / 'public' / 'icons' / f'spotter-glyph-tight-{size}.png', size)

    for size in SIDEBAR_SIZES:
        save_png(ui, brand / 'sidebar' / f'spotter-sidebar-{size}.png', size)
        save_png(ui, root / 'client' / 'public' / 'icons' / f'spotter-sidebar-{size}.png', size)

    # Install / OS surfaces — opaque accent-100 plate.
    for size in FAVICON_SIZES:
        save_png(plated, brand / 'favicon' / f'favicon-{size}.png', size)
        save_png(plated, root / 'client' / 'public' / 'favicon' / f'favicon-{size}.png', size)

    save_png(plated, brand / 'favicon' / 'apple-touch-icon.png', 180)
    save_png(plated, root / 'client' / 'public' / 'favicon' / 'apple-touch-icon.png', 180)
    save_png(plated, root / 'client' / 'public' / 'favicon' / 'apple-touch-180.png', 180)
    save_png(plated, root / 'client' / 'public' / 'apple-touch-icon.png', 180)
    save_ico(plated, brand / 'favicon' / 'favicon.ico', [16, 32, 48])
    save_ico(plated, root / 'client' / 'public' / 'favicon' / 'favicon.ico', [16, 32, 48])
    save_ico(plated, root / 'client' / 'public' / 'favicon.ico', [16, 32, 48])
    save_png(plated, root / 'client' / 'public' / 'favicon-16.png', 16)
    save_png(plated, root / 'client' / 'public' / 'favicon-32.png', 32)

    for size in PWA_SIZES:
        save_png(plated, brand / 'web' / f'spotter-pwa-{size}.png', size)
        save_png(plated, brand / 'web' / f'spotter-app-{size}.png', size)
        save_png(plated, brand / 'web' / f'spotter-glyph-{size}.png', size)
        save_png(plated_mask, brand / 'web' / f'spotter-maskable-{size}.png', size)
        save_png(plated_mask, brand / 'web' / f'spotter-app-maskable-{size}.png', size)
        save_png(plated, root / 'client' / 'public' / 'icons' / f'spotter-pwa-{size}.png', size)
        save_png(plated, root / 'client' / 'public' / 'icons' / f'spotter-app-{size}.png', size)
        save_png(
            plated_mask, root / 'client' / 'public' / 'icons' / f'spotter-maskable-{size}.png', size
        )
        save_png(
            plated_mask,
            root / 'client' / 'public' / 'icons' / f'spotter-app-maskable-{size}.png',
            size,
        )
        save_png(plated, root / 'client' / 'public' / f'icon-{size}.png', size)
        save_png(plated_mask, root / 'client' / 'public' / f'icon-{size}-maskable.png', size)

    for size in [16, 24, 32, 48, 64, 96, 128, 180, 256, 384]:
        save_png(plated, brand / 'web' / f'spotter-glyph-{size}.png', size)

    desk = root / 'desktop' / 'assets'
    save_png(plated, desk / 'app-icon.png', 512)
    save_png(plated, desk / 'tray.png', 22)
    save_png(plated, desk / 'tray@2x.png', 44)
    for base, scale in MAC_ICONSET:
        px = base * scale
        name = f'icon_{base}x{base}.png' if scale == 1 else f'icon_{base}x{base}@{scale}x.png'
        save_png(plated, desk / 'AppIcon.iconset' / name, px)
        save_png(plated, brand / 'macos' / 'AppIcon.iconset' / name, px)

    print(
        f'OK · source={src} · fill_ui={FILL_UI} · fill_maskable={FILL_MASKABLE} · plate=#{PLATE_RGB[0]:02x}{PLATE_RGB[1]:02x}{PLATE_RGB[2]:02x}'
    )


if __name__ == '__main__':
    main()
