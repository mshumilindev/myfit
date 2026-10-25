/**
 * App-switch guard: every theme sets `--switch-out` / `--switch-tail` (theme-contract guard) and, when they are above
 * 0, draws the phases of the switch (`html[data-theme=<id>][data-glitch…]`) in a file under client/src/themes/.
 * Without that the switch would only delay the new app. A new theme must either draw them or set both to 0.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../client/src/themes/registry';

const DIR = join(__dirname, '..', 'client', 'src', 'themes');
const css = readdirSync(DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(DIR, f), 'utf8'))
  .join('\n');

describe('app switch', () => {
  for (const { id } of THEMES) {
    it(`${id}: has timing tokens and draws the switch phases`, () => {
      const file = readFileSync(join(DIR, `${id}.css`), 'utf8');
      const out = Number(/--switch-out:\s*(\d+)/.exec(file)?.[1]);
      const tail = Number(/--switch-tail:\s*(\d+)/.exec(file)?.[1]);
      expect(Number.isFinite(out) && Number.isFinite(tail)).toBe(true);
      if (out > 0 || tail > 0) {
        for (const phase of ['out', 'load', 'in']) {
          expect(css).toContain(`html[data-theme='${id}'][data-glitch='${phase}']`);
        }
      }
    });
    it(`${id}: has route-change tokens and draws the route phases`, () => {
      const file = readFileSync(join(DIR, `${id}.css`), 'utf8');
      const tail = Number(/--route-tail:\s*(\d+)/.exec(file)?.[1]);
      expect(Number.isFinite(tail)).toBe(true);
      if (tail > 0) {
        for (const phase of ['load', 'in']) {
          expect(css).toContain(`html[data-theme='${id}'][data-route='${phase}']`);
        }
      }
    });
  }
});
