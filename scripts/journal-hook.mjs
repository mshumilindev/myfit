#!/usr/bin/env node
/**
 * SPO-639 W23: the single recorder for every Claude Code hook event. Usage: node scripts/journal-hook.mjs <Event>.
 * Fail-open: always exit 0. stdout stays empty except for a loud warning on SessionStart/UserPromptSubmit when the
 * capture itself is unhealthy (that stdout becomes context). Reads stdin once.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEntry,
  buildEntry,
  checkRegistration,
  journalDirs,
  noteError,
} from './lib/journal.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT = process.argv[2] ?? '';
let warn = '';
try {
  const stateDir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state');
  const dirs = journalDirs({ stateDir });
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    input = {};
  }
  const event = EVENT || input.hook_event_name || 'unknown';
  let ctx = {};
  try {
    const f = join(stateDir, 'wf.json');
    if (existsSync(f)) {
      const wf = JSON.parse(readFileSync(f, 'utf8'));
      ctx = {
        task: wf.task?.id,
        open: wf.items.filter((i) => i.status === 'todo' || i.status === 'doing').length,
        blocked: wf.items.filter((i) => i.status === 'blocked').length,
      };
    }
  } catch {
    /* wf state is optional */
  }
  ctx.cat = process.env.JOURNAL_CAT;
  const res = appendEntry(buildEntry(event, input, ctx), dirs);
  if (!res.ok) noteError('write-failed', dirs);
  else if (res.failed.length) noteError('primary-dir-failed', dirs);

  if (event === 'SessionStart') {
    const read = (p) => {
      try {
        return JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        return null;
      }
    };
    const reg = checkRegistration([
      read(join(ROOT, '.claude/settings.json')),
      read(join(ROOT, '.claude/settings.local.json')),
    ]);
    const bits = [];
    if (!res.ok) bits.push('журнал недоступний для запису');
    else if (res.failed.length) bits.push('основний каталог журналу недоступний, пишу у запасний');
    if (reg.missing.length) bits.push(`немає рекордера для: ${reg.missing.join(', ')}`);
    if (reg.badMatcher.length) bits.push(`матчер не "*" для: ${reg.badMatcher.join(', ')}`);
    if (reg.disabled) bits.push('hooks вимкнені (disableAllHooks)');
    if (bits.length)
      warn = `ЗАПИС ЗАХВОРІВ: ${bits.join('; ')}. Виправ це першим (docs/specs/SPO-639-W21-capture-reliability.md).`;
  }
} catch {
  /* a broken recorder must never trap a session */
}
if (warn) console.log(warn);
process.exit(0);
