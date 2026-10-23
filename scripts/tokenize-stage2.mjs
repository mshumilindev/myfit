#!/usr/bin/env node
/**
 * Value-preserving tokenisation, stage by stage (SPO-136, ADR 010). Every replacement keeps the
 * computed value identical; the screenshot diff (before/after, pixel by pixel) is the proof.
 *   node scripts/tokenize-stage2.mjs --stage z|hex|rgba|border|size [--dry]
 * Definitions are appended to client/src/tokens/primitives.css (between per-stage markers).
 */
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const stage = process.argv[process.argv.indexOf('--stage') + 1];
const dry = process.argv.includes('--dry');
const SRC = 'client/src';
const PRIM = path.join(SRC, 'tokens/primitives.css');
const SKIP = [/views\/landing\//, /appCrash\.css$/, /tokens\/primitives\.css$/];

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (p.endsWith('.css') && !SKIP.some((r) => r.test(p))) files.push(p);
  }
})(SRC);

const defined = new Set(); // custom properties already declared anywhere
const parsed = new Map();
for (const f of [...files, PRIM]) {
  if (!fs.existsSync(f)) continue;
  const root = postcss.parse(fs.readFileSync(f, 'utf8'));
  parsed.set(f, root);
  root.walkDecls(/^--/, (d) => defined.add(d.prop));
}

const defs = new Map(); // name -> value, new definitions for primitives.css
let changed = 0;
const touched = new Set();
const bump = (f) => {
  changed++;
  touched.add(f);
};

/** hex helpers */
const norm = (h) => {
  h = h.toLowerCase().slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return h;
};
const hexRe = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b/g;
/** replace outside url(...) / quoted strings */
const mapOutside = (value, fn) => {
  const parts = value.split(/(url\([^)]*\)|"[^"]*"|'[^']*')/);
  return parts.map((p, i) => (i % 2 ? p : fn(p))).join('');
};

if (stage === 'z') {
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls('z-index', (d) => {
      if (!/^-?\d+$/.test(d.value.trim())) return;
      const n = Number(d.value.trim());
      const name = n < 0 ? `--z-n${-n}` : `--z-${n}`;
      if (!defined.has(name)) defs.set(name, String(n));
      d.value = `var(${name})`;
      bump(f);
    });
  }
} else if (stage === 'hex') {
  // 1) own-value definitions (--c-1d2024: #1d2024) move into primitives.css
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls(/^--c-[0-9a-f]{3,8}$/, (d) => {
      const m = d.value.trim().match(/^#[0-9a-fA-F]+$/);
      if (m && norm(m[0]) === d.prop.slice(4)) {
        defs.set(d.prop, `#${d.prop.slice(4)}`);
        d.remove();
        bump(f);
      }
    });
  }
  // 2) every other hex literal becomes var(--c-<hex6|8>)
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls((d) => {
      if (!hexRe.test(d.value)) return;
      hexRe.lastIndex = 0;
      const next = mapOutside(d.value, (seg) =>
        seg.replace(hexRe, (h) => {
          const k = norm(h);
          const name = `--c-${k}`;
          if (!defined.has(name)) defs.set(name, `#${k}`);
          return `var(${name})`;
        }),
      );
      if (next !== d.value) {
        d.value = next;
        bump(f);
      }
    });
  }
} else if (stage === 'rgba') {
  // rgb()/rgba() with numeric channels -> var(--c-<hex6>[-a<alpha*1000>]); the primitive keeps the exact colour
  const re = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)/g;
  const h2 = (n) => Number(n).toString(16).padStart(2, '0');
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls((d) => {
      if (!/rgba?\(/.test(d.value)) return;
      const next = mapOutside(d.value, (seg) =>
        seg.replace(re, (_m, r, g, b, a) => {
          if ([r, g, b].some((x) => Number(x) > 255)) return _m;
          const hex = `${h2(r)}${h2(g)}${h2(b)}`;
          const alpha = a === undefined ? 1 : Number(a);
          if (!(alpha >= 0 && alpha <= 1)) return _m;
          const name = alpha === 1 ? `--c-${hex}` : `--c-${hex}-a${Math.round(alpha * 1000)}`;
          const value =
            alpha === 1 ? `#${hex}` : `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${alpha})`;
          if (defs.has(name) && defs.get(name) !== value) throw new Error(`token clash ${name}`);
          if (!defined.has(name)) defs.set(name, value);
          return `var(${name})`;
        }),
      );
      if (next !== d.value) {
        d.value = next;
        bump(f);
      }
    });
  }
} else if (stage === 'border') {
  const re = /^(\s*)1px(\s+(solid|dashed|dotted)\b)/;
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls(/^(border|border-(top|right|bottom|left)|outline)$/, (d) => {
      if (re.test(d.value)) {
        d.value = d.value.replace(re, '$1var(--bw-1)$2');
        bump(f);
      }
    });
    root.walkDecls(/^(border|outline)(-(top|right|bottom|left))?-width$/, (d) => {
      if (d.value.trim() === '1px') {
        d.value = 'var(--bw-1)';
        bump(f);
      }
    });
  }
  if (!defined.has('--bw-1')) defs.set('--bw-1', '1px');
} else if (stage === 'size') {
  const count = {};
  const re = /^(min-|max-)?(width|height)$/;
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls(re, (d) => {
      if (/^\d+px$/.test(d.value.trim())) count[d.value.trim()] = (count[d.value.trim()] || 0) + 1;
    });
  }
  const keep = new Set(
    Object.entries(count)
      .filter(([, n]) => n >= 10)
      .map(([v]) => v),
  );
  for (const [f, root] of parsed) {
    if (f === PRIM) continue;
    root.walkDecls(re, (d) => {
      const v = d.value.trim();
      if (!keep.has(v)) return;
      const name = `--sz-${parseInt(v, 10)}`;
      if (!defined.has(name)) defs.set(name, v);
      d.value = `var(${name})`;
      bump(f);
    });
  }
} else {
  console.error('usage: --stage z|hex|rgba|border|size [--dry]');
  process.exit(2);
}

console.log(
  `stage ${stage}: ${changed} declarations in ${touched.size} files, ${defs.size} new tokens`,
);
if (dry) process.exit(0);

for (const f of touched) fs.writeFileSync(f, parsed.get(f).toString());
if (defs.size) {
  fs.mkdirSync(path.dirname(PRIM), { recursive: true });
  let body = fs.existsSync(PRIM)
    ? fs.readFileSync(PRIM, 'utf8')
    : '/* Tier 1 — primitives (ADR 010). Raw values live here and only here; everything else reads them\n   through var(). Generated by scripts/tokenize-stage2.mjs, then maintained by hand. */\n';
  body += `\n/* stage: ${stage} */\n:root {\n`;
  for (const [k, v] of [...defs].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })))
    body += `  ${k}: ${v};\n`;
  body += '}\n';
  fs.writeFileSync(PRIM, body);
}
