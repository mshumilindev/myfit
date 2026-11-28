import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs without types
import { etaOf, paceOf } from '../devflow/bin/wf-snapshot.mjs';

const MIN = 60000;
const now = 10_000_000_000;
const done = (minAgo: number) => ({ type: 'done', ts: now - minAgo * MIN });
const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `T.${i}`, status: 'todo' }));

describe('wf snapshot pace and ETA', () => {
  it('has no estimate with fewer than three usable gaps', () => {
    expect(paceOf([done(10), done(5)], now)).toBeNull();
    expect(etaOf(items(4), null, now)).toMatch(/n\/a/);
  });

  it('ignores idle gaps longer than 15 minutes', () => {
    const events = [done(50), done(20), done(18), done(16), done(14)];
    const pace = paceOf(events, now);
    expect(pace?.samples).toBe(3);
    expect(pace?.median).toBeCloseTo(2, 5);
  });

  it('gives a range that shrinks by the time since the last finished item', () => {
    const pace = paceOf([done(8), done(6), done(4), done(2)], now);
    expect(etaOf(items(5), pace, now)).toMatch(/≈ .*left/);
    const later = etaOf(items(5), pace, now + 4 * MIN);
    expect(later).toMatch(/≈ .*left/);
  });

  it('names blocked items instead of counting them', () => {
    const pace = paceOf([done(8), done(6), done(4), done(2)], now);
    expect(etaOf([{ id: 'B', status: 'blocked' }], pace, now)).toBe('Waiting on 1 blocked');
    expect(etaOf([{ id: 'D', status: 'done' }], pace, now)).toBeNull();
  });
});

describe('promptsOf', () => {
  it('builds copy-ready prompts for open, blocked and cpd work', async () => {
    const { promptsOf } = await import('../devflow/bin/wf-snapshot.mjs');
    const task = {
      task: 'SPO-1',
      active: true,
      blocks: [
        { id: 'A.1', text: 'one', status: 'todo', why: '' },
        { id: 'A.2', text: 'two', status: 'blocked', why: 'Waiting on: access' },
        { id: 'A.3', text: 'three', status: 'done', why: '' },
      ],
    };
    const out = promptsOf([task], [{ name: 'main', kind: 'cpd', ahead: 2, subject: '' }]);
    expect(out.map((p: { label: string }) => p.label)).toEqual([
      'Finish 1 open in SPO-1',
      'Unblock A.2',
      'cpd',
    ]);
    expect(out[0].text).toContain('A.1');
    expect(out[2].text).toBe('cpd');
  });
});

describe('classifyBranch', () => {
  const now = Date.parse('2026-11-28T00:00:00Z');
  const fresh = '2026-11-27T00:00:00Z';
  const old = '2026-10-01T00:00:00Z';
  const linear = {
    'SPO-1': { status: 'In Progress', type: 'started' },
    'SPO-2': { status: 'Deployed to prod', type: 'completed' },
    'SPO-3': { status: 'Backlog', type: 'backlog' },
  };
  it('Linear closed wins over a fresh commit, started wins over an old one', async () => {
    const { classifyBranch } = await import('../devflow/bin/wf-snapshot.mjs');
    expect(classifyBranch({ name: 'spo-2-x', subject: '', date: fresh }, linear, now).kind).toBe(
      'stale',
    );
    expect(classifyBranch({ name: 'spo-1-x', subject: '', date: old }, linear, now).kind).toBe(
      'dev',
    );
  });
  it('backlog and unknown tasks fall back to commit age and carry the Linear status', async () => {
    const { classifyBranch } = await import('../devflow/bin/wf-snapshot.mjs');
    const b = classifyBranch({ name: 'spo-3-x', subject: 's', date: fresh }, linear, now);
    expect(b.kind).toBe('dev');
    expect(b.subject).toBe('[Backlog] s');
    expect(classifyBranch({ name: 'no-task', subject: '', date: old }, linear, now).kind).toBe(
      'stale',
    );
  });
});

describe('staleIds', () => {
  it('marks downstream items done before a later add, not the ones done after it', async () => {
    const { staleIds } = await import('../devflow/bin/wf-snapshot.mjs');
    const items = [
      { id: 'D1', text: 'build', status: 'done' },
      { id: 'T1', text: 'tests green', status: 'done' },
      { id: 'C1', text: 'ci run', status: 'done' },
      { id: 'N1', text: 'new work', status: 'todo' },
    ];
    const ev = [
      { type: 'done', item: 'T1', ts: 10 },
      { type: 'add', item: 'N1', ts: 20 },
      { type: 'done', item: 'C1', ts: 30 },
    ];
    expect([...staleIds(items, ev)]).toEqual(['T1']);
  });
});
