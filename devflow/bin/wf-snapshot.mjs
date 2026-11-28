#!/usr/bin/env node
/**
 * Builds one JSON document describing the live wf state: tasks, blocks, ETA range, last events.
 * `node devflow/bin/wf-snapshot.mjs > snapshot.json` feeds the Progress panel and the wf-state publisher.
 * Always English; paths come from devflow.config.json.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
      evidence: i.evidence ?? '',
    })),
  };
}

const git = (root, args) => {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

/** Local branches that matter: ready-for-cpd/* (waiting for cpd), current/other work branches, and unpushed commits on main. */
export function branchesOf(root) {
  const out = [];
  const cur = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const lines = git(root, [
    'for-each-ref',
    '--format=%(refname:short)\t%(contents:subject)',
    'refs/heads',
  ]).split('\n');
  for (const line of lines) {
    const [name, subject = ''] = line.split('\t');
    if (!name) continue;
    const ahead = Number(git(root, ['rev-list', '--count', `origin/main..${name}`])) || 0;
    if (name === 'main') {
      if (ahead > 0)
        out.push({
          name: 'main',
          kind: 'cpd',
          ahead,
          subject: 'unpushed commits, waiting for cpd',
        });
      continue;
    }
    if (name.startsWith('ready-for-cpd/')) out.push({ name, kind: 'cpd', ahead, subject });
    else if (ahead > 0 || name === cur) out.push({ name, kind: 'dev', ahead, subject });
  }
  return out;
}

/** Branches pushed to GitHub (any chat), merged with the local ones. Best effort via gh. */
export function withRemoteBranches(root, local) {
  const out = [...local];
  try {
    const remote = git(root, ['config', '--get', 'remote.origin.url']);
    const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(remote);
    if (!m) return out;
    const api = (path) =>
      JSON.parse(
        execFileSync('gh', ['api', path], {
          cwd: root,
          encoding: 'utf8',
          timeout: 15000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      );
    for (const b of api(`repos/${m[1]}/branches?per_page=100`)) {
      if (
        b.name === 'main' ||
        b.name === 'wf-state' ||
        b.name.startsWith('dependabot/') ||
        out.some((x) => x.name === b.name)
      )
        continue;
      const c = api(`repos/${m[1]}/compare/main...${encodeURIComponent(b.name)}`);
      if (!c.ahead_by) continue;
      out.push({
        name: b.name,
        kind: b.name.startsWith('ready-for-cpd/') ? 'cpd' : 'dev',
        ahead: c.ahead_by,
        subject: `${c.commits?.at(-1)?.commit?.message?.split('\n')[0] ?? ''} (on GitHub)`,
      });
    }
  } catch {
    /* gh unavailable: local branches only */
  }
  return out;
}

/** Pipeline stages from GitHub Actions (best effort; empty when gh is unavailable). */
export function pipelineOf(root) {
  const stages = [];
  const gh = (args) => {
    try {
      return JSON.parse(
        execFileSync('gh', ['api', ...args], {
          cwd: root,
          encoding: 'utf8',
          timeout: 15000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      );
    } catch {
      return null;
    }
  };
  const remote = git(root, ['config', '--get', 'remote.origin.url']);
  const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(remote);
  if (!m) return stages;
  const repo = m[1];
  const state = (r) =>
    !r ? 'none' : r.status !== 'completed' ? 'running' : r.conclusion === 'success' ? 'ok' : 'fail';
  const detail = (r) =>
    r
      ? `${r.head_sha.slice(0, 7)} \u00b7 ${r.updated_at.slice(0, 16).replace('T', ' ')}`
      : 'no runs';
  const ci = gh([`repos/${repo}/actions/workflows/ci.yml/runs?per_page=1&branch=main`])
    ?.workflow_runs?.[0];
  stages.push({ stage: 'CI (main)', state: state(ci), detail: detail(ci) });
  const runs =
    gh([`repos/${repo}/actions/workflows/deploy-hosting.yml/runs?per_page=6`])?.workflow_runs ?? [];
  for (const target of ['test', 'prod']) {
    let found = null;
    for (const r of runs) {
      const jobs = gh([`repos/${repo}/actions/runs/${r.id}/jobs`])?.jobs ?? [];
      if (jobs.some((j) => j.name.toLowerCase().includes(target))) {
        found = r;
        break;
      }
    }
    stages.push({ stage: `Deploy ${target}`, state: state(found), detail: detail(found) });
  }
  return stages;
}

/** Copy-ready prompts that hand the agent exactly what is left. */
export function promptsOf(tasks, branches = []) {
  const out = [];
  const t = tasks.find((x) => x.active) ?? tasks[0];
  if (t) {
    const open = t.blocks.filter((b) => b.status === 'todo' || b.status === 'doing');
    if (open.length)
      out.push({
        label: `Finish ${open.length} open in ${t.task}`,
        text: `Continue ${t.task}: finish all remaining wf items (${open.map((b) => b.id).join(', ')}). Close each only with wf done --evidence. Do not stop or ask until they are done.`,
      });
    for (const b of t.blocks.filter((x) => x.status === 'blocked'))
      out.push({
        label: `Unblock ${b.id}`,
        text: `${t.task}: ${b.id} (${b.text}) is blocked. ${b.why}. Find a way around it yourself; if it truly needs me, tell me the one thing to do.`,
      });
  }
  if (branches.some((b) => b.kind === 'cpd')) out.push({ label: 'cpd', text: 'cpd' });
  return out;
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
  const branches = withRemoteBranches(root, branchesOf(root));
  let dashboardUrl = '';
  try {
    dashboardUrl =
      JSON.parse(readFileSync(join(root, 'devflow', 'devflow.config.json'), 'utf8')).dashboardUrl ??
      '';
  } catch {
    /* config is optional */
  }
  return {
    source: label,
    updatedAt: now,
    tasks,
    branches,
    prompts: promptsOf(tasks, branches),
    pipeline: pipelineOf(root),
    dashboardUrl,
  };
}

if (process.argv[1] && basename(process.argv[1]) === 'wf-snapshot.mjs') {
  process.stdout.write(`${JSON.stringify(buildSnapshot())}\n`);
}
