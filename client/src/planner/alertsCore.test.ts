import { describe, expect, it } from 'vitest';
import { dueRings, foldAlerts, mergeAlert, nextWake, RING_WINDOW_MS, ringKey } from './alertsCore';
import type { PlanDoc } from './types';

const plan = (over: Partial<PlanDoc>): PlanDoc =>
  ({
    id: 'p',
    title: 'x',
    icon: 'bell',
    color: 'accent',
    timing: {} as PlanDoc['timing'],
    mode: 'ring',
    respectQuiet: false,
    enabled: true,
    nextFireAt: null,
    fireAts: [1000, 9_000_000],
    v: 1,
    updatedAt: 0,
    ...over,
  }) as PlanDoc;

describe('dueRings', () => {
  it('rings from the moment until the window ends', () => {
    expect(dueRings([plan({})], 999, new Set())).toHaveLength(0);
    expect(dueRings([plan({})], 1000, new Set())).toHaveLength(1);
    expect(dueRings([plan({})], 1000 + RING_WINDOW_MS - 1, new Set())).toHaveLength(1);
    expect(dueRings([plan({})], 1000 + RING_WINDOW_MS, new Set())).toHaveLength(0);
  });
  it('skips quiet, disabled, dismissed and snoozed ones', () => {
    expect(dueRings([plan({ mode: 'quiet' })], 1000, new Set())).toHaveLength(0);
    expect(dueRings([plan({ enabled: false })], 1000, new Set())).toHaveLength(0);
    expect(dueRings([plan({})], 1000, new Set([ringKey('p', 1000)]))).toHaveLength(0);
    expect(dueRings([plan({})], 1000, new Set(), { [ringKey('p', 1000)]: 2000 })).toHaveLength(0);
    expect(dueRings([plan({})], 2000, new Set(), { [ringKey('p', 1000)]: 2000 })).toHaveLength(1);
  });
  it('falls back to nextFireAt when there is no list', () => {
    expect(
      dueRings([plan({ fireAts: undefined, nextFireAt: 1000 })], 1000, new Set()),
    ).toHaveLength(1);
  });
});

describe('nextWake', () => {
  it('returns the earliest future moment, window end or snooze end', () => {
    expect(nextWake([plan({})], 0)).toBe(1000);
    expect(nextWake([plan({})], 1000)).toBe(1000 + RING_WINDOW_MS);
    expect(nextWake([plan({ mode: 'quiet' })], 0)).toBeNull();
    expect(nextWake([plan({})], 1000, { k: 1500 })).toBe(1500);
  });
});

describe('mergeAlert', () => {
  it('dismissed is final and beats a snooze that arrives later', () => {
    expect(
      mergeAlert({ state: 'dismissed', rev: 3 }, { state: 'snoozed', snoozeUntil: 9 }),
    ).toBeNull();
    expect(
      mergeAlert({ state: 'snoozed', snoozeUntil: 9, rev: 2 }, { state: 'dismissed' }),
    ).toEqual({
      state: 'dismissed',
      rev: 3,
    });
  });
  it('of two snoozes the later one wins, the earlier one changes nothing', () => {
    const cur = { state: 'snoozed' as const, snoozeUntil: 10, rev: 1 };
    expect(mergeAlert(cur, { state: 'snoozed', snoozeUntil: 5 })).toBeNull();
    expect(mergeAlert(cur, { state: 'snoozed', snoozeUntil: 20 })).toEqual({
      state: 'snoozed',
      snoozeUntil: 20,
      rev: 2,
    });
  });
  it('the first write creates the state with rev 1', () => {
    expect(mergeAlert(undefined, { state: 'snoozed', snoozeUntil: 5 })?.rev).toBe(1);
  });
});

describe('foldAlerts', () => {
  it('folds shared states into the handled set and the snooze map', () => {
    const { handled, snoozed } = foldAlerts({
      a: { state: 'dismissed', rev: 1 },
      b: { state: 'snoozed', snoozeUntil: 7, rev: 1 },
      c: { state: 'ringing', rev: 1 },
    });
    expect([...handled]).toEqual(['a']);
    expect(snoozed).toEqual({ b: 7 });
  });
});
