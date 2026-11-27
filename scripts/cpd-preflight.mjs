#!/usr/bin/env node
/** SPO-639: node scripts/cpd-preflight.mjs — list ready-for-cpd/* branches (local + origin) before and during cpd. Never throws. */
import { execFileSync } from 'node:child_process';
import { renderPreflight } from './lib/cpd-preflight.mjs';

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
  console.log(renderPreflight({ branches, unpushed, dirty }));
} catch {
  console.log(
    '[cpd-preflight] не вдалося прочитати git; перевір `git branch --list "ready-for-cpd/*"` вручну',
  );
}
