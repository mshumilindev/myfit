import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kitCss, stylesCss } from './readCss';

/**
 * WCAG AA (4.5:1) for the text tiers of the kit on every surface they sit on, including the
 * dimmed ("off" / locked) variants. Iteration 9 raised `--color-neutral-600` (text-faint) from
 * #80858a; these numbers are the proof that the new value holds on each surface (glass included).
 */
const STYLES = stylesCss();
const GLASS = readFileSync(join(__dirname, '..', '..', 'glass.css'), 'utf8');

const tokens = new Map<string, string>();
for (const m of (STYLES + GLASS).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6}|var\(--[\w-]+\));/g)) {
  if (!tokens.has(m[1])) tokens.set(m[1], m[2]);
}
const hexOf = (name: string): string => {
  const v = tokens.get(name);
  if (!v) throw new Error(`no token ${name}`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? hexOf(ref[1]) : v;
};

type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: RGB, bg: RGB, a: number): RGB => fg.map((v, i) => v * a + bg[i] * (1 - a)) as RGB;

/** Surfaces text can sit on: page, glass page, cards, tiles, the warm launcher glass, locked option. */
const SURFACES: Record<string, string> = {
  page: hexOf('--color-bg'),
  surface: hexOf('--color-surface'),
  'surface-2': hexOf('--color-surface-2'),
  tile: hexOf('--color-tile'),
  'warm launcher glass': '#272522',
  'locked option': '#18191c',
};

describe('text tiers on kit surfaces (AA 4.5:1)', () => {
  it.each(Object.entries(SURFACES))('text-faint on %s', (_n, bg) => {
    expect(ratio(rgb(hexOf('--color-text-faint')), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(Object.entries(SURFACES))('text-muted on %s', (_n, bg) => {
    expect(ratio(rgb(hexOf('--color-text-muted')), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it('faint stays below muted so the tiers still read as tiers', () => {
    expect(lum(rgb(hexOf('--color-text-faint')))).toBeLessThan(
      lum(rgb(hexOf('--color-text-muted'))),
    );
  });
});

describe('dimmed rows and options', () => {
  const opacityOf = (css: string, selector: string): number => {
    const at = css.indexOf(selector);
    expect(at, selector).toBeGreaterThan(-1);
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    return Number(body.match(/opacity:\s*([\d.]+)/)?.[1]);
  };
  it('the "off" row sub-line, value and label stay >= 4.5:1', () => {
    const o = opacityOf(kitCss('GroupedList'), '.uirow.is-dim {');
    expect(o).toBeGreaterThanOrEqual(0.9);
    const bg = rgb(hexOf('--color-bg'));
    expect(ratio(over(rgb(hexOf('--color-text-muted')), bg, o), bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(over(rgb(hexOf('--color-text-faint')), bg, o), bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('the locked, unpicked option stays >= 4.5:1', () => {
    const o = opacityOf(kitCss('ChoiceList'), '.uichoice-opt.is-dim {');
    expect(o).toBeGreaterThanOrEqual(0.85);
    const bg = rgb('#18191c');
    expect(ratio(over(rgb(hexOf('--color-text-muted')), bg, o), bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('selected tint and chat status', () => {
  it('the selected option description uses the plain text colour (muted is 4.18:1 on the tint)', () => {
    const css = kitCss('ChoiceList');
    expect(css).toMatch(
      /\.uichoice-opt\.uicard--selected \.uichoice-desc\s*\{\s*color: var\(--color-text\)/,
    );
    const tint = rgb(hexOf('--color-accent-tint'));
    expect(ratio(rgb(hexOf('--color-text')), tint)).toBeGreaterThanOrEqual(4.5);
  });
  it('the chat status line is never dimmed by an opacity on the bubble', () => {
    const css = kitCss('ChatBubble');
    const at = css.indexOf('.uibub.is-sending {');
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    expect(body).not.toMatch(/opacity/);
    expect(ratio(rgb(hexOf('--color-text-muted')), rgb('#28231c'))).toBeGreaterThanOrEqual(4.5);
  });
});
