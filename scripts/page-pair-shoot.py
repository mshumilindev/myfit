#!/usr/bin/env python3
"""Shoot the program editor page pairs (Storybook `Tools/Program editor page`): host x state x width.

  python3 scripts/page-pair-shoot.py <storybook-static dir> <out dir>

Serves the static Storybook, opens every story with `args=host:coach|athlete`, saves a full-page PNG and the rectangles of
the page landmarks (JSON, relative to the page) so `page-pair-diff.py` can compare them slot by slot.
"""
import functools, http.server, json, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

STATES = {
    'empty': 'empty',
    'selected': 'selected-exercise',
    'activity': 'activity',
    'warmup': 'warmup',
    'findings': 'check-findings',
    'readonly': 'read-only',
    'muscles': 'muscles-day',
}
WIDTHS = [1440, 768, 390]
HOSTS = ['coach', 'athlete']
LANDMARKS = {
    'back': '.pe-page-back',
    'title': '.pe-page-title',
    'cluster': '.pe-page-cluster',
    'band': '.pe-band',
    'band-head': '.pe-band-head',
    'band-body': '.pe-band-body',
    'band-note': '.pe-band-note',
    'toolbar': '.pe-toolbar',
    'days-label': '.pe-days-sec > .uisec',
    'weekset': '.pe-weekset',
    'days': '.pe-days',
    'day-tags': '.pe-day-tags',
    'day-first': '.pe-day',
    'daycard': '.pe-dc',
    'daycard-modes': '.pe-dc-m',
    'daycard-head': '.pe-dc-h',
    'daycard-title': '.pe-dc-t',
    'daycard-tag': '.pe-dc-tag',
    'daycard-foot': '.pe-dc-f',
    'inspector': '.pe-inspector',
    'inspector-head': '.pe-insp-h',
    'inspector-body': '.pe-insp-b',
    'bar': '.pe-page-bar',
    'foot': '.pe-page-foot',
}
JS = """(sel) => {
  const page = document.querySelector('.pe-page'); if (!page) return null;
  const o = page.getBoundingClientRect();
  const out = {};
  for (const [k, s] of Object.entries(sel)) {
    const els = [...document.querySelectorAll(s)];
    out[k] = els.map(e => { const r = e.getBoundingClientRect();
      return {x: r.left - o.left, y: r.top + window.scrollY, w: r.width, h: r.height, px: r.left}; });
  }
  out._page = {x: o.left, y: o.top + window.scrollY, w: o.width, h: o.height};
  return out;
}"""


def main(sb: str, out: str):
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=sb)
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    with sync_playwright() as p:
        b = p.chromium.launch()
        for host in HOSTS:
            for state, story in STATES.items():
                for w in WIDTHS:
                    ctx = b.new_context(viewport={'width': w, 'height': 2800 if w < 600 else 2200}, device_scale_factor=1)
                    page = ctx.new_page()
                    errors = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    url = f'{base}/iframe.html?id=tools-program-editor-page--{story}&viewMode=story&args=host:{host}'
                    page.goto(url, wait_until='networkidle')
                    page.wait_for_selector('.pe-page', timeout=15000)
                    page.evaluate('document.fonts.ready')
                    page.wait_for_timeout(400)
                    rects = page.evaluate(JS, LANDMARKS)
                    name = f'{host}-{state}-{w}'
                    page.screenshot(path=str(out_dir / f'{name}.png'), full_page=True)
                    (out_dir / f'{name}.json').write_text(json.dumps(rects))
                    if errors:
                        print(name, 'PAGE ERRORS', errors[:2])
                    ctx.close()
        b.close()
    srv.shutdown()
    print('shot', len(HOSTS) * len(STATES) * len(WIDTHS), 'pages ->', out_dir)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
