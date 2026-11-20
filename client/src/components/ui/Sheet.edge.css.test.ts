/**
 * SPO-599: a drawer touches the screen edge on its sides and bottom, so only the edge that faces the page is drawn.
 * Kit owns `--sheet-edge` (phone: top; desktop panel: top + left); themes write `inset var(--sheet-edge) 0 0 <colour>`
 * and never an all-sides `inset 0 0 0 <w>` ring on a sheet.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (...p: string[]): string => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');
const overlays = src('components', 'ui', 'Overlays.css');
const glass = src('glass.css');
const cyber = src('themes', '_cyberpunk.structure.css');

const rulesFor = (css: string, needle: RegExp): string[] =>
  css
    .split('}')
    .filter((r) => needle.test(r.split('{')[0] ?? ''))
    .map((r) => r.split('{')[1] ?? '');

describe('sheet edge (kit token)', () => {
  it('kit sets top-only on phone and top+left on the desktop panel', () => {
    expect(overlays).toMatch(/--sheet-edge:\s*0 var\(--sz-1\);/);
    expect(overlays).toMatch(/--sheet-edge:\s*var\(--sz-1\) var\(--sz-1\);/);
  });
  it.each([
    ['glass.css', glass],
    ['cyberpunk structure', cyber],
  ])('%s sheet rules draw no all-sides ring', (_n, css) => {
    const bodies = rulesFor(css, /\.sheet/).filter((b) => /box-shadow/.test(b));
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(b).not.toMatch(/inset 0 0 0 (var\(--sz-1\)|1px)/);
      expect(b).toMatch(/--sheet-edge/);
    }
  });
  it('Nutrition legacy sheet draws only the page-facing edge', () => {
    const css = src('nutrition', 'nutrition.css');
    const i = css.indexOf('.app-nutrition .sheet {');
    const body = css.slice(i, css.indexOf('}', i));
    expect(body).toMatch(/border:\s*0;/);
    expect(body).toMatch(/border-top:/);
  });
});
