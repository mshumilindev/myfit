#!/usr/bin/env node
/** SPO-639 W6: node scripts/collect-ci-metrics.mjs [--out docs/reviews/metrics] — snapshot of CI speed/stability from GitHub (read-only, `gh api`). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slowestJobs, summarizeRuns } from './lib/ci-metrics.mjs';

const gh = (path) =>
  JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const repo = 'mshumilindev/myfit';
const runs = gh(
  `repos/${repo}/actions/workflows/ci.yml/runs?per_page=30&branch=main`,
).workflow_runs;
const jobs = runs
  .filter((r) => r.status === 'completed')
  .slice(0, 8)
  .flatMap((r) => gh(`repos/${repo}/actions/runs/${r.id}/jobs?per_page=100`).jobs);
const snap = {
  date: new Date().toISOString().slice(0, 10),
  ci: summarizeRuns(runs),
  slowestJobs: slowestJobs(jobs),
};
const out = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'docs/reviews/metrics';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `ci-${snap.date}.json`), `${JSON.stringify(snap, null, 2)}\n`);
console.log(JSON.stringify(snap));
