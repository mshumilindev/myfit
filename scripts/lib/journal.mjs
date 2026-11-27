/**
 * SPO-639 W23: development-event journal. Pure builders + a tolerant reader + an append that never throws.
 * Stored fields are a whitelist of ids, enums, numbers and short tokens: no tool inputs, prompts, messages,
 * paths or commands (R23). One line per event, one file per session, written with a single O_APPEND write.
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const SCHEMA_V = 1;
/** Events the recorder is registered for (the spike on real stdin may extend this list). */
export const REQUIRED_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionEnd',
  'Notification',
];
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse'];
const MAX_LINE = 1024;
const TOKEN = /^[A-Za-z0-9._:-]{1,64}$/;
const CATS = ['no-verify', 'force-push', 'pkill', 'destructive-git', 'rm-root', 'secrets'];

const token = (v) => (typeof v === 'string' && TOKEN.test(v) ? v : undefined);

/** `mcp__server__tool` is reduced to `mcp__server`; anything odd becomes `other`. */
export function toolName(raw) {
  if (typeof raw !== 'string' || !raw) return undefined;
  if (raw.startsWith('mcp__')) return token(`mcp__${raw.split('__')[1] ?? ''}`) ?? 'mcp';
  return /^[A-Za-z0-9_]{1,40}$/.test(raw) ? raw : 'other';
}

/** Whitelist-only entry. `input` is the hook stdin (any shape, never trusted); `ctx` is {task, open, blocked, now}. */
export function buildEntry(event, input, ctx = {}) {
  const i = input && typeof input === 'object' ? input : {};
  const ts = typeof ctx.now === 'number' ? ctx.now : Date.now();
  const sid = token(i.session_id) ?? token(ctx.sid) ?? 'unknown';
  const key = token(i.tool_use_id);
  const entry = { v: SCHEMA_V, ev: token(event) ?? 'unknown', ts, sid };
  const task = token(ctx.task);
  if (task) entry.task = task;
  entry.agent = i.agent_id || i.agent_type || i.isSidechain === true ? 'sub' : 'main';
  const tool = toolName(i.tool_name);
  if (tool) entry.tool = tool;
  if (key) entry.key = key;
  if (event === 'PostToolUse') {
    const r = i.tool_response;
    entry.ok = !(r && typeof r === 'object' && (r.is_error === true || r.error));
  }
  if (event === 'SessionStart') entry.src = token(i.source);
  if (event === 'SessionEnd') entry.src = token(i.reason);
  if (event === 'PreCompact') entry.src = token(i.trigger);
  if (event === 'Stop' || event === 'SubagentStop') entry.again = i.stop_hook_active === true;
  if (typeof ctx.open === 'number') entry.open = ctx.open;
  if (typeof ctx.blocked === 'number') entry.blocked = ctx.blocked;
  if (ctx.cat && CATS.includes(ctx.cat)) entry.cat = ctx.cat;
  for (const k of Object.keys(entry)) if (entry[k] === undefined) delete entry[k];
  entry.id = createHash('sha1')
    .update(`${sid}|${entry.ev}|${key ?? `${ts}.${ctx.nonce ?? process.pid}`}`)
    .digest('hex')
    .slice(0, 12);
  return entry;
}

/** Ordered candidate directories: the state dir first, then fallbacks (not durable in a cloud container, see spec). */
export function journalDirs({ stateDir, home = homedir(), tmp = tmpdir() }) {
  return [join(stateDir, 'journal'), join(tmp, 'spotter-journal'), join(home, '.spotter-journal')];
}

/** One O_APPEND write per line. Returns {ok, dir, failed:[dir]} and never throws. */
export function appendEntry(entry, dirs) {
  let line = `${JSON.stringify(entry)}\n`;
  if (line.length > MAX_LINE) {
    const cut = { ...entry };
    delete cut.tool;
    line = `${JSON.stringify({ ...cut, trunc: true })}\n`;
  }
  const failed = [];
  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, `${entry.sid}.ndjson`), line);
      return { ok: true, dir, failed };
    } catch {
      failed.push(dir);
    }
  }
  return { ok: false, dir: null, failed };
}

/** Records a capture failure where it can; the next SessionStart reports it. Never throws. */
export function noteError(kind, dirs, now = Date.now()) {
  const line = `${JSON.stringify({ v: SCHEMA_V, ts: now, kind: token(kind) ?? 'unknown' })}\n`;
  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, 'capture-errors.ndjson'), line);
      return true;
    } catch {
      /* try the next one */
    }
  }
  return false;
}

/** Tolerant reader: bad or truncated lines are counted, never fatal; order is (ts, id), not file order. */
export function readJournalText(text) {
  const entries = [];
  let bad = 0;
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o && typeof o === 'object' && typeof o.ev === 'string' && typeof o.ts === 'number') {
        entries.push(o);
      } else bad += 1;
    } catch {
      bad += 1;
    }
  }
  entries.sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
  return { entries, bad };
}

export function readJournalDirs(dirs) {
  const seen = new Set();
  const entries = [];
  let bad = 0;
  for (const dir of dirs) {
    let files;
    try {
      files = readdirSync(dir).filter(
        (f) => f.endsWith('.ndjson') && f !== 'capture-errors.ndjson',
      );
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const r = readJournalText(readFileSync(join(dir, f), 'utf8'));
        bad += r.bad;
        for (const e of r.entries) {
          if (!seen.has(e.id)) {
            seen.add(e.id);
            entries.push(e);
          }
        }
      } catch {
        bad += 1;
      }
    }
  }
  entries.sort((a, b) => a.ts - b.ts || String(a.id).localeCompare(String(b.id)));
  return { entries, bad };
}

/**
 * Which required events lack a recorder command, and whether the tool events use a catch-all matcher.
 * `settings` is a list of parsed settings objects (project + local); hooks from several files add up.
 */
export function checkRegistration(settings) {
  const groups = (ev) =>
    settings.flatMap((s) => (s && s.hooks && Array.isArray(s.hooks[ev]) ? s.hooks[ev] : []));
  const has = (g) =>
    Array.isArray(g.hooks) &&
    g.hooks.some((h) => typeof h.command === 'string' && h.command.includes('journal-hook.mjs'));
  const missing = [];
  const badMatcher = [];
  for (const ev of REQUIRED_EVENTS) {
    const withRec = groups(ev).filter(has);
    if (withRec.length === 0) missing.push(ev);
    else if (
      TOOL_EVENTS.includes(ev) &&
      !withRec.some((g) => g.matcher === '*' || g.matcher === '' || g.matcher === undefined)
    ) {
      badMatcher.push(ev);
    }
  }
  const disabled = settings.some((s) => s && s.disableAllHooks === true);
  return { missing, badMatcher, disabled, ok: !missing.length && !badMatcher.length && !disabled };
}
