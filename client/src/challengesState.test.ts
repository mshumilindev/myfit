import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeChallenges, reconcileChallenges, type ActiveChallenge } from './challengesState';

const ch = (id: string, over: Partial<ActiveChallenge> = {}): ActiveChallenge => ({
  id,
  templateId: 'vol-1',
  startedAt: 1,
  endsAt: 2,
  target: 10,
  status: 'active',
  ...over,
});

async function fresh() {
  vi.resetModules();
  return import('./challengesState');
}

describe('challenges in the account (SPO-391)', () => {
  beforeEach(() => localStorage.clear());

  it('normalize keeps well-formed entries and drops the rest', () => {
    const list = normalizeChallenges([
      ch('a', { completedAt: 5, celebrated: true }),
      ch('a'), // duplicate id
      { id: 'b' }, // incomplete
      { ...ch('c'), status: 'weird' },
      null,
      ch('d', { status: 'given-up' }),
    ]);
    expect(list.map((c) => c.id)).toEqual(['a', 'd']);
    expect(list[0]).toMatchObject({ completedAt: 5, celebrated: true });
    expect(normalizeChallenges('x')).toEqual([]);
  });

  it('reconcile: send a local list to an empty account, newer wins, account wins otherwise', () => {
    const a = [ch('a')];
    expect(reconcileChallenges({ at: 0, list: [] }, null)).toEqual({});
    expect(reconcileChallenges({ at: 0, list: a }, null)).toEqual({ push: true });
    expect(reconcileChallenges({ at: 50, list: a }, { at: 40, raw: [] })).toEqual({ push: true });
    expect(reconcileChallenges({ at: 40, list: a }, { at: 40, raw: [] })).toEqual({});
    const d = reconcileChallenges({ at: 10, list: a }, { at: 40, raw: [ch('z'), { bad: 1 }] });
    expect(d.apply?.at).toBe(40);
    expect(d.apply?.list.map((c) => c.id)).toEqual(['z']);
  });

  it('an old local list (no stamp) is read as it was and sent once', async () => {
    localStorage.setItem('spotter.challenges', JSON.stringify([ch('old')]));
    const m = await fresh();
    expect(m.getChallenges().map((c) => c.id)).toEqual(['old']);
    expect(m.getChallengesAt()).toBe(0);
    expect(m.reconcileChallenges({ at: 0, list: m.getChallenges() }, null).push).toBe(true);
  });

  it('a local edit is stamped, stored, and announced; a remote list is neither stamped anew nor announced', async () => {
    const m = await fresh();
    const seen = vi.fn();
    m.onChallengesEdit(seen);
    m.commitChallenges([ch('x')]);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(m.getChallengesAt()).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('spotter.challenges')!)).toHaveLength(1);
    m.applyRemoteChallenges([ch('y')], 12345);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(m.getChallengesAt()).toBe(12345);
    expect(m.getChallenges().map((c) => c.id)).toEqual(['y']);
  });

  it('reset leaves nothing behind', async () => {
    const m = await fresh();
    m.commitChallenges([ch('x')]);
    m.resetChallenges();
    expect(m.getChallenges()).toEqual([]);
    expect(localStorage.getItem('spotter.challenges')).toBeNull();
    expect(localStorage.getItem('spotter.challengesAt')).toBeNull();
  });

  it('first contact with challenges on both sides: the account wins on the same id, this device adds only its own', () => {
    const mk = (id: string, target: number) => ({
      id,
      templateId: 't',
      startedAt: 1,
      endsAt: 2,
      target,
      status: 'active' as const,
    });
    const d = reconcileChallenges(
      { at: 0, list: [mk('a', 1), mk('b', 2)] },
      { at: 100, raw: [mk('a', 99)] },
    );
    expect(d.apply?.list.map((c) => [c.id, c.target])).toEqual([
      ['a', 99],
      ['b', 2],
    ]);
    expect(d.push).toBe(true);
  });
});
