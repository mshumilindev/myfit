#!/usr/bin/env node
/**
 * Stylelint baseline ratchet (SPO-136, ADR 010).
 *
 * Existing violations are frozen per file and per rule in tests/stylelint-baseline.json and may
 * only SHRINK. A new violation (a file/rule count above its baseline) fails; fix it with a token
 * instead of raising the baseline.
 *
 *   npm run lint:css                        # all client CSS (CI)
 *   npm run lint:css -- --files a.css b.css # only these files (pre-push: changed files)
 *   npm run lint:css -- --write             # lower the baseline after cleaning up (never raises)
 *   npm run lint:css -- --init              # (re)create the baseline from the current state
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'tests', 'stylelint-baseline.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const init = args.includes('--init');
const filesIdx = args.indexOf('--files');
const only =
  filesIdx > -1
    ? args
        .slice(filesIdx + 1)
        .filter((a) => !a.startsWith('--'))
        .filter((f) => /^client\/src\/.+\.css$/.test(f))
    : null;

if (only && only.length === 0) {
  console.log('lint:css — no client CSS files to check.');
  process.exit(0);
}

const result = await stylelint.lint({
  cwd: root,
  configFile: join(root, 'stylelint.config.mjs'),
  files: only ?? ['client/src/**/*.css'],
  ignoreDisables: false,
});

/** @type {Record<string, Record<string, number>>} */
const current = {};
/** @type {Record<string, Record<string, string[]>>} */
const where = {};
for (const r of result.results) {
  const file = relative(root, r.source).split('\\').join('/');
  for (const w of r.warnings) {
    if (!w.rule) {
      console.error(`lint:css — ${file}:${w.line} ${w.text}`);
      process.exitCode = 2;
      continue;
    }
    (current[file] ??= {})[w.rule] = (current[file][w.rule] ?? 0) + 1;
    ((where[file] ??= {})[w.rule] ??= []).push(`${w.line}:${w.column}`);
  }
}
if (process.exitCode === 2) process.exit(2);

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { files: {} };
const base = baseline.files ?? {};

if (init) {
  const files = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, JSON.stringify({ files }, null, 2) + '\n');
  console.log(`lint:css — baseline written: ${Object.keys(files).length} files.`);
  process.exit(0);
}

const scope = only ? new Set(only) : null;
const inScope = (f) => (scope ? scope.has(f) : true);

const raised = [];
const lowered = [];
for (const f of new Set([...Object.keys(current), ...Object.keys(base)])) {
  if (!inScope(f)) continue;
  for (const rule of new Set([...Object.keys(current[f] ?? {}), ...Object.keys(base[f] ?? {})])) {
    const c = current[f]?.[rule] ?? 0;
    const b = base[f]?.[rule] ?? 0;
    if (c > b) raised.push({ f, rule, c, b, at: where[f]?.[rule] ?? [] });
    else if (c < b) lowered.push({ f, rule, c, b });
  }
}

if (write) {
  if (raised.length) {
    console.error('lint:css --write refuses to raise the baseline; fix the new violations first.');
    process.exit(1);
  }
  const next = structuredClone(base);
  for (const { f, rule, c } of lowered) {
    if (c === 0) {
      delete next[f][rule];
      if (!Object.keys(next[f]).length) delete next[f];
    } else next[f][rule] = c;
  }
  // a file that no longer exists drops out of the baseline
  if (!only) for (const f of Object.keys(next)) if (!existsSync(join(root, f))) delete next[f];
  const files = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, JSON.stringify({ files }, null, 2) + '\n');
  console.log(`lint:css — baseline lowered for ${lowered.length} file/rule pairs.`);
  process.exit(0);
}

if (raised.length) {
  console.error('lint:css — NEW violations (the baseline may only shrink):\n');
  for (const { f, rule, c, b, at } of raised) {
    console.error(
      `  ${f}  ${rule}: ${c} (baseline ${b})  lines ${at.slice(0, 8).join(', ')}${at.length > 8 ? ', …' : ''}`,
    );
  }
  console.error(
    '\nFix them with a token (see docs/adr/010-token-model-and-single-styling-mechanism.md).',
  );
  process.exit(1);
}

const totals = {};
for (const [f, rules] of Object.entries(current)) {
  if (!inScope(f)) continue;
  for (const [rule, n] of Object.entries(rules)) totals[rule] = (totals[rule] ?? 0) + n;
}
console.log(
  `lint:css — OK, no new violations. Frozen: ${
    Object.entries(totals)
      .map(([r, n]) => `${r}=${n}`)
      .join(', ') || 'none'
  }.${lowered.length ? ` ${lowered.length} file/rule pairs improved: run \`npm run lint:css -- --write\` to lock it in.` : ''}`,
);
