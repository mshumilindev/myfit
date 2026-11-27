#!/usr/bin/env node
/** SPO-639 (WF-C): SessionStart / UserPromptSubmit hook. stdout becomes context, so every turn starts with `wf status`. Never throws. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isValidState, renderStatus } from './lib/wf-core.mjs';

try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = join(process.env.WF_STATE_DIR ?? join(root, '.claude/state'), 'wf.json');
  const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  if (state && isValidState(state) && state.task) {
    console.log(`[wf]\n${renderStatus(state)}`);
    console.log(
      'Новий запит власника посеред роботи = `wf add`, а не зупинка. Не питай підтверджень; блокер лише cpd/access/legal/irreversible/design.',
    );
  } else {
    console.log(
      '[wf] немає активної задачі: для цього запиту спершу `node scripts/wf.mjs start <ID>` і `wf add` по пунктах плану, потім роби до доказу.',
    );
  }
  // owner said "cpd": show every ready-for-cpd branch so none is forgotten (SPO-639)
  let prompt = '';
  try {
    prompt = JSON.parse(readFileSync(0, 'utf8')).prompt ?? '';
  } catch {
    /* no stdin payload (SessionStart) */
  }
  if (/\bcpd\b/i.test(prompt)) {
    console.log(
      execFileSync('node', [join(root, 'scripts/cpd-preflight.mjs')], { encoding: 'utf8' }).trim(),
    );
  }
} catch {
  /* a broken hook must never trap a session */
}
