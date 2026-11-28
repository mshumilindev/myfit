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
