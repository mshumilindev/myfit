#!/usr/bin/env node
/**
 * Claude Code `statusLine` command: one live progress line for every session of a project that has wf state.
 * One square per item, one segment per task; always English; empty state says "No task yet".
 * Settings: { "statusLine": { "type": "command", "command": "node devflow/bin/wf-statusline.mjs" } }
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// Paths come from devflow.config.json (stateDir, mirrorDir): this file knows nothing about the host project.
const CONFIG = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'devflow.config.json'), 'utf8'),
);
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const SQ = { done: '🟩', doing: '🟦', blocked: '🟥', skipped: '🟨', todo: '⬜' };
const MAX_SQUARES = 30;
const WINDOW_MS = 45 * 60 * 1000;

function firstJson(files) {
  for (const f of files) {
    try {
      return readFileSync(join(ROOT, f), 'utf8');
    } catch {
      /* next location */
    }
  }
  return null;
}

/** Items per minute from real `done` events in the last 45 minutes; 0 when fewer than two. */
function pace(journal, now) {
  const at = [];
  for (const line of (journal ?? '').split('\n')) {
    try {
      const e = JSON.parse(line);
      if (e.type === 'done' && now - e.ts <= WINDOW_MS) at.push(e.ts);
    } catch {
      /* skip damaged line */
    }
  }
  if (at.length < 2) return 0;
  return at.length / Math.max((now - Math.min(...at)) / 60000, 1);
}

function eta(items, rate) {
  const open = items.filter((i) => ['todo', 'doing', 'blocked'].includes(i.status)).length;
  if (!open) return '';
  if (rate <= 0) return ' · est. n/a';
  const m = Math.max(1, Math.round(open / rate));
  return ` · ≈ ${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`} left`;
}

/** More items than squares: each square stands for a bucket and shows its most urgent state. */
function pack(items) {
  if (items.length <= MAX_SQUARES) return items.map((i) => i.status);
  const size = Math.ceil(items.length / MAX_SQUARES);
  const rank = ['blocked', 'doing', 'todo', 'skipped', 'done'];
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const b = items.slice(i, i + size).map((x) => x.status);
    out.push(rank.find((r) => b.includes(r)) ?? 'todo');
  }
  return out;
}

function line(id, items, active, rate) {
  const done = items.filter((i) => i.status === 'done').length;
  const pct = Math.round((done / Math.max(1, items.length)) * 100);
  if (!active) return `${id} ${pct}%`;
  const squares = pack(items)
    .map((st) => SQ[st] ?? '⬜')
    .join('');
  return `${id} ${squares} ${pct}% ${done}/${items.length}${eta(items, rate)}`;
}

const raw = firstJson([`${CONFIG.stateDir}/wf.json`, `${CONFIG.mirrorDir}/wf.json`]);
let out = 'No task yet';
try {
  const wf = JSON.parse(raw);
  const rate = pace(
    firstJson([`${CONFIG.stateDir}/wf-events.jsonl`, `${CONFIG.mirrorDir}/wf-events.jsonl`]),
    Date.now(),
  );
  const parts = [];
  if (wf.task) parts.push(line(wf.task.id, wf.items ?? [], true, rate));
  for (const p of wf.parked ?? []) {
    const items = p.items ?? [];
    if (items.some((i) => i.status !== 'done' && i.status !== 'skipped'))
      parts.push(line(p.task.id, items, false, rate));
  }
  if (parts.length) out = parts.join(' │ ');
} catch {
  /* no state yet */
}
process.stdout.write(`${out}\n`);
