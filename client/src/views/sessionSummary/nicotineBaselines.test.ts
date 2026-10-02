import { describe, expect, it } from 'vitest';
import {
  fmtRangeText,
  nicotineCardModel,
  recoveryGapHours,
  summaryBaselines,
} from './nicotineBaselines';
import { defaultNicotineSettings, newNicotineProduct, summaryHints } from '../../nicotine';
import type { SleepNight, Workout } from '../../types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 30, 18);

const lift = (
  id: string,
  startedAt: number,
  name: string,
  muscle: string,
  kg: number,
  reps = 5,
): Workout =>
  ({
    id,
    startedAt,
    finishedAt: startedAt + HOUR,
    exercises: [
      {
        id: `e${id}`,
        name,
        position: 0,
        kind: 'strength',
        primaryMuscle: muscle,
        sets: [{ id: `s${id}`, reps, weight: kg, isWarmup: false, position: 0 }],
      },
    ],
  }) as unknown as Workout;
const legs = (id: string, daysAgo: number) =>
  lift(id, NOW - daysAgo * DAY, 'Barbell Squat', 'quads', 100);

describe('recoveryGapHours', () => {
  it('is the median gap between same-type sessions, this one included', () => {
    const cur = legs('cur', 0);
    // starts: 0, 3, 6.5, 9 days ago -> gaps 72, 84, 60 h -> median 72
    const past = [legs('a', 3), legs('b', 6.5), legs('c', 9)];
    expect(recoveryGapHours(cur, past)).toBe(72);
  });
  it('needs at least two gaps, ignores other day types and long breaks', () => {
    const cur = legs('cur', 0);
    expect(recoveryGapHours(cur, [legs('a', 3)])).toBeNull();
    const push = lift('p', NOW - 2 * DAY, 'Barbell Bench Press - Medium Grip', 'chest', 80);
    expect(recoveryGapHours(cur, [legs('a', 3), legs('b', 6), push])).toBe(72);
    expect(recoveryGapHours(cur, [legs('a', 40), legs('b', 80)])).toBeNull();
  });
});

describe('summaryBaselines', () => {
  const night = (d: number): SleepNight => {
    const bed = NOW - d * DAY - 10 * HOUR;
    return {
      id: `n${d}`,
      date: String(d),
      bedtime: bed,
      wake: bed + 7 * HOUR,
      source: 'backfill',
    } as SleepNight;
  };
  it('averages the last two weeks of sleep once there are enough nights', () => {
    const cur = legs('cur', 0);
    expect(summaryBaselines(cur, [], [night(1), night(2)], NOW).avgSleepMin).toBeNull();
    expect(summaryBaselines(cur, [], [night(1), night(2), night(3)], NOW).avgSleepMin).toBe(420);
  });
});

describe('nicotineCardModel', () => {
  const nic = {
    products: [{ ...newNicotineProduct('cigarettes', 'c'), amount: 20 }],
    settings: defaultNicotineSettings(),
  };
  const base = { recoveryGapHours: 72, avgSleepMin: 420 };

  it('turns the "none" scenario into whole percents, one-decimal kg and whole minutes', () => {
    const m = nicotineCardModel(nic, base)!;
    const none = summaryHints(nic, base)!.none;
    expect(m.recoveryPct!.low).toBe(Math.round((none.recoveryGapShorterHours!.low / 72) * 100));
    expect('top' in m).toBe(false); // the top-set / e1RM line has no research behind it
    expect(m.sleepMin).toEqual(none.sleepNeedLessMin);
    expect(m.recoveryPct!.low).toBeLessThanOrEqual(m.recoveryPct!.high);
  });
  it('is null when the hints are off or nothing is measurable', () => {
    expect(nicotineCardModel({ ...nic, products: [] }, base)).toBeNull();
    expect(
      nicotineCardModel(
        {
          ...nic,
          settings: {
            ...nic.settings,
            surfaces: { ...nic.settings.surfaces, afterWorkoutHints: false },
          },
        },
        base,
      ),
    ).toBeNull();
    expect(nicotineCardModel(nic, { recoveryGapHours: null, avgSleepMin: null })).toBeNull();
  });
});

describe('fmtRangeText', () => {
  it('shows one number when both ends round alike, else a range', () => {
    expect(fmtRangeText({ low: 4.6, high: 5.2 })).toBe('5');
    expect(fmtRangeText({ low: 5, high: 8 })).toBe('5–8');
    expect(fmtRangeText({ low: 1.2, high: 2.9 }, 1)).toBe('1.2–2.9');
  });
});
