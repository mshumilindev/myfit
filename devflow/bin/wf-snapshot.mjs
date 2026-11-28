#!/usr/bin/env node
/**
 * Writes one JSON document describing the live wf state (tasks, blocks, pace, ETA).
 * Feeds the Progress panel: `node devflow/bin/wf-snapshot.mjs > snapshot.json`.
 * Always English; paths come from devflow.config.json.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const CONFIG = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'devflow.config.json'), 'utf8'),
);
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const WINDOW_MS = 45 * 60 * 1000;

function firstRead(names) {
  for (const dir of [CONFIG.stateDir, CONFIG.mirrorDir]) {
    try {
      return readFileSync(join(ROOT, dir, names), 'utf8');
    } catch {
      /* next location */
    }
  }
  return null;
}

function paceOf(journal, now) {
  const stamps = [];
  for (const line of (journal ?? '').split('\n')) {
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'done' && typeof ev.ts === 'number' && now - ev.ts <= WINDOW_MS)
        stamps.push(ev.ts);
    } catch {
      /* damaged line */
    }
  }
  if (stamps.length < 2) return 0;
  return stamps.length / Math.max((now - Math.min(...stamps)) / 60000, 1);
}

function etaOf(open, pace) {
  if (open === 0) return null;
  if (pace <= 0) return 'Est. n/a (not enough finished items yet)';
  const m = Math.max(1, Math.round(open / pace));
  return `≈ ${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`} left`;
}

function summarize(task, items, active, pace) {
  const n = (s) => items.filter((i) => i.status === s).length;
  const done = n('done');
  const open = n('todo') + n('doing') + n('blocked');
  const cur = items.find((i) => i.status === 'doing');
  return {
    task,
    active,
    pct: Math.round((done / Math.max(1, items.length)) * 100),
    done,
    total: items.length,
    doing: n('doing'),
    blocked: n('blocked'),
    skipped: n('skipped'),
    todo: n('todo'),
    now: cur ? `${cur.id} ${cur.text ?? ''}`.trim() : null,
    eta: etaOf(open, pace),
    blocks: items.map((i) => ({
      id: i.id,
      text: i.text ?? '',
      status: i.status,
      why:
        i.status === 'blocked'
          ? `Waiting on: ${i.needs ?? '?'}${i.reason ? ` · ${i.reason}` : ''}`
          : (i.reason ?? ''),
    })),
  };
}

const raw = firstRead('wf.json');
const wf = raw ? JSON.parse(raw) : {};
const pace = paceOf(firstRead('wf-events.jsonl'), Date.now());
const tasks = [];
if (wf.task) tasks.push(summarize(wf.task.id, wf.items ?? [], true, pace));
for (const p of wf.parked ?? []) {
  const t = summarize(p.task.id, p.items ?? [], false, pace);
  if (t.pct < 100) tasks.push(t);
}
process.stdout.write(`${JSON.stringify({ tasks, updatedAt: Date.now() })}\n`);
