/**
 * SPO-639 W2: bundle budget ratchet. `measure` sums gzip size of the entry/initial chunks and of all JS;
 * `check` compares with bundle-budget.json. The ceiling may only go down (a raise needs an explicit owner decision and an ADR).
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** @param {string} distDir @param {Set<string>} [initialFiles] names loaded eagerly by index.html */
export function measure(distDir, initialFiles) {
  const js = walk(distDir).filter((f) => f.endsWith('.js'));
  const gz = (f) => gzipSync(readFileSync(f)).length;
  let total = 0;
  let initial = 0;
  for (const f of js) {
    const size = gz(f);
    total += size;
    if (initialFiles?.has(f.slice(distDir.length + 1))) initial += size;
  }
  return { totalJsGzip: total, initialJsGzip: initial };
}

export function eagerFiles(distDir) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const out = new Set();
  for (const m of html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)) out.add(m[1]);
  return out;
}

export function check(measured, budget) {
  const problems = [];
  for (const key of ['totalJsGzip', 'initialJsGzip']) {
    if (measured[key] > budget[key])
      problems.push(
        `${key}: ${measured[key]} > ${budget[key]} (+${measured[key] - budget[key]} B)`,
      );
  }
  return problems;
}
