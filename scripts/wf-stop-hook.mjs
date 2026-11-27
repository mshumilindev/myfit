#!/usr/bin/env node
/** SPO-639 (WF-C): Stop hook entry. exit 2 + stderr = keep working; exit 0 = may stop. Never throws. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideStop } from './lib/wf-stop.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state');
  const file = join(dir, 'wf.json');
  if (!existsSync(file)) process.exit(0);
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    input = {};
  }
  const state = JSON.parse(readFileSync(file, 'utf8'));
  const verdict = decideStop({ input, state, mtimeMs: statSync(file).mtimeMs });
  if (verdict.block) {
    console.error(verdict.reason);
    process.exit(2);
  }
} catch {
  /* a broken hook must never trap a session */
}
process.exit(0);
