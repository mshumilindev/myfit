import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MoreMenu } from './MoreMenu';
import { stylesCss, glassCss, inlinePrimitives } from './readCss';
import { SUITE_TONE } from '../suite/suiteTone';
import type { SuiteApp } from '../suite/useSuiteAccount';

afterEach(cleanup);

const css = stylesCss();
const glass = glassCss();
const more = inlinePrimitives(readFileSync(join(__dirname, 'MoreMenu.css'), 'utf8'));
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')));
const tok = new Map<string, string>();
for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tok.set(m[1], m[2].trim());
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (c: number[]) => {
  const [r, g, b] = c.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a: number[], b: number[]) => {
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * (1 - t) + b[i] * t);
const resolve = (n: string): string => {
  const v = tok.get(n) as string;
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  return m ? resolve(m[1]) : v;
};
const tokRgb = (n: string) => rgb(resolve(n));
/** Same plate as the launcher: bg 30% + black, accent 7% (flat) / 6-8% (glass). */
const plate = (fam: string, pct: number) =>
  mix(mix(tokRgb('--color-bg'), [0, 0, 0], 0.7), tokRgb(`--color-${fam}`), pct);

describe('phone More sheet: colour-coded to the current app', () => {
  it.each(Object.entries(SUITE_TONE) as [SuiteApp, string][])(
    '%s: the sheet wears the %s tone',
    (_app, tone) => {
      render(
        <MoreMenu
          presentation="sheet"
          open
          onClose={() => undefined}
          title="More"
          tone={tone as never}
        />,
      );
      const sheet = document.body.querySelector('.sheet.uimore') as HTMLElement;
      expect(sheet.classList.contains('sheet--toned')).toBe(true);
      expect(sheet.classList.contains(`uit--${tone}`)).toBe(true);
    },
  );

  it('without a tone the sheet is not toned (kit default)', () => {
    render(<MoreMenu presentation="sheet" open onClose={() => undefined} title="More" />);
    expect(document.body.querySelector('.sheet.uimore')?.classList.contains('sheet--toned')).toBe(
      false,
    );
  });

  it('shares the launcher recipe (flat + glass): accent plate, 1px accent-line edge', () => {
    expect(css).toMatch(/\.shell-sheet\.sheet--toned,\s*\.uimore\.sheet--toned \{/);
    const at = css.indexOf('.uimore.sheet--toned {');
    expect(css.slice(at, css.indexOf('}', at))).toMatch(
      /var\(--t-base\) 7%[\s\S]*border: 1px solid var\(--t-line\)/,
    );
    expect(glass).toMatch(
      /\.sheet--toned\.shell-sheet,\s*html\[data-theme\] \.sheet\.sheet--toned\.uimore \{/,
    );
  });

  it.each([...new Set(Object.values(SUITE_TONE))])(
    '%s: rows stay distinct from the plate, text >= 4.5:1, edge visible',
    (fam) => {
      const ink = tokRgb('--color-text');
      const row = tokRgb('--color-tile'); // GroupedList raised rows
      const line = tokRgb(`--color-${fam}-line`);
      for (const pct of [0.08, 0.07, 0.06]) {
        const p = plate(fam, pct);
        expect(cr(row, p)).toBeGreaterThanOrEqual(1.075);
        expect(cr(ink, p)).toBeGreaterThanOrEqual(4.5);
        expect(cr(ink, row)).toBeGreaterThanOrEqual(4.5);
        expect(cr(tokRgb(`--color-${fam}-text`), p)).toBeGreaterThanOrEqual(4.5);
        expect(cr(line, p)).toBeGreaterThanOrEqual(1.5);
      }
    },
  );

  it('account block is its own section: >= --s-24 gap above a hairline, bottom keeps the safe area', () => {
    expect(more).toMatch(
      /\.uimore \.uimore-list:has\(\+ \.uiacct\) \{\s*padding-bottom: var\(--s-24\)/,
    );
    expect(more).toMatch(/\.uimore \.uiacct \{\s*border-top: 1px solid var\(--t-line/);
    const overlays = readFileSync(join(__dirname, 'Overlays.css'), 'utf8');
    expect(overlays).toMatch(/calc\(var\(--space-8\) \+ var\(--safe-bottom\)\)/);
  });
});
