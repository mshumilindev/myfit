import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NEEDS } from '../scripts/lib/wf-core.mjs';

/** SPO-639: the layers that keep Claude working without owner nudges must not be removed quietly. */
const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
const commands = (event: string): string[] =>
  (settings.hooks[event] ?? []).flatMap((g: { hooks: { command: string }[] }) =>
    g.hooks.map((h) => h.command),
  );

describe('wf enforcement layers', () => {
  it('Stop hook keeps the session going while open items exist', () => {
    expect(commands('Stop').some((c) => c.includes('wf-stop-hook.mjs'))).toBe(true);
  });
  it('status is injected at session start and on every prompt', () => {
    for (const event of ['SessionStart', 'UserPromptSubmit']) {
      expect(commands(event).some((c) => c.includes('wf-context-hook.mjs'))).toBe(true);
    }
  });
  it('wf rejects a generic "decision" blocker', () => {
    expect(NEEDS).not.toContain('decision');
  });
  it('CLAUDE.md carries both owner rules', () => {
    const md = readFileSync('CLAUDE.md', 'utf8');
    expect(md).toContain('Не зупиняйся і не чекай нагадування');
    expect(md).toContain('Без підтверджень і без «чекаю на тебе»');
  });
});
