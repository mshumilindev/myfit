#!/usr/bin/env node
/**
 * SPO-639 (WF-A): `wf` — mechanical task progress, like `git status`.
 *
 *   node scripts/wf.mjs start <TASK> [title]
 *   node scripts/wf.mjs add <item> [--kind ac|step|extra] [--text "…"] [--verify]
 *   node scripts/wf.mjs doing <item>
 *   node scripts/wf.mjs done <item> --evidence "<command|file|link>" [--verdict verify.json]
 *   node scripts/wf.mjs also <task> [title]   start another task; the current one is parked, the band shows both
 *   node scripts/wf.mjs switch <task>        make a parked task the active one
 *   node scripts/wf.mjs ready <TASK>         rename the work branch to ready-for-cpd/<TASK> (the cpd queue)
 *   node scripts/wf.mjs skip <item> --reason "why it was skipped"   (shown on hover in the band)
 *   node scripts/wf.mjs block <item> --needs design|cpd|access|legal|irreversible [--reason "…"]
 *   node scripts/wf.mjs unblock <item>
 *   node scripts/wf.mjs heartbeat
 *   node scripts/wf.mjs status
 *   node scripts/wf.mjs report [--at 02:15]   markdown for the Linear progress comment
 *
 * State: .claude/state/wf.json (gitignored); journal: .claude/state/wf-events.jsonl (ids/categories/time only).
 * WF_STATE_DIR overrides the directory (tests). Exit codes: 0 ok, 2 rejected input, 1 unexpected error.
 */
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyState,
  ID_RE,
  isValidState,
  reduce,
  renderReport,
  renderStatus,
  toJournalEntry,
} from '../core/wf-core.mjs';

const BOOLEAN_FLAGS = new Set(['force', 'verify', 'no-branch']);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Cross-process lock (O_EXCL lockfile) so parallel `wf` calls never lose updates; stale locks expire. */
function withLock(dir, fn) {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, 'wf.lock');
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10000) {
          // rename first: only one process can take a stale lock away, a fresh lock is never removed by mistake
          const stale = `${lock}.stale.${process.pid}`;
          renameSync(lock, stale);
          unlinkSync(stale);
        }
      } catch {
        /* released meanwhile */
      }
      if (Date.now() > deadline) throw new Error('wf.lock зайнятий — повторіть', { cause: e });
      sleep(10);
    }
  }
  try {
    return fn();
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      /* already gone */
    }
  }
}

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--') && BOOLEAN_FLAGS.has(a.slice(2))) {
      flags[a.slice(2)] = true;
    } else if (a.startsWith('--') && a.includes('=')) {
      flags[a.slice(2, a.indexOf('='))] = a.slice(a.indexOf('=') + 1);
    } else if (a.startsWith('--')) {
      flags[a.slice(2)] =
        argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
    } else positional.push(a);
  }
  return { positional, flags };
}

/** Reads `verify.json` ({ verdict: 'PASS'|'FAIL'|'CANNOT_VERIFY', verifiers: [...] }); only the verdict is kept. */
export function readVerdict(file) {
  if (typeof file !== 'string') return undefined;
  try {
    const v = JSON.parse(readFileSync(file, 'utf8'));
    const ok = Array.isArray(v.verifiers) && v.verifiers.length > 0;
    return ok && ['PASS', 'FAIL', 'CANNOT_VERIFY'].includes(v.verdict) ? v.verdict : undefined;
  } catch {
    return undefined;
  }
}

export function buildEvent(cmd, { positional, flags }, now = Date.now()) {
  const [first, ...rest] = positional;
  switch (cmd) {
    case 'start':
    case 'also':
    case 'switch':
      return { type: cmd, ts: now, task: first, title: rest.join(' ') };
    case 'add':
      return {
        type: 'add',
        ts: now,
        item: first,
        kind: flags.kind ?? 'step',
        text: typeof flags.text === 'string' ? flags.text : '',
        verify: flags.verify === true,
      };
    case 'doing':
    case 'unblock':
      return { type: cmd, ts: now, item: first };
    case 'done':
      return {
        type: 'done',
        ts: now,
        item: first,
        evidence: flags.evidence === true ? '' : flags.evidence,
        verdict: readVerdict(flags.verdict),
      };
    case 'block':
      return {
        type: 'block',
        ts: now,
        item: first,
        needs: flags.needs,
        reason: typeof flags.reason === 'string' ? flags.reason : '',
      };
    case 'skip':
      return {
        type: 'skip',
        ts: now,
        item: first,
        reason: typeof flags.reason === 'string' ? flags.reason : '',
      };
    case 'heartbeat':
      return { type: 'heartbeat', ts: now };
    default:
      return null;
  }
}

function load(stateFile) {
  if (!existsSync(stateFile)) return emptyState();
  let state;
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    state = null;
  }
  return isValidState(state) ? state : null;
}

