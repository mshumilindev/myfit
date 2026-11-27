import { describe, expect, it } from 'vitest';
import { formatIdea } from '../scripts/lib/idea.mjs';
import { renderHygiene, staleBranches } from '../scripts/lib/hygiene-report.mjs';
import { orderTodo } from '../scripts/lib/wf-core.mjs';

const NOW = Date.parse('2026-11-27T00:00:00Z');
const b = (name: string, merged: boolean, lastCommit: string) => ({
  name,
  mergedIntoMain: merged,
  lastCommit,
});

describe('hygiene report', () => {
  const branches = [
    b('main', true, '2026-01-01T00:00:00Z'),
    b('old-merged', true, '2026-11-01T00:00:00Z'),
    b('fresh-merged', true, '2026-11-26T00:00:00Z'),
    b('old-open', false, '2026-09-01T00:00:00Z'),
    b('fresh-open', false, '2026-11-20T00:00:00Z'),
    b('ready-for-cpd/SPO-9', false, '2026-09-01T00:00:00Z'),
  ];
  it('flags merged >=7d and open >=30d, never main', () => {
    expect(staleBranches(branches, NOW).map((x) => x.name)).toEqual([
      'old-open',
      'ready-for-cpd/SPO-9',
      'old-merged',
    ]);
  });
  it('lists ready-for-cpd as waiting, not stale', () => {
    const md = renderHygiene(branches, NOW);
    expect(md).toContain('Чекають на `cpd` (1)');
    expect(md).toMatch(/Застарілі \(2\)/);
    expect(md).not.toMatch(/Застарілі[\s\S]*ready-for-cpd/);
  });
});

describe('queue order and ideas', () => {
  it('orders ac before step before extra, stable inside a kind', () => {
    const items = [
      { id: 'e1', kind: 'extra' },
      { id: 's1', kind: 'step' },
      { id: 'a1', kind: 'ac' },
      { id: 's2', kind: 'step' },
      { id: 'a2', kind: 'ac' },
    ];
    expect(orderTodo(items).map((i) => i.id)).toEqual(['a1', 'a2', 's1', 's2', 'e1']);
  });
  it('formats an idea as a single dated line', () => {
    expect(formatIdea('  нова\n ідея ', new Date('2026-11-27T10:00:00Z'))).toBe(
      '- 2026-11-27 · нова ідея\n',
    );
  });
});
