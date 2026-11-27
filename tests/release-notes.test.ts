import { describe, expect, it } from 'vitest';
import { parseSubjects, renderNotes } from '../scripts/lib/release-notes.mjs';
import { countErrors, evaluateGate } from '../scripts/lib/post-deploy-gate.mjs';

describe('release notes', () => {
  const subjects = [
    'Фікс таймера відпочинку (SPO-601)',
    'Нове: планувальник (SPO-552, SPO-556)',
    'Merge branch x',
    '',
    'Док: runbook',
  ];
  it('skips merges and blanks, extracts tasks and kinds', () => {
    const p = parseSubjects(subjects);
    expect(p).toHaveLength(3);
    expect(p[0]).toMatchObject({ kind: 'fix', tasks: ['SPO-601'] });
    expect(p[1].tasks).toEqual(['SPO-552', 'SPO-556']);
    expect(p[2].kind).toBe('docs');
  });
  it('renders grouped markdown with a task list', () => {
    const md = renderNotes({ version: 'v1.2.0', date: '2026-11-27', subjects });
    expect(md).toContain('# v1.2.0 · 2026-11-27');
    expect(md.indexOf('## Нове')).toBeLessThan(md.indexOf('## Виправлення'));
    expect(md).toContain('Задачі: SPO-552, SPO-556, SPO-601');
  });
  it('empty range still renders', () => {
    expect(renderNotes({ version: 'v0', date: 'd', subjects: [] })).toContain('Задачі: —');
  });
});

describe('post-deploy gate', () => {
  const mk = (n: number, sev: string) => Array.from({ length: n }, () => ({ severity: sev }));
  it('counts ERROR and above only', () => {
    expect(
      countErrors([...mk(3, 'INFO'), ...mk(2, 'WARNING'), ...mk(1, 'ERROR'), ...mk(1, 'critical')]),
    ).toBe(2);
  });
  it('passes under both thresholds', () => {
    expect(evaluateGate([...mk(200, 'INFO'), ...mk(2, 'ERROR')]).ok).toBe(true);
  });
  it('fails over the absolute cap or the share', () => {
    expect(evaluateGate([...mk(1000, 'INFO'), ...mk(6, 'ERROR')]).ok).toBe(false);
    expect(evaluateGate([...mk(10, 'INFO'), ...mk(1, 'ERROR')]).ok).toBe(false);
  });
  it('no logs is not a failure', () => {
    expect(evaluateGate([])).toMatchObject({ ok: true, errors: 0 });
  });
});