function apply(dir, event, args) {
  const stateFile = join(dir, 'wf.json');
  const state = load(stateFile);
  if (!state)
    return { code: 2, out: `wf: стан пошкоджено (${stateFile}) — виправте або видаліть файл` };
  if (!['start', 'also'].includes(event.type) && !state.task) {
    return { code: 2, out: 'wf: немає активної задачі (wf start <id>)' };
  }
  if (event.type === 'start' && !args.flags.force && state.task) {
    const open = state.items.filter((i) => i.status !== 'done' && i.status !== 'skipped').length;
    if (open > 0) {
      throw new Error(
        `задача ${state.task.id} має ${open} незакритих пунктів; start --force замінить її`,
      );
    }
  }
  const next = reduce(state, event);
  const tmp = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, stateFile);
  appendFileSync(join(dir, 'wf-events.jsonl'), `${JSON.stringify(toJournalEntry(event))}\n`);
  return { code: 0, out: renderStatus(next) };
}

export function run(
  argv,
  { dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state'), now = Date.now() } = {},
) {
  const [cmd, ...restArgs] = argv;
  if (cmd === 'report') {
    const state = load(join(dir, 'wf.json'));
    return state && state.task
      ? {
          code: 0,
          out: renderReport(
            state,
            typeof parseArgs(restArgs).flags.at === 'string' ? parseArgs(restArgs).flags.at : '',
          ),
        }
      : { code: 2, out: 'wf: немає активної задачі (wf start <id>)' };
  }
  if (cmd === 'status' || cmd === undefined) {
    const state = load(join(dir, 'wf.json'));
    return state
      ? { code: 0, out: renderStatus(state) }
      : {
          code: 2,
          out: `wf: стан пошкоджено (${join(dir, 'wf.json')}) — виправте або видаліть файл`,
        };
  }
  const args = parseArgs(restArgs);
  const event = buildEvent(cmd, args, now);
  if (!event) return { code: 2, out: `wf: невідома команда: ${cmd}` };
  try {
    return withLock(dir, () => apply(dir, event, args));
  } catch (e) {
    return { code: 2, out: `wf: ${e.message}` };
  }
}

/** After a state change, hand the snapshot to the publisher in the background (never blocks, never fails `wf`). */
function publishInBackground(cmd) {
  if (process.env.WF_PUBLISH === '0' || process.env.WF_STATE_DIR) return;
  if (cmd === 'report') return; // status publishes too: the chat that ran it becomes the newest source and the widget follows it
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    spawn(process.execPath, [join(here, 'wf-publish.mjs')], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } catch {
    /* publishing is best effort */
  }
}

function git(args, cwd = ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}`.trim() };
}

/**
 * Branch convention, enforced here instead of in prose rules:
 *  - `start`/`also <TASK> [title]` puts the work on `work/<TASK>-<slug>` unless HEAD is already a work branch of that task
 *    (`--no-branch` skips it). Every task then shows up as its own "in development" branch in the widget.
 *  - `ready <TASK>` renames the task's work branch to `ready-for-cpd/<TASK>` (the queue the owner's "cpd" ships).
 * Best effort and never destructive: a failed git call only adds a note.
 */
export function branchStep(argv, cwd = ROOT) {
  const [cmd, task, ...rest] = argv;
  if (!['start', 'also', 'ready'].includes(cmd) || !ID_RE.test(task ?? '')) return '';
  if (!git(['rev-parse', '--git-dir'], cwd).ok) return '';
  const cur = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).out;
  if (cmd === 'ready') {
    if (cur.startsWith('ready-for-cpd/')) return `branch: already ${cur}`;
    if (!cur.startsWith(`work/${task}`))
      return `branch: HEAD is ${cur}, not work/${task}-…; nothing renamed`;
    const to = `ready-for-cpd/${task}`;
    return git(['branch', '-m', cur, to], cwd).ok
      ? `branch: ${cur} -> ${to}`
      : `branch: could not rename to ${to}`;
  }
  if (rest.includes('--no-branch') || cur.startsWith(`work/${task}`)) return '';
  const title = rest.filter((w) => !w.startsWith('--')).join(' ');
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'dev';
  const name = `work/${task}-${slug}`;
  const made = git(['checkout', '-b', name], cwd);
  return made.ok
    ? `branch: ${name}`
    : `branch: could not create ${name} (${made.out.slice(0, 80)})`;
}

if (process.argv[1] && basename(process.argv[1]) === 'wf.mjs') {
  const argv = process.argv.slice(2);
  const note = argv[0] === 'ready' ? branchStep(argv) : '';
  if (argv[0] === 'ready') {
    console.log(note);
    publishInBackground('ready');
    process.exit(note.includes('could not') ? 2 : 0);
  }
  const { code, out } = run(argv);
  const bnote = code === 0 ? branchStep(argv) : '';
  if (bnote) console.log(bnote);
  if (code === 0) publishInBackground(process.argv[2]);
  (code === 0 ? console.log : console.error)(out);
  process.exit(code);
}
