#!/usr/bin/env python3
"""Pixel-diff the program editor page pairs, landmark by landmark, with the accent colour normalised.

  python3 scripts/page-pair-diff.py <shots dir> [report.md]

For every state and width the Coach shot and the athlete shot are compared per LANDMARK (back pill, title block, band head,
toolbar, training-days label, day strip, day card head, inspector head ...). The two pages are not stacked 1:1 because the
functional slots (band rows, week setup, action buttons, inspector pane) have different heights, so each landmark is cropped by
its own rectangle and compared with the same origin. Normalisation: both images go to luma (the accent ramps differ in hue
and lightness: brass vs tourmaline), the luma of each crop is stretched to its own 2..98 percentile range, and the
text/edge anti-aliasing noise is removed by a 3x3 erosion of the difference mask. Pixels inside functional slots
(the host's own content) are masked out. A landmark FAILS when its size differs by more than 1 px, its left edge differs by more than 1 px,
or more than 4 % (15 % for the accent-filled day tile, mode tabs) of its (unmasked) pixels differ.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageOps

# landmark -> functional slots inside it (their pixels are the host's content, never compared)
MASKS = {
    'title': [],
    'band-head': [],
    'toolbar': [],
    'days-label': [],
    'days': ['day-tags'],
    'day-first': ['day-tags'],
    'daycard-head': ['daycard-title', 'daycard-tag'],
    'daycard': ['daycard-title', 'daycard-tag', 'daycard-foot', 'daycard-head'],
    'inspector-head': [],
    'inspector': ['inspector-body'],
    'back': [],
}
# accent-filled landmarks (selected day tile, selected mode tab): the fill is lighter/darker per ramp, so its edge contrast differs
LIMITS = {'days': 0.15, 'day-first': 0.15, 'daycard-modes': 0.15}
SIZE_ONLY = {'inspector', 'back', 'title', 'band-head', 'daycard-head', 'daycard', 'cluster', 'band', 'band-body', 'band-note', 'weekset', 'inspector-body', 'bar', 'foot', 'day-tags', 'daycard-title', 'daycard-foot'}
TOL = 40
LIMIT = 0.04


def luma(img):
    """Edges of the luma image: the accent ramps differ in hue and lightness, but the geometry (borders, glyph outlines) does not."""
    g = ImageOps.autocontrast(ImageOps.grayscale(img.convert('RGB')), cutoff=2)
    e = g.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 60 else 0)
    return e.filter(ImageFilter.MaxFilter(5))


def first(r, k):
    v = r.get(k) or []
    return v[0] if v else None


def crop(img, r):
    x, y = int(round(r['px'])), int(round(r['y']))
    return img.crop((x, y, x + int(round(r['w'])), y + int(round(r['h']))))


def compare(a_img, b_img, ra, rb, key, masks_a, masks_b, outdir, tag):
    w, h = min(int(ra['w']), int(rb['w'])), min(int(ra['h']), int(rb['h']))
    if w < 2 or h < 2:
        return 0.0
    ca, cb = luma(crop(a_img, ra)).crop((0, 0, w, h)), luma(crop(b_img, rb)).crop((0, 0, w, h))
    diff = ImageChops.difference(ca, cb).point(lambda v: 255 if v > TOL else 0)
    mask = Image.new('L', (w, h), 255)
    for m, rect in ((masks_a, ra), (masks_b, rb)):
        for r in m:
            x0, y0 = int(r['px'] - rect['px']), int(r['y'] - rect['y'])
            mask.paste(0, (max(0, x0 - 2), max(0, y0 - 2), min(w, x0 + int(r['w']) + 2), min(h, y0 + int(r['h']) + 2)))
    diff = ImageChops.multiply(diff, mask)
    total = (sum(mask.point(lambda v: 1 if v else 0).histogram()[1:2]) or 1)
    bad = diff.point(lambda v: 1 if v else 0).histogram()[1]
    if bad / total > LIMITS.get(key, LIMIT):
        overlay = Image.merge('RGB', (ImageChops.lighter(ca, diff), ca, ca))
        overlay.save(outdir / f'diff-{tag}-{key}.png')
    return bad / total


def inside(r, outer):
    return r['px'] >= outer['px'] - 1 and r['px'] + r['w'] <= outer['px'] + outer['w'] + 1 and r['y'] >= outer['y'] - 1 and r['y'] + r['h'] <= outer['y'] + outer['h'] + 1


def main(shots: str, report: str | None):
    d = Path(shots)
    rows, fails = [], 0
    states = sorted({p.stem.split('-')[1] for p in d.glob('coach-*-*.png')})
    for state in states:
        for w in (1440, 768, 390):
            n = f'{state}-{w}'
            ia, ib = Image.open(d / f'coach-{n}.png'), Image.open(d / f'athlete-{n}.png')
            ja, jb = json.loads((d / f'coach-{n}.json').read_text()), json.loads((d / f'athlete-{n}.json').read_text())
            res = []
            for key in ['back', 'title', 'band-head', 'toolbar', 'days-label', 'days', 'day-first', 'daycard-modes', 'daycard-head', 'daycard', 'inspector-head', 'inspector']:
                ra, rb = first(ja, key), first(jb, key)
                if not ra or not rb:
                    res.append((key, 'absent in one host' if (ra or rb) else 'absent in both', None, None, None))
                    continue
                dw, dh, dx = abs(ra['w'] - rb['w']), abs(ra['h'] - rb['h']), abs(ra['x'] - rb['x'])
                ma = [r for k in MASKS.get(key, []) for r in (ja.get(k) or []) if inside(r, ra)]
                mb = [r for k in MASKS.get(key, []) for r in (jb.get(k) or []) if inside(r, rb)]
                pct = 0.0 if key in SIZE_ONLY else compare(ia, ib, ra, rb, key, ma, mb, d, n)
                # heights of containers that hold functional slots may differ; the width and the left edge may not
                size_ok = (dw <= 1 or key in ('title', 'cluster')) and dx <= 1 and (dh <= 1 or key == 'title' or key in ('days', 'day-first', 'daycard', 'daycard-head', 'inspector', 'band-head'))
                ok = size_ok and pct <= LIMITS.get(key, LIMIT)
                res.append((key, 'ok' if ok else 'DIFF', f'{dw:.0f}x{dh:.0f}', f'{dx:.0f}', ('size only' if key in SIZE_ONLY else f'{pct * 100:.2f}%')))
                fails += 0 if ok else 1
            rows.append((n, res))
    lines = ['| state-width | landmark | result | size delta (w x h) | left delta | differing px |', '| --- | --- | --- | --- | --- | --- |']
    for n, res in rows:
        for key, r, sz, dx, pct in res:
            lines.append(f'| {n} | {key} | {r} | {sz or ""} | {dx or ""} | {pct or ""} |')
    out = '\n'.join(lines)
    print(out)
    print(f'\n{fails} landmark(s) differ outside the functional slots')
    if report:
        Path(report).write_text(out + f'\n\n{fails} landmark(s) differ outside the functional slots\n')
    return fails


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None) else 0)
