/**
 * Theme contract guard (SPO-344, ADR 010): every theme file in client/src/themes/ sets exactly the
 * tokens of contract.ts, only on its own html[data-theme=<id>], and is listed in the registry.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  SKIN_TOKENS_OPTIONAL,
  SKIN_TOKENS_REQUIRED,
  THEME_SKINS,
  THEME_TOKENS,
  THEME_TOKENS_OPTIONAL,
} from '../client/src/themes/contract';
import { AXES, THEMES } from '../client/src/themes/registry';

const DIR = join(__dirname, '..', 'client', 'src', 'themes');
const files = readdirSync(DIR).filter((f) => f.endsWith('.css') && !f.startsWith('_'));

describe('theme contract', () => {
  it('registry and theme files are the same list', () => {
    expect(files.map((f) => f.replace(/\.css$/, '')).sort()).toEqual(
      THEMES.map((t) => t.id).sort(),
    );
  });

  for (const file of files) {
    const id = file.replace(/\.css$/, '');
    it(`${id}: tokens only, on its own selector, exactly the contract`, () => {
      const root = postcss.parse(readFileSync(join(DIR, file), 'utf8'));
      const set = new Set<string>();
      const skins = new Map<string, Set<string>>();
      const stray: string[] = [];
      const base = `html[data-theme=${id}]`;
      root.walkRules((r) => {
        const sel = r.selector.replace(/["']/g, '').trim();
        if (sel === base) {
          r.walkDecls((d) => {
            if (d.prop.startsWith('--')) set.add(d.prop);
            else stray.push(d.prop);
          });
          return;
        }
        const mode = sel.startsWith(`${base}[data-mode=`) ? sel.slice(base.length + 11, -1) : '';
        if (mode && (AXES.mode.values as readonly string[]).includes(mode)) {
          r.walkDecls((d) => {
            if (!(THEME_TOKENS as readonly string[]).includes(d.prop))
              stray.push(`mode ${mode}: ${d.prop}`);
          });
          return;
        }
        const skin = sel.startsWith(`${base}.theme-`) ? sel.slice(base.length + 7) : '';
        if (!(THEME_SKINS as readonly string[]).includes(skin)) {
          stray.push(r.selector);
          return;
        }
        const tokens = skins.get(skin) ?? new Set<string>();
        skins.set(skin, tokens);
        r.walkDecls((d) => {
          if (d.prop.startsWith('--')) tokens.add(d.prop);
          else stray.push(`${skin}: ${d.prop}`);
        });
      });
      root.walkAtRules((a) => stray.push(`@${a.name}`));
      expect(stray, 'a theme file holds tokens only').toEqual([]);
      expect(
        [...THEME_TOKENS].filter((t) => !set.has(t)),
        'missing tokens',
      ).toEqual([]);
      expect(
        [...set].filter(
          (t) =>
            !(THEME_TOKENS as readonly string[]).includes(t) &&
            !(THEME_TOKENS_OPTIONAL as readonly string[]).includes(t),
        ),
        'tokens outside the contract',
      ).toEqual([]);
      const allowed = new Set<string>([...SKIN_TOKENS_REQUIRED, ...SKIN_TOKENS_OPTIONAL]);
      for (const skin of THEME_SKINS) {
        const tokens = skins.get(skin) ?? new Set<string>();
        expect(
          [...SKIN_TOKENS_REQUIRED].filter((t) => !tokens.has(t)),
          `skin ${skin}: missing tokens`,
        ).toEqual([]);
        expect(
          [...tokens].filter((t) => !allowed.has(t)),
          `skin ${skin}: tokens outside the contract`,
        ).toEqual([]);
      }
    });
  }

  it('every non-default axis value has a CSS block, every default is listed first', () => {
    const css = readdirSync(DIR)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(DIR, f), 'utf8').replace(/["']/g, ''))
      .join('\n');
    for (const [axis, def] of Object.entries(AXES)) {
      expect(def.values[0], `${axis}: default first`).toBe(def.default);
      for (const v of def.values.slice(1))
        expect(css, `${axis}=${v} has no CSS block`).toContain(`[${def.attr}=${v}]`);
    }
  });
});
