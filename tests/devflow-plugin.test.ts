import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'devflow');
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

describe('devflow plugin package', () => {
  const hooks = read('hooks/hooks.json').hooks as Record<
    string,
    { hooks: { command: string }[] }[]
  >;
  it('declares hooks and skills in the manifest', () => {
    const m = read('.claude-plugin/plugin.json');
    expect(m.hooks).toBe('./hooks/hooks.json');
    expect(m.skills).toBe('./skills');
    expect(existsSync(join(ROOT, 'skills/wf/SKILL.md'))).toBe(true);
  });
  it('every hook script resolves inside the plugin and exists', () => {
    for (const groups of Object.values(hooks))
      for (const g of groups)
        for (const h of g.hooks) {
          expect(h.command).not.toContain('CLAUDE_PROJECT_DIR');
          const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(bin\/[\w-]+\.mjs|native\/[\w-]+\.sh)/.exec(
            h.command,
          );
          expect(m, h.command).not.toBeNull();
          expect(existsSync(join(ROOT, m![1])), m![1]).toBe(true);
        }
  });
  it('covers the events the journal and wf rely on', () => {
    for (const ev of ['SessionStart', 'UserPromptSubmit', 'Stop', 'PreToolUse', 'PostToolUse'])
      expect(hooks[ev]).toBeTruthy();
  });
});
