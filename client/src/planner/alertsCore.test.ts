import { describe, expect, it } from 'vitest';
import { dueRings, nextWake, RING_WINDOW_MS, ringKey } from './alertsCore';
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
    expect(nextWake([plan({})], 1000)).toBe(
      1000 + RING_WINDOW_MS > 5000 ? 5000 : 1000 + RING_WINDOW_MS,
    );
    expect(nextWake([plan({ mode: 'quiet' })], 0)).toBeNull();
    expect(nextWake([plan({})], 1000, { k: 1500 })).toBe(1500);
  });
});
