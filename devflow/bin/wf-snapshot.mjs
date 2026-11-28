#!/usr/bin/env node
/**
 * Builds one JSON document describing the live wf state: tasks, blocks, ETA range, last events.
 * `node devflow/bin/wf-snapshot.mjs > snapshot.json` feeds the Progress panel and the wf-state publisher.
 * Always English; paths come from devflow.config.json.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(HERE, '..', 'devflow.config.json'), 'utf8'));
const WINDOW_MS = 60 * 60 * 1000;
const MIN_SAMPLES = 3;
// A gap longer than this is idle time (waiting for the owner, a deploy), not working pace.
const MAX_GAP_MIN = 15;

function readFirst(root, name) {
  for (const dir of [CONFIG.stateDir, CONFIG.mirrorDir]) {
    try {
      return readFileSync(join(root, dir, name), 'utf8');
    } catch {
      /* next location */
    }
  }
  return null;
}

const parseJournal = (text) =>
  (text ?? '')
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((e) => e && typeof e.ts === 'number');

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/** Minutes per finished item from the gaps between consecutive `done` events in the last hour. */
export function paceOf(events, now) {
  const stamps = events
    .filter((e) => e.type === 'done' && now - e.ts <= WINDOW_MS)
    .map((e) => e.ts)
    .sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < stamps.length; i += 1) {
    const gap = (stamps[i] - stamps[i - 1]) / 60000;
    if (gap <= MAX_GAP_MIN) gaps.push(gap);
  }
  if (gaps.length < MIN_SAMPLES) return null;
  const sorted = gaps.sort((a, b) => a - b);
  return {
    samples: gaps.length,
    median: quantile(sorted, 0.5),
    low: quantile(sorted, 0.25),
    high: quantile(sorted, 0.75),
    lastDoneAt: stamps[stamps.length - 1],
  };
}

const fmt = (m) =>
  m >= 60
    ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`
    : `${Math.max(1, Math.round(m))} min`;

/** Remaining time for the items the agent can still finish (todo + doing); blocked ones are named, not counted. */
export function etaOf(items, pace, now) {
  const workable = items.filter((i) => i.status === 'todo' || i.status === 'doing').length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  if (workable === 0 && blocked === 0) return null;
  if (workable === 0) return `Waiting on ${blocked} blocked`;
  if (!pace) return 'Est. n/a (needs 3+ finished items in the last hour)';
  const sinceLast = Math.max(0, (now - pace.lastDoneAt) / 60000);
  const lo = Math.max(1, workable * pace.low - sinceLast);
  const hi = Math.max(lo, workable * pace.high - sinceLast);
  const range = Math.round(lo) === Math.round(hi) ? `≈ ${fmt(lo)}` : `≈ ${fmt(lo)}–${fmt(hi)}`;
  return `${range} left${blocked ? ` · ${blocked} blocked` : ''}`;
}

function summarize(task, items, active, pace, now, events) {
  const n = (s) => items.filter((i) => i.status === s).length;
  const done = n('done');
  const cur = items.find((i) => i.status === 'doing');
  const since = cur
    ? ([...events].reverse().find((e) => e.type === 'doing' && e.item === cur.id)?.ts ?? null)
    : null;
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
    nowSince: since,
    eta: etaOf(items, pace, now),
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

export function buildSnapshot({
  root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
  now = Date.now(),
  label = basename(root),
} = {}) {
  const raw = readFirst(root, 'wf.json');
  const wf = raw ? JSON.parse(raw) : {};
  const events = parseJournal(readFirst(root, 'wf-events.jsonl'));
  const pace = paceOf(events, now);
  const tasks = [];
  if (wf.task) tasks.push(summarize(wf.task.id, wf.items ?? [], true, pace, now, events));
  for (const p of wf.parked ?? []) {
    const t = summarize(p.task.id, p.items ?? [], false, pace, now, events);
    if (t.pct < 100) tasks.push(t);
  }
  return { source: label, updatedAt: now, tasks };
}

if (process.argv[1] && basename(process.argv[1]) === 'wf-snapshot.mjs') {
  process.stdout.write(`${JSON.stringify(buildSnapshot())}\n`);
}
