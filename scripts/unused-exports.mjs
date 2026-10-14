#!/usr/bin/env node
/**
 * Lightweight dead-export report (no install; a knip/ts-prune stand-in that does not need the 3.9 GB of RAM knip wants).
 *
 *   node scripts/unused-exports.mjs [dir ...] [--all] [--json] [--fail]
 *
 * Scans client/src (or the given dirs below it, e.g. `coach coachCrypto`). For every `export` it counts the files that
 * mention the name as a whole word and classifies it:
 *   unused     - mentioned nowhere outside its own file
 *   test-only  - only tests / stories mention it (production never uses it)
 *   prod       - used by production code (not printed unless --all)
 * Names marked `@internal planned` in the JSDoc just above the export are listed as "planned" instead (kept on purpose,
 * covered by a test that imports them from the public barrel). Type-only exports (types/interfaces) are skipped unless
 * --all. `--fail` exits 1 when a value export is unused AND not marked planned (use it in CI once the list is clean).
 * Heuristic by design: a name that is reused by an unrelated symbol elsewhere counts as used.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const dirs = argv.filter((a) => !a.startsWith('--'));
const root = resolve(new URL('..', import.meta.url).pathname, 'client/src');
const scanRoots = (dirs.length ? dirs : ['.']).map((d) => resolve(root, d));

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.vite',
  'storybook-static',
  '_to_delete',
]);
const isCode = (f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.endsWith('.d.ts');
const isTestish = (f) =>
  /\.(test|spec|stories)\.(ts|tsx)$/.test(f) ||
  /[\\/]stories[\\/]/.test(f) ||
  /testHelpers/.test(f);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP_DIR.has(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (isCode(n)) out.push(p);
  }
  return out;
}

const all = walk(root);
const text = new Map(all.map((f) => [f, readFileSync(f, 'utf8')]));

// name -> Set(files mentioning it)
const mentions = new Map();
for (const [f, src] of text) {
  const seen = new Set(src.match(/[A-Za-z_$][\w$]*/g) ?? []);
  for (const w of seen) {
    let s = mentions.get(w);
    if (!s) mentions.set(w, (s = new Set()));
    s.add(f);
  }
}

const EXPORT_RE =
  /^export\s+(?:declare\s+)?(?:async\s+)?(const|let|var|function\*?|class|enum|type|interface)\s+([A-Za-z_$][\w$]*)/gm;
const LIST_RE = /^export\s+(type\s+)?\{([^}]*)\}(?:\s+from\s+['"][^'"]+['"])?/gm;

const rows = [];
for (const f of all) {
  if (!scanRoots.some((r) => f.startsWith(r))) continue;
  if (isTestish(f)) continue;
  const src = text.get(f);
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const planned = (i) =>
    /@internal planned/.test(
      src
        .slice(Math.max(0, i - 400), i)
        .split('\n\n')
        .pop() ?? '',
    );
  const add = (name, kind, idx) => {
    if (name === 'default') return;
    const users = [...(mentions.get(name) ?? [])].filter((u) => u !== f);
    const prod = users.filter((u) => !isTestish(u));
    const status = prod.length ? 'prod' : users.length ? 'test-only' : 'unused';
    rows.push({
      file: relative(root, f),
      line: lineOf(idx),
      name,
      kind,
      status,
      planned: planned(idx),
      users: users.length,
    });
  };
  for (const m of src.matchAll(EXPORT_RE)) add(m[2], m[1], m.index);
  for (const m of src.matchAll(LIST_RE)) {
    for (const part of m[2].split(',')) {
      const nm = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (nm) add(nm, m[1] ? 'type' : 'value', m.index);
    }
  }
}

const isType = (r) => r.kind === 'type' || r.kind === 'interface';
const shown = rows.filter(
  (r) => (flags.has('--all') || r.status !== 'prod') && (flags.has('--all') || !isType(r)),
);
const bad = shown.filter((r) => r.status !== 'prod' && !r.planned);

if (flags.has('--json')) {
  console.log(JSON.stringify(shown, null, 2));
} else {
  const group = (title, list) => {
    if (!list.length) return;
    console.log(`\n== ${title} (${list.length})`);
    for (const r of list)
      console.log(`${r.file}:${r.line}  ${r.name}  [${r.kind}${r.planned ? ', planned' : ''}]`);
  };
  group(
    'unused (no other file mentions it)',
    shown.filter((r) => r.status === 'unused' && !r.planned),
  );
  group(
    'test-only (production never uses it)',
    shown.filter((r) => r.status === 'test-only' && !r.planned),
  );
  group(
    'planned (kept on purpose: @internal planned)',
    shown.filter((r) => r.planned),
  );
  if (flags.has('--all'))
    group(
      'used by production',
      shown.filter((r) => r.status === 'prod'),
    );
  console.log(
    `\n${rows.length} exports scanned, ${bad.length} value exports unused or test-only and not marked planned.`,
  );
}
if (flags.has('--fail') && bad.length) process.exit(1);
