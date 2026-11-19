/**
 * SPO-586: the looks that load lazily (Brass Glass, Cyberpunk, Halloween, Christmas) are copied into the Themes cards'
 * iframes next to Studio's own. A rule of such a bundle that is not scoped to its own `data-theme` would restyle the
 * Studio card (and any other look) the moment the bundle is on the page. Every selector of every bundle CSS file must
 * name its own look, except the rules listed below (frozen: this list only shrinks).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'client/src');
const LOOKS = ['glass', 'cyberpunk', 'halloween', 'christmas'] as const;
/** Class namespaces rendered only by one look's own components (HalloweenLantern, ChristmasWreath). */
const OWN_CLASSES = ['hw-', 'hwl-', 'xw-'];

function cssFilesOf(look: string): string[] {
  const ts = readFileSync(resolve(SRC, `themes/bundles/${look}.ts`), 'utf8');
  return [...ts.matchAll(/import '(\.[^']+\.css)'/g)].map((m) =>
    resolve(SRC, 'themes/bundles', m[1]),
  );
}

const inAtRule = (rule: Rule, names: string[]): boolean => {
  for (let p = rule.parent; p; p = p.parent)
    if (p.type === 'atrule' && names.includes((p as AtRule).name)) return true;
  return false;
};

function unscoped(look: string): string[] {
  const out: string[] = [];
  for (const file of cssFilesOf(look)) {
    const root = postcss.parse(readFileSync(file, 'utf8'));
    root.walkRules((rule) => {
      if (inAtRule(rule, ['keyframes', '-webkit-keyframes', 'font-face'])) return;
      // Palette primitives (`--c-1a2b3c`, `--cy-px-12`) name a value, never a shared semantic token: no restyling.
      if (
        rule.selectors.every((x) => x.trim() === ':root') &&
        rule.nodes.every((n) => n.type !== 'decl' || /^--(c|cy)-[0-9a-z-]+$/.test(n.prop))
      )
        return;
      for (const sel of rule.selectors) {
        if (sel.includes(`data-theme="${look}"`) || sel.includes(`data-theme='${look}'`)) continue;
        if (sel.includes(`.theme-${look}`)) continue;
        // classes that only this look renders (its mascot components) cannot touch another look's cards
        const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        if (classes.length > 0 && classes.every((c) => OWN_CLASSES.some((p) => c.startsWith(p))))
          continue;
        out.push(`${file.replace(SRC, '')}: ${sel.trim().slice(0, 120)}`);
      }
    });
  }
  return out;
}

describe('lazy look bundles stay inside their own data-theme (SPO-586)', () => {
  for (const look of LOOKS)
    it(`${look}: every selector names its own look`, () => {
      const leaks = unscoped(look);
      expect(leaks.length, `unscoped selectors (first 12):\n${leaks.slice(0, 12).join('\n')}`).toBe(
        0,
      );
    });
});
