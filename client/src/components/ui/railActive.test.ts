import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Active rail item = the same treatment as every app's rail (tinted rounded tile + 1px accent
 * ring from styles.css / glass.css, accent re-tints per app) and NOTHING else (no edge bar). Active must never change the tile's size.
 */
const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const SOURCES = { 'styles.css': read('../../styles.css'), 'glass.css': read('../../glass.css') };
const RAIL = read('Rail.css');

function rules(css: string, match: (sel: string) => boolean): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match(m[1].trim())) out.push(m[2]);
  }
  return out;
}

describe('rail active state', () => {
  it('the active tile rules never touch its size, spacing, border width or position', () => {
    const bodies = [
      ...Object.values(SOURCES).flatMap((css) =>
        rules(css, (s) => /\.rail-item\.active$/.test(s) || /\.rail-item\.active,?$/.test(s)),
      ),
      ...rules(RAIL, (s) => /\.rail-item\.active$/.test(s)),
    ];
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    for (const b of bodies)
      expect(b).not.toMatch(
        /(^|[;\s])(width|height|min-|max-|padding|margin|border(-width)?|transform|outline|top|left):/,
      );
  });

  it('the shared tile = tint + 1px accent ring (box-shadow, no layout), accent-driven', () => {
    const glass = rules(SOURCES['glass.css'], (s) => s.endsWith('.rail-item.active'))[0];
    expect(glass).toMatch(/background: color-mix\(in srgb, var\(--color-accent\)/);
    expect(glass).toMatch(/box-shadow: inset 0 0 0 1px color-mix\(in srgb, var\(--color-accent\)/);
  });

  it('no bar / notch: nothing draws a pseudo-element on the active rail item', () => {
    for (const css of [...Object.values(SOURCES), RAIL, read('../../nutrition/nutrition.css')])
      expect(css).not.toMatch(/\.rail-item\.active::(before|after)/);
  });

  it('tile sizes are the original ones: labelled 72x64, compact 44x44', () => {
    expect(rules(RAIL, (s) => s === '.rail--labelled .rail-item')[0]).toMatch(
      /width: 72px;[\s\S]*height: 64px;/,
    );
    expect(rules(RAIL, (s) => s === '.rail--compact .rail-item')[0]).toMatch(
      /width: 44px;[\s\S]*height: 44px;/,
    );
  });
});
