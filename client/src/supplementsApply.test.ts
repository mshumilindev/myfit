/**
 * Supplements applied quietly (see supplements.ts). Per number: (1) off = nothing changes,
 * (2) on = it changes within the published ranges, (3) that surface off = neutral, and (4) the
 * training days come from the plan, the finished workouts and the habit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from './store';
import {
  SUPPLEMENT_EFFECT_KEYS,
  SUPPLEMENT_NEUTRAL,
  SUPPLEMENT_SURFACES,
  defaultSupplementSettings,
  emptySupplementState,
  newSupplementEntry,
} from './supplements';
import {
  supMid,
  supRange,
  supplementContext,
  supplementProteinGrams,
  supplementSafety,
} from './supplementsApply';
import type { SupplementEntry, SupplementId, SupplementSurface, Workout } from './types';

// Wed 2026-10-07 12:00 is "now"; the entries were saved on 2026-09-01.
const NOW = new Date(2026, 9, 7, 12).getTime();
const T0 = new Date(2026, 8, 1, 10).getTime();
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});
const at = (day: number, h: number) => new Date(2026, 9, day, h).getTime();
const workout = (startedAt: number, finished = true): Workout =>
  ({
    id: `w${startedAt}`,
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    autoFinished: false,
    gymId: null,
    exercises: [],
  }) as Workout;

function setSup(
  entries: SupplementEntry[],
  opts: { master?: boolean; off?: SupplementSurface[] } = {},
  extra: Record<string, unknown> = {},
): void {
  const settings = defaultSupplementSettings();
  settings.useInCalculations = opts.master ?? true;
  for (const s of opts.off ?? []) settings.surfaces[s] = false;
  __replaceStateForTests({
    ...__getStateForTests(),
    supplements: { entries, checkins: {}, settings, updatedAt: 1 },
    ...extra,
  });
}
const plan = (days: number[]) =>
  localStorage.setItem(
    'spotter.programMine',
    JSON.stringify({
      program: {
        id: 'p1',
        name: 'Plan',
        weeks: 0,
        daysPerWeek: days.length,
        items: days.map((d, i) => ({
          id: `i${i}`,
          day: d,
          position: 0,
          name: 'Squat',
          kind: 'strength',
        })),
      },
    }),
  );

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setSup([]);
});
afterEach(() => {
  vi.useRealTimers();
  __replaceStateForTests({
    ...__getStateForTests(),
    supplements: emptySupplementState(),
    workouts: [],
    bodyMetrics: { weights: [] } as never,
  });
});

describe('supMid', () => {
  it('is neutral for every key with nothing saved, the master off, or the surface off', () => {
    for (const k of SUPPLEMENT_EFFECT_KEYS) {
      expect(supMid(k)).toBe(SUPPLEMENT_NEUTRAL);
      setSup(
        [ent('creatine'), ent('whey'), ent('caffeine', { timing: 'evening', schedule: 'daily' })],
        {
          master: false,
        },
      );
      expect(supMid(k)).toBe(SUPPLEMENT_NEUTRAL);
    }
  });

  it('a switched-off surface is neutral; the others still move', () => {
    setSup([ent('creatine')], { off: ['strength'] });
    expect(supMid('creatineStrength')).toBe(SUPPLEMENT_NEUTRAL);
    expect(supMid('creatineBodyweightKg')).toBeGreaterThan(0);
    setSup([ent('whey')], { off: ['protein'] });
    expect(supMid('proteinGrams')).toBe(SUPPLEMENT_NEUTRAL);
    expect(supplementProteinGrams()).toBe(0);
    for (const s of SUPPLEMENT_SURFACES) {
      setSup([ent('creatine'), ent('whey')], { off: [s] });
      expect(supMid('proteinGrams') === 0).toBe(s === 'protein');
    }
  });

  it('creatine: the midpoint is half the ramped high end, within the ceiling', () => {
    setSup([ent('creatine')]);
    const mid = supMid('creatineStrength', '2027-03-01');
    expect(mid).toBe(0.04);
    expect(supMid('creatineStrength')).toBeGreaterThan(0);
    expect(supMid('creatineStrength')).toBeLessThanOrEqual(0.04);
    expect(supRange('creatineStrength', '2027-03-01')).toEqual({ low: 0, high: 0.08 });
    expect(supRange('creatineStrength', '2026-08-01')).toEqual({ low: 0, high: 0 });
  });

  it('protein: the midpoint is the declared grams, on a day it counts', () => {
    setSup([ent('whey'), ent('casein', { schedule: 'trainingDays' })]);
    plan([1, 3]);
    expect(supMid('proteinGrams', '2026-10-07')).toBe(44); // Wed: planned
    expect(supMid('proteinGrams', '2026-10-08')).toBe(20); // Thu: rest
    expect(supplementProteinGrams('2026-10-07')).toBe(44);
    expect(supplementProteinGrams('2026-10-08')).toBe(20);
    expect(supplementProteinGrams()).toBe(44); // today
  });

  it('caffeine RPE: the midpoint of -0.5..-0.2, on a training day only', () => {
    setSup([ent('caffeine', { dose: 300 })]);
    plan([1, 3]);
    expect(supMid('caffeineRpe', '2026-10-07')).toBe(-0.35);
    expect(supMid('caffeineRpe', '2026-10-08')).toBe(SUPPLEMENT_NEUTRAL);
  });

  it('caffeine sleep: the number for the night ENDING at a morning moment reads the day before', () => {
    setSup([ent('caffeine', { timing: 'evening', schedule: 'daily', dose: 400 })]);
    expect(supMid('caffeineSleepMin', at(8, 7))).toBe(22.5); // Thu 07:00: the Wednesday dose
    expect(supMid('caffeineSleepMin', '2026-10-07')).toBe(22.5); // a bare day is midnight: reads the day before
    // Before the entry existed there was no dose the day before.
    setSup([ent('caffeine', { timing: 'evening', schedule: 'daily', dose: 400, startedAt: NOW })]);
    expect(supMid('caffeineSleepMin', at(7, 7))).toBe(SUPPLEMENT_NEUTRAL);
    expect(supMid('caffeineSleepMin', at(8, 7))).toBe(22.5);
  });

  it('an old state without supplements is neutral (no crash)', () => {
    const st = __getStateForTests() as { supplements?: unknown };
    const saved = st.supplements;
    st.supplements = undefined;
    try {
      expect(supMid('creatineStrength')).toBe(SUPPLEMENT_NEUTRAL);
      expect(supplementProteinGrams()).toBe(0);
      expect(supplementSafety()).toEqual([]);
    } finally {
      st.supplements = saved;
    }
  });
});

describe('supplementContext: how the app knows a training day', () => {
  it('follows the weekdays of the assigned plan (today and later)', () => {
    plan([1, 3]);
    const c = supplementContext(NOW);
    expect(c.isTrainingDay('2026-10-07')).toBe(true); // Wed, today
    expect(c.isTrainingDay('2026-10-08')).toBe(false);
    expect(c.isTrainingDay('2026-10-12')).toBe(true); // next Mon
  });

  it('a finished workout makes its day a training day even off-plan; a past planned day with none is not', () => {
    plan([1, 3]);
    __replaceStateForTests({
      ...__getStateForTests(),
      workouts: [workout(at(6, 18))], // Tuesday, finished
    });
    const c = supplementContext(NOW);
    expect(c.isTrainingDay('2026-10-06')).toBe(true);
    expect(c.isTrainingDay('2026-10-05')).toBe(false); // Monday: planned, missed
  });

  it('an unfinished (live) workout does not count; a conditioning activity does, a recovery one does not', () => {
    __replaceStateForTests({
      ...__getStateForTests(),
      workouts: [workout(at(6, 18), false)],
      activities: [
        {
          id: 'a1',
          type: 'run',
          category: 'conditioning',
          startedAt: at(5, 7),
          finishedAt: at(5, 8),
          durationMin: 60,
        },
        {
          id: 'a2',
          type: 'sauna',
          category: 'recovery',
          startedAt: at(4, 7),
          finishedAt: at(4, 8),
          durationMin: 20,
        },
      ] as never,
    });
    const c = supplementContext(NOW);
    expect(c.isTrainingDay('2026-10-06')).toBe(false);
    expect(c.isTrainingDay('2026-10-05')).toBe(true);
    expect(c.isTrainingDay('2026-10-04')).toBe(false);
  });

  it('with no plan the habit applies; with nothing at all no day is a training day', () => {
    expect(supplementContext(NOW).isTrainingDay('2026-10-14')).toBe(false);
    __replaceStateForTests({
      ...__getStateForTests(),
      workouts: [
        workout(at(5, 18)),
        workout(at(7, 18)),
        new Date(2026, 8, 28, 18).getTime(),
        new Date(2026, 8, 30, 18).getTime(),
      ].map((w) => (typeof w === 'number' ? workout(w) : w)),
    });
    const c = supplementContext(NOW);
    expect(c.isTrainingDay('2026-10-12')).toBe(true); // Mondays: 28 Sep and 5 Oct
    expect(c.isTrainingDay('2026-10-14')).toBe(true); // Wednesdays: 30 Sep and 7 Oct
    expect(c.isTrainingDay('2026-10-13')).toBe(false);
    expect(c.usualTrainingStartMin).toBe(18 * 60);
  });

  it('carries the latest body weight; unknown when there is none', () => {
    expect(supplementContext(NOW).bodyWeightKg).toBeNull();
    __replaceStateForTests({
      ...__getStateForTests(),
      bodyMetrics: {
        weights: [
          { id: 'x', at: 1, weight: 80 },
          { id: 'y', at: 2, weight: 78.5 },
        ],
      } as never,
    });
    expect(supplementContext(NOW).bodyWeightKg).toBe(78.5);
  });

  it('safety reads the body weight: 300 mg at 70 kg is above 3 mg/kg', () => {
    setSup([ent('caffeine', { dose: 300 })]);
    expect(supplementSafety().map((w) => w.key)).not.toContain('caffeineSingleDose');
    __replaceStateForTests({
      ...__getStateForTests(),
      bodyMetrics: { weights: [{ id: 'x', at: 1, weight: 70 }] } as never,
    });
    expect(supplementSafety().map((w) => w.key)).toContain('caffeineSingleDose');
  });
});
