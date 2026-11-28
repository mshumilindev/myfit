#!/usr/bin/env node
/** SPO-639 (W17 B7): node scripts/dash-close.mjs SPO-N — mark a task Deployed to prod so its Dev Console tab closes. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const id = process.argv[2] ?? '';
if (!/^SPO-\d{1,5}$/.test(id)) {
  console.error('usage: node scripts/dash-close.mjs SPO-<number>');
  process.exit(2);
}
const dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state');
const file = join(dir, 'deployed-prod.json');
let tasks = [];
try {
  if (existsSync(file)) tasks = JSON.parse(readFileSync(file, 'utf8')).tasks ?? [];
} catch {
  tasks = [];
}
if (!tasks.includes(id)) tasks.push(id);
mkdirSync(dir, { recursive: true });
writeFileSync(file, `${JSON.stringify({ tasks: tasks.sort() })}\n`);
console.log(`[dash-close] ${id}: tab will close once no ready-for-cpd branch is left`);
