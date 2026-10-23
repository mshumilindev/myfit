#!/usr/bin/env node
/**
 * Fast local gate for the files you changed (SPO-125). Not a replacement for CI:
 * CI still runs the full lint / types / coverage / build / layout audits and the pre-push hook
 * still runs the full gate. This catches ~all regressions in seconds instead of minutes.
 *
 *   npm run check:fast            # changed vs HEAD (+ untracked)
 *   npm run check:fast -- --base origin/main
 *
 * Steps (stop at first failure): prettier --check, eslint, client tsc (if client files changed),
 * vitest `related` for changed source/test files, plus the always-on guards
 * (kit-guard, hygiene-ratchet, i18n-length).
 */
import { spawnSync } from 'node:child_process';

const baseIdx = process.argv.indexOf('--base');
const base = baseIdx > -1 ? process.argv[baseIdx + 1] : 'HEAD';
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const lines = (r) =>
  (r.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const changed = [
  ...lines(sh('git', ['diff', '--name-only', '--diff-filter=ACMR', base, '--'])),
  ...lines(sh('git', ['ls-files', '--others', '--exclude-standard'])),
].filter((f, i, a) => a.indexOf(f) === i);

const code = changed.filter((f) => /\.(tsx?|mjs|cjs|js)$/.test(f));
const fmt = changed.filter(
  (f) => /\.(tsx?|mjs|cjs|js|css|json|md)$/.test(f) && !/package-lock\.json$/.test(f),
);
const clientTouched = changed.some((f) => f.startsWith('client/'));
const srcOrTests = code.filter((f) => /^(client\/src|tests|functions\/src)\//.test(f));

let t0 = Date.now();
const step = (name, cmd, args) => {
  process.stdout.write(`▶ ${name} … `);
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  t0 = Date.now();
  if (r.status !== 0) {
    console.log(`FAIL (${s}s)`);
    process.stdout.write((r.stdout || '') + (r.stderr || ''));
    process.exit(r.status || 1);
  }
  console.log(`ok (${s}s)`);
};

console.log(`changed files: ${changed.length}`);
if (!changed.length)
  console.log('nothing changed vs ' + base + '; running only the always-on guards');
if (fmt.length) step('prettier --check', 'npx', ['prettier', '--check', ...fmt]);
if (code.length) step('eslint', 'npx', ['eslint', '--max-warnings=1000', ...code]);
if (changed.some((f) => /^client\/src\/.+\.css$/.test(f)))
  step('stylelint ratchet', 'node', ['scripts/stylelint-ratchet.mjs']);
if (clientTouched)
  step('client typecheck', 'npx', ['tsc', '-p', 'client/tsconfig.json', '--noEmit']);
if (srcOrTests.length)
  step('vitest related', 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...srcOrTests]);
step('guards (kit / hygiene / i18n-length)', 'npx', [
  'vitest',
  'run',
  'tests/kit-guard.test.ts',
  'tests/hygiene-ratchet.guard.test.ts',
  'tests/i18n-length.test.ts',
]);
console.log('✓ fast check passed — CI and pre-push still run the full gate');
