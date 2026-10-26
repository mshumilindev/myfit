import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPO-363 (regression for SPO-362): jsdom has no layout, so the "seven chips in one row" guarantee is pinned on the CSS
 * contract that produces it. The old group was a wrapping flex row: the check icon widened a picked chip and the last
 * day ("Sat") dropped to a second row. The live geometry (320..1728 px, one row, equal widths, no shift on toggle) is
 * measured by scripts/weekday-row-audit.mjs.
 */
const css = readFileSync(join(__dirname, 'Chip.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} exists in Chip.css`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('ChipGroup grid: the CSS contract of one row of equal columns', () => {
  const group = block('.uichip-group--grid');
  const chip = block('.uichip-group--grid > .uichip');
  const icon = block('.uichip-group--grid > .uichip .ui-icon');

  it('is a grid of N equal, shrinkable columns, never a wrapping flex row', () => {
    expect(group).toMatch(/display:\s*grid/);
    expect(group).toMatch(
      /grid-template-columns:\s*repeat\(var\(--uichip-cols,\s*7\),\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(group).not.toMatch(/flex-wrap|display:\s*flex/);
  });

  it('a chip fills its column and may shrink below its content (no overflow past the container)', () => {
    expect(chip).toMatch(/width:\s*100%/);
    expect(chip).toMatch(/min-width:\s*0/);
  });

  it('the check icon is an overlay: a picked chip is never wider than an unpicked one', () => {
    expect(icon).toMatch(/position:\s*absolute/);
    expect(chip).toMatch(/position:\s*relative/);
  });
});
