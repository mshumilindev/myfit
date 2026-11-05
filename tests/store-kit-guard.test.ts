/**
 * Store kit guard (ADR 015, docs/UI-KIT.md «Store kit»). The add-on store has its own kit; this keeps it a real one:
 * raw values live only in `store-kit/tokens.css`, every `Sk*` component has CSS, a story and a test, and is documented.
 * LEGACY lists files not yet migrated onto tokens; it may only shrink (a listed file that is clean fails — remove it).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'client', 'src');
const DIRS = ['store-kit', 'addonStore'].map((d) => join(SRC, d));
const TOKENS = join(SRC, 'store-kit', 'tokens.css');

/** Migration debt (SPO-512): shrink to []. */
const LEGACY: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const all = DIRS.flatMap((d) => walk(d));
const rel = (f: string) => relative(SRC, f).split('\\').join('/');
const shipped = all.filter(
  (f) =>
    /\.(css|tsx?)$/.test(f) &&
    !/\.(test|stories)\.tsx?$/.test(f) &&
    f !== TOKENS &&
    !/\/store-kit\/tokens[\w.-]*\.css$/.test(f.split('\\').join('/')),
);
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');

function violations(f: string): string[] {
  const text = strip(readFileSync(f, 'utf8'));
  const v: string[] = [];
  if (f.endsWith('.css')) {
    if (/#[0-9a-fA-F]{3,8}\b/.test(text)) v.push('hex colour');
    if (/\brgba?\(/.test(text)) v.push('rgb()');
    if (/!important/.test(text)) v.push('!important');
    const px = text
      .match(/(?<![\w-])(?!0?\.?[0-2]px\b)-?\d*\.?\d+px\b/g)
      ?.filter((x) => !/^-?[12]px$/.test(x));
    if (px?.length) v.push(`raw px: ${[...new Set(px)].slice(0, 5).join(', ')}`);
  } else {
    if (/style=\{\{(?!\s*['"]--)/.test(text))
      v.push('inline style (use a class or a --custom-property)');
    if (/#[0-9a-fA-F]{6}\b/.test(text)) v.push('hex colour');
  }
  if (text.split('\n').length > 400) v.push('over 400 lines');
  return v;
}

describe('store kit guard', () => {
  it('has no raw values outside tokens.css (legacy files excepted)', () => {
    const bad = shipped
      .filter((f) => !LEGACY.includes(rel(f)))
      .map((f) => [rel(f), violations(f)] as const)
      .filter(([, v]) => v.length);
    expect(bad).toEqual([]);
  });
  it('LEGACY only lists files that exist and still violate', () => {
    for (const l of LEGACY) {
      const f = join(SRC, l);
      expect(existsSync(f), `${l} is gone — remove it from LEGACY`).toBe(true);
      expect(violations(f).length, `${l} is clean — remove it from LEGACY`).toBeGreaterThan(0);
    }
  });
  it('every Sk component has CSS, a story and a test, and is listed in docs/UI-KIT.md', () => {
    const ui = join(SRC, 'store-kit', 'ui');
    const doc = readFileSync(join(__dirname, '..', 'docs', 'UI-KIT.md'), 'utf8');
    const missing: string[] = [];
    for (const f of readdirSync(ui).filter(
      (n) => /^Sk\w+\.tsx$/.test(n) && !/\.(test|stories)\./.test(n),
    )) {
      const name = f.replace(/\.tsx$/, '');
      for (const ext of ['css', 'stories.tsx', 'test.tsx'])
        if (!existsSync(join(ui, `${name}.${ext}`))) missing.push(`${name}.${ext}`);
      if (!doc.includes(`\`${name}\``)) missing.push(`${name} in docs/UI-KIT.md`);
    }
    expect(missing).toEqual([]);
  });
});
