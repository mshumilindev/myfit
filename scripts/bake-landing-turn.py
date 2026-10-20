#!/usr/bin/env python3
"""Bake the landing's spinning body (muscles + bones + recovery marks) into ready-made frames.

AnatomyTurntable used to build every frame in the browser from 11 layer pictures (72 frames x 11 = 792 images decoded
and composed on the main thread, ~700 MB of decoded pixels at peak). On phones and in the desktop shells that was the
glitch. The landing's figure never changes, so it is composed once here with the same maths the canvas used:
layers in order, `globalAlpha` per layer, marks tinted with their tone colour (source-in), no glow.

Run from the repo root:  python3 scripts/bake-landing-turn.py
Needs Pillow (with WebP) and numpy. Output: client/public/landing/turn/<deg>.webp (every STEP degrees).
"""
import os
import sys

import numpy as np
from PIL import Image

STEP = 10
SRC = os.path.join('client', 'public', 'anatomy', 'turn')
OUT = os.path.join('client', 'public', 'landing', 'turn')
# Same order and alphas as AnatomyTurntable's `specs` for base="muscles" + RECOVERY_MARKS (LandingDesign.tsx).
BASE = [('muscles', 0.6), ('bones', 0.22)]
# Tone colours of the dark theme (--color-<tone>, see client/src/tokens).
TONES = {'injury': '#e2786a', 'illness': '#f0a35e', 'ok': '#4cbe8c'}
MARKS = [
    ('m_quads', 'injury'),
    ('m_hams', 'injury'),
    ('m_glutes', 'illness'),
    ('m_core', 'illness'),
    ('m_back', 'illness'),
    ('m_chest', 'ok'),
    ('m_shoulder', 'ok'),
    ('m_arm', 'ok'),
    ('m_calves', 'ok'),
]


def rgb(h):
    return np.array([int(h[i : i + 2], 16) / 255.0 for i in (1, 3, 5)], dtype=np.float32)


def load(layer, deg):
    im = Image.open(os.path.join(SRC, layer, f'{deg}.webp')).convert('RGBA')
    a = np.asarray(im, dtype=np.float32) / 255.0
    return a[..., :3], a[..., 3:4]


def over(dst_p, src_p, src_a):
    """Premultiplied source-over: dst = src + dst * (1 - src_alpha)."""
    return src_p + dst_p * (1.0 - src_a)


def bake(deg):
    h, w = 700, 320
    acc = np.zeros((h, w, 4), dtype=np.float32)  # premultiplied RGBA
    for layer, alpha in BASE:
        c, a = load(layer, deg)
        pa = a * alpha
        acc = over(acc, np.concatenate([c * pa, pa], axis=-1), pa)
    for layer, tone in MARKS:
        _, a = load(layer, deg)
        col = rgb(TONES[tone])
        acc = over(acc, np.concatenate([col * a, a], axis=-1), a)
    a = acc[..., 3:4]
    rgb_out = np.where(a > 1e-6, acc[..., :3] / np.maximum(a, 1e-6), 0.0)
    out = np.clip(np.concatenate([rgb_out, a], axis=-1) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for deg in range(0, 360, STEP):
        path = os.path.join(OUT, f'{deg}.webp')
        bake(deg).save(path, 'WEBP', quality=80, alpha_quality=90, method=6)
        total += os.path.getsize(path)
    print(f'{360 // STEP} frames, {total / 1024:.0f} KB total -> {OUT}')


if __name__ == '__main__':
    sys.exit(main())
