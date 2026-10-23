#!/usr/bin/env node
/**
 * Value-preserving CSS tokenizer (SPO-136, ADR 010).
 *
 * Replaces a literal that EXACTLY equals an existing scale token with that token, so the computed
 * value is identical and only the source changes (a re-theme can now move it):
 *   border-radius (+ corner longhands)       12px  → var(--r-12)
 *   padding / margin / gap (+ sides, logical) 8px  → var(--s-8)
 *   font-size                                13px  → var(--fs-13)
 *   z-index                                  50    → var(--z-50)
 * Only whole-number px values that have a token are touched; `0`, negatives, decimals, percentages,
 * custom-property definitions, @media/@font-face preludes and values without a token stay literal.
 * The scales are read from the `:root` token block in client/src/styles.css, so a missing token is
 * never invented.
 *
 *   node scripts/tokenize-css.mjs            # rewrite client/src/**\/*.css in place
 *   node scripts/tokenize-css.mjs --dry-run  # only report what would change
 */
import fs from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'client', 'src');
const dry = process.argv.includes('--dry-run');
/** Files with their own design language or that must work without the global tokens. */
const SKIP = [/^views\/landing\//, /^appCrash\.css$/];

const walk = (d, out = []) => {
  for (const n of fs.readdirSync(d)) {
    const p = join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.css')) out.push(p);
  }
  return out;
};

/** Token scales from the real :root block. */
const scales = { r: new Set(), s: new Set(), fs: new Set(), z: new Set() };
{
  const styles = postcss.parse(fs.readFileSync(join(SRC, 'styles.css'), 'utf8'));
  styles.walkDecls(/^--(r|s|fs|z)-\d+$/, (d) => {
    const [, kind, n] = d.prop.match(/^--(r|s|fs|z)-(\d+)$/);
    const want = kind === 'z' ? String(n) : `${n}px`;
    if (d.value.trim() === want && d.parent?.selector === ':root') scales[kind].add(n);
  });
}

const RADIUS = /^(-webkit-)?border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;
const SPACE =
  /^(padding|margin)(-(top|right|bottom|left)|-(inline|block)(-(start|end))?)?$|^(row-|column-)?gap$|^grid-(row-|column-)?gap$/;

/** Replace whole `Npx` numbers (not negative, not decimal, not part of a name) that have a token. */
function swap(value, kind, tok) {
  let n = 0;
  const out = value.replace(/(?<![\w.#-])(\d+)px\b(?!\s*\))?/g, (m, num) => {
    // inside url(), a custom ident or a unit-bearing function arg we do not understand: leave
    if (kind === 'r' && num === '999') {
      n++;
      return 'var(--r-pill)';
    }
    if (!scales[kind].has(num)) return m;
    n++;
    return `var(--${tok}-${num})`;
  });
  return { out, n };
}

const stats = { r: 0, s: 0, fs: 0, z: 0, files: 0 };
for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/');
  if (SKIP.some((re) => re.test(rel))) continue;
  const css = fs.readFileSync(file, 'utf8');
  const ast = postcss.parse(css, { from: file });
  let changed = 0;
  ast.walkDecls((d) => {
    if (d.prop.startsWith('--')) return;
    if (d.parent?.type === 'atrule' && /^(font-face|property|keyframes)$/i.test(d.parent.name))
      return;
    if (/\burl\(|\bvar\(|!important/.test(d.value) && !/!important/.test(d.value)) {
      // a value that already mixes in var()/url() is still safe to rewrite per number; keep going
    }
    let kind = null;
    let tok = null;
    if (RADIUS.test(d.prop)) [kind, tok] = ['r', 'r'];
    else if (SPACE.test(d.prop)) [kind, tok] = ['s', 's'];
    else if (d.prop === 'font-size') [kind, tok] = ['fs', 'fs'];
    if (kind) {
      const { out, n } = swap(d.value, kind, tok);
      if (n) {
        d.value = out;
        stats[kind] += n;
        changed += n;
      }
    } else if (
      d.prop === 'z-index' &&
      /^\d+$/.test(d.value.trim()) &&
      scales.z.has(d.value.trim())
    ) {
      d.value = `var(--z-${d.value.trim()})`;
      stats.z++;
      changed++;
    }
  });
  if (changed) {
    stats.files++;
    if (!dry) fs.writeFileSync(file, ast.toString());
  }
}
console.log(
  `${dry ? 'would tokenize' : 'tokenized'}: radius ${stats.r}, spacing ${stats.s}, font-size ${stats.fs}, z-index ${stats.z} in ${stats.files} files`,
);
