#!/usr/bin/env node
/**
 * Post-deploy smoke of the Coach backend (SPO-364, docs/COACH-BACKEND.md section 8). Read-only, no account, no data written:
 *   node scripts/coach-smoke.mjs [--project spotter-64c3b] [--region us-central1] [--indexes]
 *
 *  1. every Coach callable answers (a deployed one refuses an anonymous call with 4xx; 404 = not deployed) within 15 s;
 *  2. with --indexes: every composite index of firestore.indexes.json exists on the project (needs `firebase login`).
 * Exit code 1 when anything is missing, broken or slow: that is what the app would show as "Coach is taking too long".
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { COACH_CALLABLES, classifyCallableProbe, missingIndexes } from './lib/coachSmoke.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const project = arg('project', 'spotter-64c3b');
const region = arg('region', 'us-central1');
let bad = 0;

for (const name of COACH_CALLABLES) {
  const t0 = Date.now();
  let status;
  try {
    const res = await fetch(`https://${region}-${project}.cloudfunctions.net/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
      signal: AbortSignal.timeout(20_000),
    });
    status = res.status;
  } catch {
    status = 599;
  }
  const r = classifyCallableProbe({ status, ms: Date.now() - t0 });
  if (!r.ok) bad++;
  console.log(
    `${r.ok ? '  ok  ' : 'FAIL  '}${name}  ${r.state} (HTTP ${status}, ${Date.now() - t0} ms)`,
  );
}

if (process.argv.includes('--indexes')) {
  const live = JSON.parse(
    execFileSync('firebase', ['firestore:indexes', '--project', project], { encoding: 'utf8' }),
  );
  const miss = missingIndexes(JSON.parse(readFileSync('firestore.indexes.json', 'utf8')), live);
  for (const m of miss) console.log(`FAIL  index missing: ${m}`);
  if (miss.length) bad += miss.length;
  else console.log('  ok  all composite indexes present');
}

console.log(
  bad
    ? `\n${bad} problem(s): deploy the missing parts (docs/COACH-BACKEND.md, 7.2)`
    : '\nCoach backend smoke: ok',
);
process.exit(bad ? 1 : 0);
