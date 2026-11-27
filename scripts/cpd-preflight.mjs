#!/usr/bin/env node
/** SPO-639: node scripts/cpd-preflight.mjs — list ready-for-cpd/* branches (local + origin) before and during cpd. Never throws. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureFreshness, renderPreflight } from './lib/cpd-preflight.mjs';
import { journalDirs, readJournalDirs } from './lib/journal.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function newestShardTs() {
  let max;
  const base = join(ROOT, 'docs/reviews/dash');
  if (!existsSync(base)) return max;
  for (const d of readdirSync(base)) {
    let files;
    try {
      files = readdirSync(join(base, d)).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const ts = JSON.parse(readFileSync(join(base, d, f), 'utf8')).lastTs;
        if (typeof ts === 'number' && (max === undefined || ts > max)) max = ts;
      } catch {
        /* skip a broken shard */
      }
    }
  }
  return max;
}
function newestJournalTs() {
  try {
    const { entries } = readJournalDirs(journalDirs({ stateDir: join(ROOT, '.claude/state') }));
    return entries.reduce((m, e) => (e.ts > m ? e.ts : m), 0) || undefined;
  } catch {
    return undefined;
  }
}

const git = (...a) =>
  execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
try {
  const names = new Set(
    git('branch', '-a', '--format=%(refname:short)', '--list', '*ready-for-cpd/*')
      .split('\n')
      .filter(Boolean)
      .map((n) => n.replace(/^origin\//, '')),
  );
  const branches = [...names].map((name) => {
    let ref = name;
    try {
      git('rev-parse', '--verify', '--quiet', name);
    } catch {
      ref = `origin/${name}`;
    }
    let ahead;
    try {
      ahead = Number(git('rev-list', '--count', `origin/main..${ref}`));
    } catch {
      ahead = 1; // cannot tell → treat as needing a look, never as stale
    }
    return { name, ahead };
  });
  let unpushed = 0;
  try {
    unpushed = Number(git('rev-list', '--count', 'origin/main..HEAD'));
  } catch {
    /* no origin */
  }
  const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
  console.log(
    renderPreflight({
      branches,
      unpushed,
      dirty,
      capture: captureFreshness({ journalTs: newestJournalTs(), shardTs: newestShardTs() }),
    }),
  );
} catch {
  console.log(
    '[cpd-preflight] не вдалося прочитати git; перевір `git branch --list "ready-for-cpd/*"` вручну',
  );
}
