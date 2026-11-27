#!/usr/bin/env node
/** SPO-639 W2: node scripts/check-bundle-budget.mjs [--update] — fail if the built client grew past bundle-budget.json. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { check, eagerFiles, measure } from './lib/bundle-budget.mjs';

const dist = 'client/dist';
if (!existsSync(`${dist}/index.html`)) {
  console.error('bundle-budget: немає client/dist, спершу `npm run build -w client`');
  process.exit(2);
}
const measured = measure(dist, eagerFiles(dist));
console.log(
  `bundle-budget: initial ${measured.initialJsGzip} B gzip, total ${measured.totalJsGzip} B gzip`,
);
if (process.argv.includes('--update')) {
  const old = existsSync('bundle-budget.json')
    ? JSON.parse(readFileSync('bundle-budget.json', 'utf8'))
    : null;
  const next = {
    // 2% headroom over the measurement; only ever lowered
    totalJsGzip: Math.min(old?.totalJsGzip ?? Infinity, Math.ceil(measured.totalJsGzip * 1.02)),
    initialJsGzip: Math.min(
      old?.initialJsGzip ?? Infinity,
      Math.ceil(measured.initialJsGzip * 1.02),
    ),
  };
  writeFileSync('bundle-budget.json', `${JSON.stringify(next, null, 2)}\n`);
  console.log('bundle-budget: оновлено (лише вниз)', next);
} else {
  const budget = JSON.parse(readFileSync('bundle-budget.json', 'utf8'));
  const problems = check(measured, budget);
  if (problems.length) {
    for (const p of problems) console.error(`bundle-budget FAIL ${p}`);
    process.exit(1);
  }
  console.log('bundle-budget: у межах бюджету');
}
