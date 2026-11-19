/**
 * SPO-566: the open banner stack draws its cards `opaque` (kit prop, class `uicard--opaque`): the tone mixed into the
 * solid surface, no translucency. This guard checks the text of those cards stays AA (4.5:1) for every tone, in
 * Studio light and dark, on all 9 accents, day and night. Colours come from the real stylesheets.
 */
import { readFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXES } from '../client/src/themes/registry';
import { cascade, contrast, over, resolve, type HtmlState, type RGBA } from './helpers/themeMatrix';

const read = (p: string) => readFileSync(pathResolve(process.cwd(), 'client/src', p), 'utf8');
const TONES = [
  ...read('components/ui/tones.css').matchAll(/--t-base:\s*var\((--color-[\w-]+)\)/g),
].map((m) => m[1]);
const css = ['glass.css', 'themes/glass.css', 'components/ui/Card.css']
  .map((p) => {
    try {
      return read(p);
    } catch {
      return '';
    }
  })
  .join('\n');
const rule = css.match(/\.uicard\.uicard--opaque[^{]*\{([^}]*)\}/)?.[1] ?? '';
const WEIGHT = Number(
  rule.match(/color-mix\(\s*in srgb\s*,\s*var\(--t-base[^;]*?\)\s+(\d+(?:\.\d+)?)%\s*,/)?.[1],
);

const ACCENTS = (AXES.accent.values as readonly string[]).filter((a) => a !== 'brass');
const TEXT = ['--color-text', '--color-text-muted', '--color-text-faint'];
const AA = 4.5;

function evaluate() {
  const rows: { key: string; ratio: number | null }[] = [];
  for (const mode of ['dark', 'light'])
    for (const accent of ACCENTS)
      for (const night of [false, true]) {
        const attrs: Record<string, string> = {
          'data-theme': 'studio',
          'data-mode': mode,
          'data-accent': accent,
        };
        if (night) attrs['data-sleep'] = 'night';
        const props = cascade({ classes: [], attrs } satisfies HtmlState);
        const bg = resolve(props, 'var(--color-bg)');
        let surface = resolve(props, 'var(--color-surface)');
        if (surface && surface[3] < 1 && bg) surface = over(surface, bg);
        for (const tone of TONES) {
          const base = resolve(props, `var(${tone})`);
          if (!base || !surface || !bg) {
            rows.push({ key: `${mode}/${accent}/${tone}`, ratio: null });
            continue;
          }
          const w = WEIGHT / 100;
          const solid: RGBA = [0, 1, 2]
            .map((i) => base[i] * w + surface[i] * (1 - w))
            .concat(1) as RGBA;
          for (const t of TEXT) {
            let fg = resolve(props, `var(${t})`);
            if (fg && fg[3] < 1) fg = over(fg, solid);
            rows.push({
              key: `${mode}${night ? '/night' : ''}/${accent}/${tone} ${t}`,
              ratio: fg ? contrast(fg, solid) : null,
            });
          }
        }
      }
  return rows;
}

describe('opaque tone cards: text contrast (Studio × light/dark × 9 accents × tones)', () => {
  it('finds the rule and the tones it mixes', () => {
    expect(rule).toContain('var(--color-surface)');
    expect(WEIGHT).toBeGreaterThan(0);
    expect(TONES.length).toBeGreaterThanOrEqual(5);
  });
  const rows = evaluate();
  it('resolves every colour', () => {
    expect(rows.filter((r) => r.ratio === null).map((r) => r.key)).toEqual([]);
  });
  it('has no text below AA on an opaque card', () => {
    expect(
      rows
        .filter((r) => r.ratio !== null && r.ratio < AA)
        .map((r) => `${r.key} ${r.ratio?.toFixed(2)}`),
    ).toEqual([]);
  });
  it('covers both modes, every accent and every tone', () => {
    expect(rows.length).toBe(2 * 9 * 2 * TONES.length * TEXT.length);
  });
});
