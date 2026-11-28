import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { branchStep } from '../devflow/bin/wf.mjs';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'wfb-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: d, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  g('-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return { d, g };
}

describe('wf branch convention', () => {
  it('start moves work off main onto work/<TASK>-<slug>, ready renames it into the cpd queue', () => {
    const { d, g } = repo();
    expect(branchStep(['start', 'T-1', 'My Feature!'], d)).toBe('branch: work/T-1-my-feature');
    expect(g('rev-parse', '--abbrev-ref', 'HEAD')).toBe('work/T-1-my-feature');
    expect(branchStep(['start', 'T-1'], d)).toBe('');
    expect(branchStep(['ready', 'T-1'], d)).toBe(
      'branch: work/T-1-my-feature -> ready-for-cpd/T-1',
    );
    expect(g('branch', '--list', 'work/*')).toBe('');
  });
  it('ready refuses a branch of another task; --no-branch and bad ids do nothing', () => {
    const { d, g } = repo();
    expect(branchStep(['ready', 'T-2'], d)).toContain('nothing renamed');
    expect(branchStep(['start', 'T-3', '--no-branch'], d)).toBe('');
    expect(branchStep(['start', 'bad id'], d)).toBe('');
    expect(g('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });
});
