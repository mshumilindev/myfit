#!/usr/bin/env node
/**
 * SPO-639 (WF-A): `wf` — mechanical task progress, like `git status`.
 *
 *   node scripts/wf.mjs start <TASK> [title]
 *   node scripts/wf.mjs add <item> [--kind ac|step|extra] [--text "…"]
 *   node scripts/wf.mjs doing <item>
 *   node scripts/wf.mjs done <item> --evidence "<command|file|link>"
 *   node scripts/wf.mjs block <item> --needs design|cpd|decision|access [--reason "…"]
 *   node scripts/wf.mjs unblock <item>
 *   node scripts/wf.mjs heartbeat
 *   node scripts/wf.mjs status
 *
 * State: .claude/state/wf.json (gitignored); journal: .claude/state/wf-events.jsonl (ids/categories/time only).
 * WF_STATE_DIR overrides the directory (tests). Exit codes: 0 ok, 2 rejected input, 1 unexpected error.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyState, reduce, renderStatus, toJournalEntry } from './lib/wf-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] =
        argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
    } else positional.push(a);
  }
  return { positional, flags };
}

export function buildEvent(cmd, { positional, flags }, now = Date.now()) {
  const [first, ...rest] = positional;
  switch (cmd) {
    case 'start':
      return { type: 'start', ts: now, task: first, title: rest.join(' ') };
    case 'add':
      return {
        type: 'add',
        ts: now,
        item: first,
        kind: flags.kind ?? 'step',
        text: flags.text ?? '',
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
      };
    case 'block':
      return {
        type: 'block',
        ts: now,
        item: first,
        needs: flags.needs,
        reason: flags.reason ?? '',
      };
    case 'heartbeat':
      return { type: 'heartbeat', ts: now };
    default:
      return null;
  }
}

export function run(
  argv,
  { dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state'), now = Date.now() } = {},
) {
  const [cmd, ...restArgs] = argv;
  const stateFile = join(dir, 'wf.json');
  const journal = join(dir, 'wf-events.jsonl');
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : emptyState();
  if (cmd === 'status' || cmd === undefined) return { code: 0, out: renderStatus(state) };
  const event = buildEvent(cmd, parseArgs(restArgs), now);
  if (!event) return { code: 2, out: `wf: невідома команда: ${cmd}` };
  try {
    if (event.type === 'start' && !event.task) throw new Error('start needs a task id');
    const next = reduce(state, event);
    mkdirSync(dir, { recursive: true });
    writeFileSync(stateFile, `${JSON.stringify(next, null, 2)}\n`);
    appendFileSync(journal, `${JSON.stringify(toJournalEntry(event))}\n`);
    return { code: 0, out: renderStatus(next) };
  } catch (e) {
    return { code: 2, out: `wf: ${e.message}` };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, out } = run(process.argv.slice(2));
  (code === 0 ? console.log : console.error)(out);
  process.exit(code);
}
