#!/usr/bin/env node
/** SPO-639 W3: node scripts/check-lighthouse.mjs lh.json — fail if the Lighthouse performance score fell below lighthouse-budget.json. */
import { readFileSync } from 'node:fs';

export function verdict(score, floor) {
  return score >= floor ? { ok: true } : { ok: false, msg: `performance ${score} < ${floor}` };
}

if (process.argv[1]?.endsWith('check-lighthouse.mjs')) {
  const report = JSON.parse(readFileSync(process.argv[2] ?? 'lh.json', 'utf8'));
  const { performanceFloor } = JSON.parse(readFileSync('lighthouse-budget.json', 'utf8'));
  const score = report.categories.performance.score;
  const a = report.audits;
  console.log(
    `lighthouse: performance ${score}, LCP ${a['largest-contentful-paint'].displayValue}, TBT ${a['total-blocking-time'].displayValue}, CLS ${a['cumulative-layout-shift'].displayValue}`,
  );
  const v = verdict(score, performanceFloor);
  if (!v.ok) {
    console.error(`lighthouse FAIL ${v.msg}`);
    process.exit(1);
  }
}
