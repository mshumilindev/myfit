#!/usr/bin/env node
// Markdown report of stale/waiting remote branches (read-only). CI appends it to the job summary.
import { execFileSync } from 'node:child_process';
import { renderHygiene } from './lib/hygiene-report.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const merged = new Set(
  git('branch', '-r', '--merged', 'origin/main', '--format=%(refname:short)').split('\n'),
);
const rows = git(
  'for-each-ref',
  'refs/remotes/origin',
  '--format=%(refname:short)|%(committerdate:iso8601-strict)',
)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [ref, lastCommit] = l.split('|');
    return { name: ref.replace(/^origin\//, ''), mergedIntoMain: merged.has(ref), lastCommit };
  })
  .filter((b) => b.name !== 'HEAD' && b.name !== 'origin');
process.stdout.write(renderHygiene(rows));
