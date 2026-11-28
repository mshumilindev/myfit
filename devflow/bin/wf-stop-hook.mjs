#!/usr/bin/env node
/** SPO-639 (WF-C): Stop hook entry. exit 2 + stderr = keep working; exit 0 = may stop. Never throws. */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { decideDegraded, decideStop } from '../core/wf-stop.mjs';
import { checkRegistration, countErrors, journalDirs } from '../core/journal.mjs';

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
try {
  const dir = process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state');
  const file = join(dir, 'wf.json');
  if (!existsSync(file)) process.exit(0);
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    input = {};
  }
  const state = JSON.parse(readFileSync(file, 'utf8'));
  const verdict = decideStop({ input, state, mtimeMs: statSync(file).mtimeMs });
  if (!verdict.block) {
    // capture health: tell once per session when the recorder is unregistered or failing
    const read = (f) => {
      try {
        return JSON.parse(readFileSync(f, 'utf8'));
      } catch {
        return null;
      }
    };
    const reg = checkRegistration([
      read(join(ROOT, '.claude/settings.json')),
      read(join(ROOT, '.claude/settings.local.json')),
    ]);
    const degraded = [];
    if (reg.missing.length) degraded.push(`немає рекордера для: ${reg.missing.join(', ')}`);
    if (reg.badMatcher.length) degraded.push(`матчер не "*" для: ${reg.badMatcher.join(', ')}`);
    if (reg.disabled) degraded.push('hooks вимкнені (disableAllHooks)');
    if (countErrors(journalDirs({ stateDir: dir }), Date.now() - 6 * 3600 * 1000) > 0)
      degraded.push('журнал повідомляв про помилки запису');
    const marker = join(dir, 'degraded-warned');
    let warnedSid = null;
    try {
      warnedSid = readFileSync(marker, 'utf8').trim();
    } catch {
      /* none yet */
    }
    const d = decideDegraded({ input, degraded, warnedSid });
    if (d.block) {
      try {
        writeFileSync(marker, d.sid);
      } catch {
        process.exit(0); // cannot remember the warning: do not risk blocking twice
      }
      console.error(d.reason);
      process.exit(2);
    }
  }
  if (verdict.block) {
    console.error(verdict.reason);
    process.exit(2);
  }
} catch {
  /* a broken hook must never trap a session */
}
process.exit(0);
