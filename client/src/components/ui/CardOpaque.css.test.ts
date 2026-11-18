/**
 * SPO-565: an opaque Card is the one kit answer for cards that stack over each other (the open banner stack, decks).
 * Every theme draws it from the theme's solid surface token: no alpha token, no `transparent`, no backdrop blur, so
 * nothing behind the card can show through.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', '..', 'glass.css'), 'utf8');
const block = (selector: string): string => {
  const i = css.indexOf(`${selector} {`);
  expect(i, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('opaque Card surface (glass.css)', () => {
  const rule = block('html[data-theme] .uicard.uicard--opaque');
  it('mixes the tone into the solid surface token only', () => {
    expect(rule).toContain('var(--color-surface)');
    expect(rule).not.toMatch(/transparent/);
    expect(rule).not.toMatch(/-a\d+\b/);
    expect(rule).not.toMatch(/--glass-surface|--glass-tint/);
  });
  it('turns the backdrop blur off', () => {
    expect(rule).toMatch(/backdrop-filter:\s*none/);
    expect(rule).toMatch(/-webkit-backdrop-filter:\s*none/);
  });
});
