import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRAME_BANDS, FRAME_MAX, frameBand, frameVars } from './frame';

const DIR = __dirname;
const css = readFileSync(join(DIR, 'frame.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Variables declared by the base `:root` block plus the media blocks that apply at `vw`. */
function cssVarsAt(vw: number): Record<string, number> {
  const out: Record<string, number> = {};
  const blocks: { min: number; body: string }[] = [{ min: 0, body: '' }];
  const re = /(@media\s*\(min-width:\s*(\d+)px\)\s*\{)?\s*:root\s*\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) blocks.push({ min: m[2] ? Number(m[2]) : 0, body: m[3] });
  for (const b of blocks.sort((x, y) => x.min - y.min)) {
    if (b.min > vw) continue;
    for (const d of b.body.matchAll(/--co-([\w-]+):\s*(-?\d+)px/g)) out[d[1]] = Number(d[2]);
  }
  return out;
}

describe('Coach frame variables (R-FE-004)', () => {
  it.each([
    [1440, 1288],
    [1280, 1128],
    [1024, 900],
    [768, 644],
    [390, 358],
  ])('content width at %ipx is %ipx', (vw, frame) => {
    expect(frameVars(vw).frame).toBe(frame);
  });

  it('caps the frame on very wide screens', () => {
    expect(frameVars(2560).frame).toBe(FRAME_MAX);
    expect(frameVars(1920).frame).toBe(FRAME_MAX);
  });

  it('rail 88 / 60 / 0 at 1440, 1280, 1024, 390; breakpoints 1280 and 768', () => {
    expect([1440, 1280, 1024, 390].map((w) => frameVars(w).rail)).toEqual([88, 88, 60, 0]);
    expect(frameBand(1279)).toBe('mid');
    expect(frameBand(768)).toBe('mid');
    expect(frameBand(767)).toBe('phone');
  });

  it('inspector 416 wide, 340 mid; dock and its clearance only on wide screens', () => {
    expect(frameVars(1440)).toMatchObject({ insp: 416, dockW: 440, dockInset: 16, dockClear: 96 });
    expect(frameVars(1024)).toMatchObject({ insp: 340, dockW: 0, dockClear: 0 });
    expect(frameVars(390)).toMatchObject({ pad: 16, gut: 16, dockClear: 0 });
  });

  it.each([390, 767, 768, 1024, 1279, 1280, 1440, 1920])(
    'frame.css matches frame.ts at %ipx',
    (vw) => {
      const b = FRAME_BANDS[frameBand(vw)];
      const v = cssVarsAt(vw);
      expect(v).toMatchObject({
        rail: b.rail,
        pad: b.pad,
        gut: b.gut,
        insp: b.insp,
        'dock-w': b.dockW,
        'dock-inset': b.dockInset,
        'dock-clear': b.dockClear,
      });
    },
  );

  it('frame.css computes the frame from rail and pad, capped at the same maximum', () => {
    expect(css).toMatch(
      new RegExp(
        `--co-frame:\\s*min\\(${FRAME_MAX}px,\\s*calc\\(100vw - var\\(--co-rail\\) - 2 \\* var\\(--co-pad\\)\\)\\)`,
      ),
    );
  });
});

describe('Coach CSS width discipline (R-FE-005)', () => {
  const files = readdirSync(join(DIR, '..'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.css'))
    .map((f) => join(DIR, '..', f));

  it('finds the coach stylesheets', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('no width literal above 400px outside variable definitions and media queries', () => {
    const bad: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const line of text.split('\n')) {
        if (/^\s*--[\w-]+\s*:/.test(line) || /@media/.test(line)) continue;
        const m = /(?:^|[\s;{])(?:min-|max-)?width:\s*(\d+)px/.exec(line);
        if (m && Number(m[1]) > 400) bad.push(`${f}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
