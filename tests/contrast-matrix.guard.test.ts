/**
 * Contrast matrix guard (SPO-136, ADR 010): WCAG AA (4.5:1) for every text token on every surface
 * token, for every theme × mode × app-skin combination the CSS can produce. Values come from the
 * real stylesheets (tests/helpers/themeMatrix.ts), not from a hand-kept copy.
 *
 * No baseline: every combination passes today, so a new theme, mode or skin that fails AA is a
 * red build. Fix its tokens; do not loosen the test.
 */
import { describe, expect, it } from 'vitest';
import { THEME_IDS, cascade, contrast, over, resolve, type HtmlState } from './helpers/themeMatrix';

/** graphite = no data-theme (the base palette); every file in client/src/themes/ is found by itself. */
const THEMES: Record<string, Record<string, string>> = {
  graphite: {},
  ...Object.fromEntries(THEME_IDS.map((id) => [id, { 'data-theme': id }])),
};
const MODES: Record<string, Record<string, string>> = {
  day: {},
  night: { 'data-sleep': 'night' },
};
const SKINS = ['none', 'apex', 'roster', 'learn', 'coach', 'nutrition'];
const TEXT = ['--color-text', '--color-text-muted', '--color-text-faint', '--color-accent-text'];
const SURFACES = ['--color-bg', '--color-surface', '--color-surface-2', '--color-tile'];
const AA = 4.5;

interface Row {
  key: string;
  ratio: number | null;
}

function evaluate(): Row[] {
  const rows: Row[] = [];
  for (const [theme, themeAttrs] of Object.entries(THEMES))
    for (const [mode, attrs] of Object.entries(MODES))
      for (const skin of SKINS) {
        const state: HtmlState = {
          classes: skin === 'none' ? [] : [`theme-${skin}`],
          attrs: { ...themeAttrs, ...attrs },
        };
        const props = cascade(state);
        const bg = resolve(props, 'var(--color-bg)');
        const surfaces = [
          ...SURFACES,
          ...(props.has('--glass-surface') ? ['--glass-surface'] : []),
        ];
        for (const s of surfaces)
          for (const t of TEXT) {
            const key = `${theme}/${mode}/${skin} ${t} on ${s}`;
            const fg = resolve(props, `var(${t})`);
            let back = resolve(props, `var(${s})`);
            if (back && back[3] < 1 && bg) back = over(back, bg);
            let fgc = fg;
            if (fgc && back && fgc[3] < 1) fgc = over(fgc, back);
            rows.push({ key, ratio: fgc && back ? contrast(fgc, back) : null });
          }
      }
  return rows;
}

describe('contrast matrix (theme × mode × skin, AA 4.5:1)', () => {
  const rows = evaluate();
  const failing = rows.filter((r) => r.ratio !== null && r.ratio < AA).map((r) => r.key);
  const unresolved = rows.filter((r) => r.ratio === null).map((r) => r.key);

  it('resolves every token the matrix needs', () => {
    expect(unresolved).toEqual([]);
  });

  it('has no combination below AA', () => {
    expect(failing).toEqual([]);
  });

  it('covers the whole matrix (every theme × 2 modes × 6 skins × text × surfaces)', () => {
    const themes = Object.keys(THEMES).length; // graphite + every file in client/src/themes
    const perCell = TEXT.length * (SURFACES.length * themes + (themes - 1)); // + --glass-surface per theme file
    expect(rows.length).toBe(Object.keys(MODES).length * SKINS.length * perCell);
  });
});
