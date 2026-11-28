#!/usr/bin/env node
/**
 * SPO-639 (WF-B): node scripts/wf-sync.mjs — publish `wf report` to the task's pinned Linear comment.
 * Needs LINEAR_API_KEY in the environment (.claude/settings.local.json `env`, or a CI secret).
 * Never fails a hook: a missing key or a network error prints one line and exits 0.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './wf.mjs';
import { syncProgress } from './lib/wf-linear.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state');
try {
  const state = JSON.parse(readFileSync(join(dir, 'wf.json'), 'utf8'));
  const { code, out } = run(['report'], { dir });
  if (code !== 0 || !state.task?.id) {
    console.log('wf-sync: немає активної задачі');
  } else {
    const result = await syncProgress({ task: state.task.id, report: out });
    console.log(`wf-sync: ${state.task.id} ${result}`);
  }
} catch (e) {
  console.log(`wf-sync: пропущено (${e instanceof Error ? e.message : 'помилка'})`);
}
