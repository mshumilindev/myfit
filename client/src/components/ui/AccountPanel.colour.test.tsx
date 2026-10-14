import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stylesCss } from './readCss';

/** Profile (People silver) and Sign out (danger) pills: label contrast on the pill fill, numerically. */
const css = stylesCss();
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
const t = (n: string) => rgb(tok.get(n) as string);

describe('account pills: tokens and contrast', () => {
  const surface = t('--color-surface');
  it.each(['people', 'danger'])(
    '%s: label >= 4.5:1 on the flat fill, on the glass gradient and in the popover',
    (fam) => {
      const text = t(`--color-${fam}-text`);
      const tint = t(`--color-${fam}-tint`);
      const base = t(`--color-${fam}`);
      // flat: the tint; glass: 22% .. 6% of the family over the dark plate
      for (const bg of [
        tint,
        mix([20, 18, 14], base, 0.22),
        mix([16, 15, 13], base, 0.06),
        mix(surface, tint, 1),
      ])
        expect(cr(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(cr(t(`--color-${fam}-line`), surface)).toBeGreaterThanOrEqual(1.5);
    },
  );

  it('the pill reads the family tokens (label colour, fill and border), tokens only', () => {
    const src = readFileSync(join(__dirname, 'AccountPanel.css'), 'utf8');
    const at = src.indexOf('.uiacct-action.uicard {');
    const body = src.slice(at, src.indexOf('}', at));
    expect(body).toMatch(/color: var\(--t-text\)/);
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(readFileSync(join(__dirname, 'Card.css'), 'utf8')).toMatch(
      /\.uicard--atlas,\s*\.uicard--people \{/,
    );
  });
});
