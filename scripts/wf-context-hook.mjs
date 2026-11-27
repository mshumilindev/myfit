#!/usr/bin/env node
/** SPO-639 (WF-C): SessionStart / UserPromptSubmit hook. stdout becomes context, so every turn starts with `wf status`. Never throws. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidState, renderStatus } from './lib/wf-core.mjs';

try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = join(process.env.WF_STATE_DIR ?? join(root, '.claude/state'), 'wf.json');
  if (existsSync(file)) {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (isValidState(state) && state.task) console.log(`[wf]\n${renderStatus(state)}`);
  }
} catch {
  /* a broken hook must never trap a session */
}
