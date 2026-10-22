#!/usr/bin/env node
/**
 * Pre-push (SPO-268): root-level tests (`tests/**`) only for what the push changed. The full root suite with the coverage
 * gate (`npm run test:coverage`: 500+ tests, ~3 min) stays in CI (`Unit tests + coverage gate`), so nothing is skipped
 * there. A change to the test setup / configs / dependencies runs the full suite here too.
 *
 *   node scripts/root-tests-related.mjs --base <ref>
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Paths whose change can affect every root test: run everything. */
export const RUN_ALL = [
  /^vitest\.config\.ts$/,
  /^tests\/setup\.ts$/,
  /^package(-lock)?\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^client\/vitest\.config\.ts$/,
];

export function plan(files) {
  if (files.length === 0) return { mode: 'skip', files };
  if (files.some((f) => RUN_ALL.some((re) => re.test(f)))) return { mode: 'all', files };
  return { mode: 'related', files };
}

function main(argv) {
  const i = argv.indexOf('--base');
  const base = i >= 0 ? argv[i + 1] : 'HEAD';
  const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=d', base], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const p = plan(files);
  if (p.mode === 'skip') {
    console.log('root-tests: no changes since the base - skipping');
    return 0;
  }
  const bin = join(ROOT, 'node_modules/.bin/vitest');
  const args =
    p.mode === 'all'
      ? ['run', '--coverage']
      : ['related', ...files, '--run', '--passWithNoTests', '--reporter=dot'];
  console.log(
    `root-tests: ${p.mode === 'all' ? 'config/deps changed - full suite with coverage' : `${files.length} changed file(s) - related tests only (full suite: CI)`}`,
  );
  return spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)));
