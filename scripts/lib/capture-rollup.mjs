/**
 * SPO-639 W24: reconcile the journal with the session transcript and roll it up into a deterministic shard.
 * The transcript is read only for type, timestamp and tool ids (spec §5 #1); nothing from it is stored as text.
 * Same input gives the same bytes, so repeated runs never change a shard (idempotent, no git churn).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntry } from './journal.mjs';

export const PARSER_V = 1;
export const SHARD_V = 1;
const SETTLE_MS = 3000;
const MAX_TRANSCRIPT = 80 * 1024 * 1024;
const TOKEN = /^[A-Za-z0-9._:-]{1,64}$/;

const ts = (v) => {
  const n = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Tolerant: unknown shapes are skipped; a file with lines but no recognisable rows is `unreadable`. */
export function parseTranscript(text) {
  const tools = [];
  let prompts = 0;
  let bad = 0;
  let rows = 0;
  let recognised = 0;
  const lines = String(text).split('\n');
  // the last line may still be being written: ignore it (spec §5 #1)
  const usable = lines.length > 1 ? lines.slice(0, -1) : lines;
  for (const line of usable) {
    if (!line.trim()) continue;
    rows += 1;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      bad += 1;
      continue;
    }
    if (!o || typeof o !== 'object') continue;
    const content = o.message && Array.isArray(o.message.content) ? o.message.content : null;
    if (o.type === 'assistant' && content) {
      recognised += 1;
      for (const b of content) {
        if (b && b.type === 'tool_use' && typeof b.id === 'string' && TOKEN.test(b.id)) {
          tools.push({
            id: b.id,
            name: typeof b.name === 'string' ? b.name : undefined,
            ts: ts(o.timestamp),
            side: o.isSidechain === true,
          });
        }
      }
    } else if (o.type === 'user' && o.isMeta !== true && !o.toolUseResult) {
      recognised += 1;
      const c = o.message && o.message.content;
      const human =
        typeof c === 'string' || (Array.isArray(c) && c.some((b) => b && b.type === 'text'));
      if (human) prompts += 1;
    }
  }
  const seen = new Set();
  const uniq = tools.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
  return { v: PARSER_V, tools: uniq, prompts, bad, unreadable: rows > 0 && recognised === 0 };
}

/**
 * Compare journal tool events with transcript tool calls for one session.
 * `settled` is false while the transcript was modified within the settle window: no verdict then.
 */
export function reconcile(entries, transcript, { settled = true, now = Date.now() } = {}) {
  if (!transcript) return { state: 'no_transcript', missing: 0, backfill: [] };
  if (transcript.unreadable) return { state: 'transcript_unreadable', missing: 0, backfill: [] };
  if (!settled) return { state: 'unsettled', missing: 0, backfill: [] };
  const keys = new Set(entries.filter((e) => e.ev === 'PreToolUse' && e.key).map((e) => e.key));
  const missing = transcript.tools.filter((t) => !keys.has(t.id));
  const hasKeys = keys.size > 0;
  const pre = entries.filter((e) => e.ev === 'PreToolUse').length;
  const backfill = missing.map((t) => ({
    ...buildEntry(
      'PreToolUse',
      {
        session_id: entries[0]?.sid,
        tool_use_id: t.id,
        tool_name: t.name,
        agent_id: t.side ? 'sub' : undefined,
      },
      { now: t.ts ?? now },
    ),
    src: 'backfill',
  }));
  // without tool_use_id in the journal only the count can be compared
  const count = hasKeys ? missing.length : Math.max(0, transcript.tools.length - pre);
  return { state: count > 0 ? 'gap' : 'ok', missing: count, backfill: hasKeys ? backfill : [] };
}

const sortedObj = (o) =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]),
  );
const hourOf = (t) => new Date(t).toISOString().slice(0, 13);

