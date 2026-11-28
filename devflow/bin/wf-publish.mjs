#!/usr/bin/env node
/**
 * Publishes the live wf snapshot to a dedicated git branch (config.publish.branch) through the GitHub REST API,
 * so a widget on another machine can fetch it. One file per source: <dir>/<source>.json. Never fails the caller.
 *
 * Debounce: one publisher runs at a time (lock file); events that arrive meanwhile set a dirty flag and the
 * running publisher goes again after minIntervalMs, so a burst of wf events becomes one or two pushes.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { buildSnapshot } from './wf-snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(HERE, '..', 'devflow.config.json'), 'utf8'));
const PUB = CONFIG.publish ?? {};
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const STATE = join(ROOT, CONFIG.stateDir);
const LOCK = join(STATE, '.publish.lock');
const DIRTY = join(STATE, '.publish.dirty');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const git = (args, opts = {}) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  }).trim();

function source() {
  const id = (process.env.CLAUDE_CODE_SESSION_ID ?? process.env.CLAUDE_SESSION_ID ?? '').slice(-8);
  return `${basename(ROOT)}${id ? `-${id}` : ''}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

/** One commit on the state branch: parent tip + this source's file. Plumbing only, the working tree is never touched. */
function push(snapshot) {
  const path = `${PUB.dir}/${source()}.json`;
  let parent = '';
  try {
    git(['fetch', '--quiet', '--depth=1', 'origin', PUB.branch]);
    parent = git(['rev-parse', 'FETCH_HEAD']);
  } catch {
    /* the branch does not exist yet: the first commit is an orphan */
  }
  const index = join(STATE, '.publish.index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  rmSync(index, { force: true });
  if (parent) git(['read-tree', parent], { env });
  const blob = git(['hash-object', '-w', '--stdin'], { input: `${JSON.stringify(snapshot)}\n` });
  git(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
  const tree = git(['write-tree'], { env });
  const message = `wf-state ${snapshot.tasks[0]?.task ?? 'idle'} ${snapshot.tasks[0]?.pct ?? 0}%`;
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'wf',
      GIT_AUTHOR_EMAIL: 'wf@localhost',
      GIT_COMMITTER_NAME: 'wf',
      GIT_COMMITTER_EMAIL: 'wf@localhost',
    },
  });
  git(['push', '--quiet', 'origin', `${commit}:refs/heads/${PUB.branch}`]);
  rmSync(index, { force: true });
}

async function main() {
  if (!PUB.branch || !CONFIG.repo) return;
  writeFileSync(DIRTY, '1');
  if (existsSync(LOCK)) {
    const age = Date.now() - Number(readFileSync(LOCK, 'utf8') || 0);
    if (age < 60000) return; // another publisher is running and will see the dirty flag
  }
  writeFileSync(LOCK, String(Date.now()));
  try {
    while (existsSync(DIRTY)) {
      rmSync(DIRTY, { force: true });
      push(buildSnapshot({ root: ROOT, label: source() }));
      writeFileSync(LOCK, String(Date.now()));
      await sleep(PUB.minIntervalMs ?? 3000);
    }
  } catch (e) {
    console.error(
      `wf-publish: skipped (${e instanceof Error ? e.message.split('\n')[0] : 'error'})`,
    );
  } finally {
    rmSync(LOCK, { force: true });
  }
}

await main();
