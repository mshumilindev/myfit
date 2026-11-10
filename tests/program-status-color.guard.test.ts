/**
 * Today program block: the colour carries the day's status (SPO-529 / SPO-530). The block takes
 * `--acc` from `.td-week[data-mode=…]` (redesign.css); here every mode's token is resolved through the
 * real theme cascade (tests/helpers/themeMatrix.ts) and the statuses must stay visibly apart in every
 * theme × light/dark, so "trained today", "training day" and "rest" never read as one colour.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_IDS, cascade, resolve, type RGBA } from './helpers/themeMatrix';

const CSS = readFileSync(join(__dirname, '../client/src/redesign.css'), 'utf8');

/** mode → the custom property its `--acc` points at, read from the stylesheet itself. */
function modeTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /((?:\.td-week\[data-mode='[a-z]+'\],?\s*)+)\{[^}]*?--acc:\s*var\((--[a-z0-9-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    for (const sel of m[1].matchAll(/data-mode='([a-z]+)'/g)) out[sel[1]] = m[2];
  }
  return out;
}
const TOKENS = modeTokens();
/** Statuses that must read as different colours (rest/active share the rest blue on purpose). */
const DISTINCT = ['train', 'done', 'rest', 'illness', 'injury'] as const;
const MIN_DISTANCE = 45; // euclidean RGB floor picked for SPO-530; raise it only together with the token fix

const dist = (a: RGBA, b: RGBA) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const THEMES: Record<string, Record<string, string>> = {
  graphite: {},
  ...Object.fromEntries(THEME_IDS.map((id) => [id, { 'data-theme': id }])),
};
const MODES: Record<string, Record<string, string>> = { dark: {}, light: { 'data-mode': 'light' } };

describe('program block status colour (SPO-529)', () => {
  it('every status maps to a theme token, never a literal', () => {
    for (const mode of [...DISTINCT, 'active', 'off']) {
      expect(TOKENS[mode], `no --acc token for data-mode='${mode}'`).toMatch(/^--[a-z0-9-]+$/);
    }
  });

  for (const [theme, themeAttrs] of Object.entries(THEMES))
    for (const [mode, attrs] of Object.entries(MODES))
      it(`${theme}/${mode}: train, done, rest, illness and injury are visibly different`, () => {
        const props = cascade({ classes: [], attrs: { ...themeAttrs, ...attrs } });
        const colours = DISTINCT.map((s) => [s, resolve(props, `var(${TOKENS[s]})`)] as const);
        for (const [s, c] of colours) expect(c, `${s} token unresolved`).not.toBeNull();
        const clashes: string[] = [];
        for (let i = 0; i < colours.length; i++)
          for (let j = i + 1; j < colours.length; j++) {
            const [a, ca] = colours[i];
            const [b, cb] = colours[j];
            if (ca && cb && dist(ca, cb) < MIN_DISTANCE)
              clashes.push(`${a}≈${b} (${Math.round(dist(ca, cb))})`);
          }
        expect(clashes).toEqual([]);
      });
});
