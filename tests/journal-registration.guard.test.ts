import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkRegistration, readJournalDirs, REQUIRED_EVENTS } from '../scripts/lib/journal.mjs';

const ROOT = resolve(__dirname, '..');
const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8'));
const BASE = join(ROOT, '.claude/state');
mkdirSync(BASE, { recursive: true });
const work = mkdtempSync(join(BASE, 'jguard-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('recorder is registered for every event (SPO-639 W23)', () => {
  it('settings.json passes the registration check', () => {
    expect(checkRegistration([settings])).toMatchObject({ ok: true, missing: [], badMatcher: [] });
  });
  it('the recorder is its own group and comes first in every event', () => {
    for (const ev of REQUIRED_EVENTS) {
      const groups = settings.hooks[ev] as { hooks: { command: string }[] }[];
      expect(groups[0].hooks.map((h) => h.command).join(' ')).toContain('journal-hook.mjs');
      expect(groups[0].hooks).toHaveLength(1);
      const cmd = groups[0].hooks[0].command;
      expect(cmd.endsWith('|| true')).toBe(true);
      expect(cmd).not.toMatch(/\bbash\b/);
    }
  });
  it('no older hook script writes the journal inline', () => {
    for (const f of [
      'scripts/wf-stop-hook.mjs',
      'scripts/wf-context-hook.mjs',
      '.claude/hooks/stop-guards.sh',
    ]) {
      expect(readFileSync(join(ROOT, f), 'utf8')).not.toMatch(/journal/i);
    }
  });
});

describe('guard-bash records each block as a rule id only', () => {
  const run = (command: string) =>
    spawnSync('bash', [join(ROOT, '.claude/hooks/guard-bash.sh')], {
      input: JSON.stringify({ session_id: 'gb', tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
      env: { ...process.env, WF_STATE_DIR: work, CLAUDE_PROJECT_DIR: ROOT },
    });
  it.each([
    ['git commit --no-verify -m x', 'no-verify'],
    ['git push origin main --force', 'force-push'],
    ['pkill -f node', 'pkill'],
    ['git reset --hard HEAD~1', 'destructive-git'],
    ['cat .env', 'secrets'],
  ])('%s -> exit 2 and cat %s', (command, cat) => {
    const r = run(command);
    expect(r.status).toBe(2);
    const entries = readJournalDirs([join(work, 'journal')]).entries as {
      ev: string;
      cat?: string;
    }[];
    expect(entries.some((e) => e.ev === 'GuardBlock' && e.cat === cat)).toBe(true);
    expect(JSON.stringify(entries)).not.toMatch(/--no-verify|pkill -f|reset --hard|\.env/);
  });
  it('an allowed command passes and writes nothing itself', () => {
    expect(run('git status').status).toBe(0);
  });
  it('a failing recorder never changes the decision', () => {
    const r = spawnSync('bash', [join(ROOT, '.claude/hooks/guard-bash.sh')], {
      input: JSON.stringify({ tool_input: { command: 'pkill -f x' } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: '/nonexistent' },
    });
    expect(r.status).toBe(2);
    expect(readdirSync(work).length).toBeGreaterThan(0);
  });
});