/** Deterministic shard. `entries` may already include backfilled rows; duplicates by id are dropped here. */
export function buildShard(entries, recon = { state: 'no_transcript', missing: 0 }, extra = {}) {
  const seen = new Set();
  const all = entries
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
  const sid = all[0]?.sid ?? extra.sid ?? 'unknown';
  const tasks = all.filter((e) => e.task).map((e) => e.task);
  const task = tasks.length ? tasks[tasks.length - 1] : 'untasked';
  const tools = {};
  const events = {};
  const byHour = {};
  const guard = {};
  const stops = [];
  const compactions = [];
  let nudges = 0;
  let prompts = 0;
  let lastStop = null;
  const sessionStops = all.filter((e) => e.ev === 'Stop' && !e.again);
  for (const e of all) {
    events[e.ev] = (events[e.ev] ?? 0) + 1;
    if (e.ev === 'PreToolUse' && e.tool) tools[e.tool] = (tools[e.tool] ?? 0) + 1;
    if (e.ev === 'PreToolUse' || e.ev === 'UserPromptSubmit') {
      const h = hourOf(e.ts);
      byHour[h] = (byHour[h] ?? 0) + 1;
    }
    if (e.ev === 'GuardBlock' && e.cat) guard[e.cat] = (guard[e.cat] ?? 0) + 1;
    if (e.ev === 'PreCompact') compactions.push({ ts: e.ts, src: e.src ?? 'auto' });
    if (e.ev === 'UserPromptSubmit') {
      prompts += 1;
      if (lastStop && lastStop.kind === 'unforced') {
        nudges += 1;
        lastStop.idleMs = e.ts - lastStop.ts;
      } else if (lastStop) lastStop.idleMs = e.ts - lastStop.ts;
      lastStop = null;
    }
    if (e.ev === 'Stop' && !e.again) {
      const open = e.open ?? 0;
      const kind = open > 0 ? 'unforced' : (e.blocked ?? 0) > 0 ? 'legit' : 'done';
      lastStop = { ts: e.ts, kind, open, blocked: e.blocked ?? 0 };
      stops.push(lastStop);
    }
  }
  const stopsOut = stops.map((s) => ({
    ts: s.ts,
    kind: s.kind,
    open: s.open,
    blocked: s.blocked,
    ...(s.idleMs !== undefined ? { idleMs: s.idleMs } : {}),
  }));
  return {
    v: SHARD_V,
    sid,
    task,
    parser: PARSER_V,
    firstTs: all[0]?.ts ?? null,
    lastTs: all[all.length - 1]?.ts ?? null,
    counts: {
      events: sortedObj(events),
      tools: sortedObj(tools),
      byHour: sortedObj(byHour),
      guard: sortedObj(guard),
    },
    turns: {
      prompts,
      stops: sessionStops.length,
      unforced: stops.filter((s) => s.kind === 'unforced').length,
      nudges,
    },
    stops: stopsOut,
    compactions,
    health: {
      capture: recon.state,
      missing: recon.missing ?? 0,
      journalBad: extra.bad ?? 0,
      errors: extra.errors ?? 0,
    },
  };
}

const ALLOWED_TOP = [
  'v',
  'sid',
  'task',
  'parser',
  'firstTs',
  'lastTs',
  'counts',
  'turns',
  'stops',
  'compactions',
  'health',
];
/** PII guard: only whitelisted keys, and every string value is a short token. */
export function validateShard(shard) {
  const bad = [];
  for (const k of Object.keys(shard)) if (!ALLOWED_TOP.includes(k)) bad.push(`key:${k}`);
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (!TOKEN.test(v)) bad.push(`string:${path}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (!TOKEN.test(k) && !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(k)) bad.push(`name:${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    }
  };
  walk(shard, '$');
  return bad;
}

/** Writes docs/reviews/dash/<task>/<sid>.json atomically and only when the bytes change. */
export function writeShard(root, shard) {
  const problems = validateShard(shard);
  if (problems.length) return { ok: false, written: false, problems };
  const dir = join(root, 'docs/reviews/dash', shard.task);
  const file = join(dir, `${shard.sid}.json`);
  const text = `${JSON.stringify(shard, null, 2)}\n`;
  if (existsSync(file) && readFileSync(file, 'utf8') === text)
    return { ok: true, written: false, file };
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
  return { ok: true, written: true, file };
}

/** Reads a transcript file if it is present and sane; reports whether it has settled. */
export function loadTranscript(path, now = Date.now()) {
  try {
    if (typeof path !== 'string' || !path) return { transcript: null, settled: true };
    const st = statSync(path);
    if (st.size > MAX_TRANSCRIPT)
      return { transcript: { unreadable: true, tools: [], prompts: 0 }, settled: true };
    return {
      transcript: parseTranscript(readFileSync(path, 'utf8')),
      settled: now - st.mtimeMs >= SETTLE_MS,
    };
  } catch {
    return { transcript: null, settled: true };
  }
}
