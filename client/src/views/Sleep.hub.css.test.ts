/**
 * SPO-550: the Sleep hub (history bars, weekday rhythm) shows while awake, in the app's own day/night theme. Its bars and
 * tracks must follow the theme tokens: a fixed night palette (`--c-3d6488`, `--s-moon`) next to the theme accent gave
 * two unrelated colours on the light theme (weeknights periwinkle, weekends near-black).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
const rule = (selector: string): string => {
  const i = css.indexOf(`${selector} {`);
  expect(i, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('Sleep hub bars follow the theme', () => {
  it.each([
    '.slh-bar-track',
    '.slh-bar',
    '.slh-bars .slh-bar.met',
    '.slh-rhythm .slh-bar',
    '.slh-rhythm .slh-bar.wk',
  ])('%s uses no fixed night palette', (sel) => {
    const body = rule(sel);
    expect(body).not.toMatch(/--c-[0-9a-f]{6}|--s-moon|--color-neutral-/);
    expect(body).toMatch(/--color-accent|--color-text/);
  });
  it('weeknights and weekends are two steps of the same accent', () => {
    expect(rule('.slh-rhythm .slh-bar')).toMatch(/var\(--color-accent\)/);
    expect(rule('.slh-rhythm .slh-bar.wk')).toMatch(/color-mix\(in srgb, var\(--color-accent\)/);
  });
});
