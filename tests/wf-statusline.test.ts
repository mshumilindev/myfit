import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const run = (dir: string) =>
  spawnSync('node', ['devflow/bin/wf-statusline.mjs'], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  }).stdout.trim();

describe('wf-statusline', () => {
  it('says "No task yet" when the project has no wf state', () => {
    expect(run(mkdtempSync(join(tmpdir(), 'sl-')))).toBe('No task yet');
  });

  it('draws one square per item, parked open tasks and the percentage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sl-'));
    mkdirSync(join(dir, '.claude/state'), { recursive: true });
    const items = [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'doing' },
      { id: 'c', status: 'blocked' },
      { id: 'd', status: 'skipped' },
    ];
    writeFileSync(
      join(dir, '.claude/state/wf.json'),
      JSON.stringify({
        task: { id: 'T-1' },
        items,
        parked: [{ task: { id: 'T-2' }, items: [{ id: 'x', status: 'todo' }] }],
      }),
    );
    const out = run(dir);
    expect(out).toContain('T-1 🟩🟦🟥🟨 25% 1/4');
    expect(out).toContain('│ T-2 0%');
  });
});
