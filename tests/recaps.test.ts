import { describe, expect, it } from 'vitest';
import type { Exercise, SetEntry, Workout } from '../client/src/types';
import { availableRecaps, buildRecap, recapRefFromId, MONTH_UNLOCK } from '../client/src/recaps';
import { EMPTY_GOALS } from '../client/src/goals';

function set(p: Partial<SetEntry> = {}): SetEntry {
  return { id: crypto.randomUUID(), reps: 5, weight: 100, isWarmup: false, position: 0, ...p };
}
function squat(weight: number): Exercise {
  return {
    id: crypto.randomUUID(),
    name: 'Squat',
    kind: 'strength',
    position: 0,
    primaryMuscle: 'quads',
    sets: [set({ weight, reps: 5 })],
  };
}
function wk(dateIso: string, weight: number): Workout {
  const t = new Date(dateIso).getTime();
  return {
    id: crypto.randomUUID(),
    startedAt: t,
    finishedAt: t + 45 * 60_000,
    autoFinished: false,
    exercises: [squat(weight)],
  };
}

describe('recaps', () => {
  // July baseline (lighter) + 8 August sessions (one heavier → a PR).
  const july = [wk('2026-07-15T10:00:00', 100)];
  const august = [
    wk('2026-08-02T10:00:00', 110),
    wk('2026-08-04T10:00:00', 110),
    wk('2026-08-09T10:00:00', 110),
    wk('2026-08-11T10:00:00', 110),
    wk('2026-08-16T10:00:00', 110),
    wk('2026-08-18T10:00:00', 110),
    wk('2026-08-23T10:00:00', 110),
    wk('2026-08-25T10:00:00', 130), // PR beats July's 100
  ];
  const workouts = [...july, ...august];
  const now = new Date('2026-09-03T12:00:00').getTime();

  it('unlocks a closed month with enough sessions', () => {
    const entries = availableRecaps(workouts, now);
    const aug = entries.find((e) => e.ref.id === '2026-M7');
    expect(aug?.status).toBe('ready');
    expect(aug?.sessions).toBe(8);
    // July had only 1 session — below the unlock threshold.
    expect(entries.find((e) => e.ref.id === '2026-M6')?.status).toBe('thin');
    expect(MONTH_UNLOCK).toBe(6);
  });

  it('computes totals, a PR, muscles and a delta vs the previous month', () => {
    const ref = recapRefFromId('2026-M7')!;
    const r = buildRecap(ref, workouts, [], EMPTY_GOALS, 80);
    expect(r.sessions).toBe(8);
    expect(r.volumeKg).toBeGreaterThan(0);
    expect(r.prCount).toBe(1);
    expect(r.records[0].name).toBe('Squat');
    expect(r.records[0].weightKg).toBe(130);
    expect(r.muscles[0].group).toBe('quads');
    expect(r.prevExists).toBe(true);
    expect(r.d.volume).not.toBeNull();
    expect(r.trend.length).toBeGreaterThanOrEqual(4);
    expect(r.trainingDays).toBe(8);
  });

  it('a first-ever period has null deltas, not a drop', () => {
    const ref = recapRefFromId('2026-M6')!; // July — nothing before it
    const r = buildRecap(ref, workouts, [], EMPTY_GOALS, 80);
    expect(r.prevExists).toBe(false);
    expect(r.d.volume).toBeNull();
    expect(r.headline).toBe('firstPeriod');
  });
});
