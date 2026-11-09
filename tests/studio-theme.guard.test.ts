/**
 * Studio contrast guard: WCAG AA (4.5:1) for every text token on every surface token across
 * Studio × mode (dark / light) × night (data-sleep) × accent (all 11) × app skin. The shared matrix
 * (contrast-matrix.guard.test.ts) knows only data-theme + data-sleep; Studio also has data-mode and
 * data-accent, so this guard walks those axes. Filled accent controls: --color-on-accent on --color-accent.
 */
import { describe, expect, it } from 'vitest';
import { AXES } from '../client/src/themes/registry';
import { contrast, cascade, over, resolve, type HtmlState } from './helpers/themeMatrix';

const MODES = ['dark', 'light'];
const ACCENTS = (AXES.accent.values as readonly string[]).filter((a) => a !== 'brass');
const SLEEP = [false, true];
const SKINS = ['none', 'apex', 'roster', 'learn', 'coach', 'nutrition'];
const TEXT = ['--color-text', '--color-text-muted', '--color-text-faint', '--color-accent-text'];
const SURFACES = ['--color-bg', '--color-surface', '--color-surface-2', '--color-tile'];
const AA = 4.5;

function evaluate() {
  const rows: { key: string; ratio: number | null }[] = [];
  for (const mode of MODES)
    for (const accent of ACCENTS)
      for (const sleep of SLEEP)
        for (const skin of SKINS) {
          const attrs: Record<string, string> = {
            'data-theme': 'studio',
            'data-mode': mode,
            'data-accent': accent,
          };
          if (sleep) attrs['data-sleep'] = 'night';
          const state: HtmlState = { classes: skin === 'none' ? [] : [`theme-${skin}`], attrs };
          const props = cascade(state);
          const bg = resolve(props, 'var(--color-bg)');
          const label = `studio/${mode}/${accent}${sleep ? '/sleep' : ''}/${skin}`;
          for (const s of SURFACES)
            for (const t of TEXT) {
              let back = resolve(props, `var(${s})`);
              if (back && back[3] < 1 && bg) back = over(back, bg);
              let fg = resolve(props, `var(${t})`);
              if (fg && back && fg[3] < 1) fg = over(fg, back);
              rows.push({
                key: `${label} ${t} on ${s}`,
                ratio: fg && back ? contrast(fg, back) : null,
              });
            }
          // filled accent control: label colour on the accent fill
          const fill = resolve(props, 'var(--color-accent)');
          const ink = resolve(props, 'var(--color-on-accent)');
          rows.push({
            key: `${label} on-accent on accent`,
            ratio: fill && ink ? contrast(ink, fill) : null,
          });
        }
  return rows;
}

describe('Studio contrast (mode × sleep × accent × skin, AA 4.5:1)', () => {
  const rows = evaluate();
  it('resolves every token', () => {
    expect(rows.filter((r) => r.ratio === null).map((r) => r.key)).toEqual([]);
  });
  it('has no combination below AA', () => {
    expect(
      rows
        .filter((r) => r.ratio !== null && r.ratio < AA)
        .map((r) => `${r.key} ${r.ratio?.toFixed(2)}`),
    ).toEqual([]);
  });
  it('covers every accent in both modes', () => {
    expect(ACCENTS.length).toBe(9);
    expect(rows.length).toBe(2 * 9 * 2 * 6 * (TEXT.length * SURFACES.length + 1));
  });
});
