import { describe, expect, it } from 'vitest';
import type { Activity } from './types';
import { activityTrends, momentumOf } from './activityTrends';
import { weekStartOf } from './weekStart';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 8, 30, 12, 0).getTime(); // Wed 30 Sep 2026
const WEEK0 = weekStartOf(NOW, 1);

function act(
  type: string,
  daysAgo: number,
  min: number,
  category: Activity['category'] = 'conditioning',
): Activity {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id: `${type}-${daysAgo}`,
    type,
    category,
    startedAt,
    finishedAt: startedAt + min * 60000,
    durationMin: min,
  } as Activity;
}

describe('momentumOf', () => {
  it('reads the last half against the first', () => {
    expect(momentumOf([10, 10, 10, 10, 20, 20, 20, 20])).toBe('rising');
    expect(momentumOf([20, 20, 20, 20, 5, 5, 5, 5])).toBe('fading');
    expect(momentumOf([10, 10, 10, 10, 10, 10, 10, 10])).toBe('steady');
    expect(momentumOf([0, 0, 0, 0, 0, 0, 30, 0])).toBe('rising');
  });
});

describe('activityTrends', () => {
  it('stays hidden with fewer than two finished sessions', () => {
    expect(activityTrends([], NOW, 80, 8, 1)).toBeNull();
    expect(activityTrends([act('padel', 1, 60)], NOW, 80, 8, 1)).toBeNull();
  });

  it('buckets minutes per week by category, oldest first', () => {
    const t = activityTrends(
      [act('padel', 1, 60), act('yoga', 2, 30, 'recovery'), act('padel', 9, 45)],
      NOW,
      80,
      8,
      1,
    )!;
    expect(t.weeks).toHaveLength(8);
    expect(t.weeks[7]!.start).toBe(WEEK0);
    expect(t.weeks[7]!.conditioningMin).toBe(60);
    expect(t.weeks[7]!.recoveryMin).toBe(30);
    expect(t.weeks[6]!.conditioningMin).toBe(45);
    expect(t.sessions).toBe(3);
    expect(t.totalMin).toBe(135);
  });

  it('ignores live, future and out-of-window activities', () => {
    const live = { ...act('padel', 0, 30), finishedAt: null } as Activity;
    const old = act('padel', 120, 60);
    const t = activityTrends(
      [live, old, act('padel', 1, 40), act('padel', 3, 40)],
      NOW,
      null,
      8,
      1,
    )!;
    expect(t.sessions).toBe(2);
  });

  it('computes the last-4-vs-prior-4 change', () => {
    const t = activityTrends(
      [act('walk', 40, 100), act('walk', 3, 150), act('walk', 10, 50)],
      NOW,
      null,
      8,
      1,
    )!;
    expect(t.deltaPct).toBe(100);
    const none = activityTrends([act('walk', 3, 30), act('walk', 5, 30)], NOW, null, 8, 1)!;
    expect(none.deltaPct).toBeNull();
  });

  it('ranks types by frequency, with a usual weekday for a clear majority', () => {
    const acts = [
      // Four Saturdays of padel (27 Sep 2026 is a Sunday → Saturdays are 26 Sep, 19, 12, 5)
      act('padel', 4, 80),
      act('padel', 11, 75),
      act('padel', 18, 90),
      act('padel', 25, 70),
      act('walk', 1, 30),
      act('walk', 2, 30),
    ];
    const t = activityTrends(acts, NOW, null, 8, 1)!;
    expect(t.top.map((x) => x.type)).toEqual(['padel', 'walk']);
    const padel = t.top[0]!;
    expect(padel.count).toBe(4);
    expect(padel.medianMin).toBe(78);
    expect(padel.usualDay).toBe(6);
    expect(padel.recent).toHaveLength(3);
    expect(t.top[1]!.usualDay).toBeNull();
  });
});
