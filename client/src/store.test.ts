import { describe, expect, it } from 'vitest';
import {
  est1rm,
  topSet,
  workoutCardioDistanceKm,
  workoutCardioMinutes,
  workoutSets,
  workoutVolumeKg,
  startSleep,
  cancelSleep,
  pauseSleep,
  resumeSleep,
  markSleepActivity,
  reconcileSleep,
  noteSleepPresence,
  updateSleepNight,
} from './store';
import { SLEEP_IDLE_MS } from './sleep';
import type { SetEntry, SleepNight, Workout } from './types';

const set = (over: Partial<SetEntry>): SetEntry => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: 0,
  ...over,
});

describe('topSet', () => {
  it('should pick the heaviest working set and ignore warm-ups', () => {
    const s = topSet([
      set({ weight: 40, isWarmup: true, position: 0 }),
      set({ weight: 80, position: 1 }),
      set({ weight: 85, reps: 8, position: 2 }),
    ]);
    expect(s?.weight).toBe(85);
  });

  it('should break weight ties by reps', () => {
    const s = topSet([
      set({ weight: 85, reps: 6, position: 0 }),
      set({ weight: 85, reps: 9, position: 1 }),
    ]);
    expect(s?.reps).toBe(9);
  });

  it('should return undefined when only warm-ups exist', () => {
    expect(topSet([set({ isWarmup: true })])).toBeUndefined();
  });
});

describe('est1rm', () => {
  it('should follow the Epley formula, rounded', () => {
    expect(est1rm(90, 8)).toBe(114);
    expect(est1rm(100, 1)).toBe(103);
    expect(est1rm(85, 8)).toBe(108);
  });
});

describe('workout aggregates', () => {
  const w: Workout = {
    id: 'w1',
    startedAt: 0,
    finishedAt: 1000,
    autoFinished: false,
    exercises: [
      {
        id: 'e1',
        name: 'Back Squat',
        position: 0,
        sets: [set({ reps: 12, weight: 40 }), set({ reps: 8, weight: 80, position: 1 })],
      },
      {
        id: 'e2',
        name: 'RDL',
        position: 1,
        sets: [set({ reps: 10, weight: 70 })],
      },
      {
        id: 'e3',
        name: 'Bike',
        kind: 'cardio',
        position: 2,
        sets: [
          set({
            reps: 0,
            weight: null,
            durationMin: 20,
            distanceKm: 6.2,
            calories: 160,
          }),
        ],
      },
    ],
  };

  it('should count sets across exercises', () => {
    expect(workoutSets(w)).toBe(3);
  });

  it('should sum strength volume as Σ reps × weight (warm-ups included)', () => {
    expect(workoutVolumeKg(w)).toBe(12 * 40 + 8 * 80 + 10 * 70);
  });

  it('should sum timed exercise cardio metrics separately', () => {
    expect(workoutCardioMinutes(w)).toBe(20);
    expect(workoutCardioDistanceKm(w)).toBe(6.2);
  });
});

describe('sleep pause flow (store)', () => {
  const MIN = 60000;
  const readLive = (): SleepNight | null => {
    const raw = localStorage.getItem('spotter.sleeps');
    const list: SleepNight[] = raw ? JSON.parse(raw) : [];
    return list.find((n) => n.wake === null) ?? null;
  };
  const fresh = (bedtime: number) => {
    cancelSleep();
    startSleep(bedtime);
  };

  it('banks the browsing gap on pause → resume', () => {
    const t = Date.now();
    fresh(t - 180 * MIN);
    pauseSleep(t - 20 * MIN);
    resumeSleep(t); // browsed for 20 min
    const n = readLive()!;
    expect(n.awakeSince == null).toBe(true);
    expect(n.awakeMs).toBe(20 * MIN);
  });

  it('reconcile after idle banks only up to the last activity', () => {
    const t = Date.now();
    fresh(t - 180 * MIN);
    pauseSleep(t - 30 * MIN);
    updateSleepNight(readLive()!.id, { lastSeen: t - 20 * MIN }); // idle since 20 min ago
    reconcileSleep(t);
    const n = readLive()!;
    expect(n.awakeSince == null).toBe(true); // back to counting
    expect(n.awakeMs).toBe(10 * MIN); // only awakeSince→lastSeen counts as awake
  });

  it('does not reconcile while still active', () => {
    const t = Date.now();
    fresh(t - 180 * MIN);
    pauseSleep(t - 10 * MIN);
    updateSleepNight(readLive()!.id, { lastSeen: t - 1 * MIN }); // active a minute ago
    reconcileSleep(t);
    expect(readLive()!.awakeSince).not.toBeNull(); // still paused
  });

  it('reopen after a long absence banks the idle gap and re-pauses', () => {
    const t = Date.now();
    fresh(t - 180 * MIN);
    // Paused, last active 40 min ago; app was closed; now the user reopens.
    pauseSleep(t - 45 * MIN);
    updateSleepNight(readLive()!.id, { lastSeen: t - 40 * MIN });
    markSleepActivity(t);
    const n = readLive()!;
    // The 5 active minutes (45→40 ago) are awake; the 40-min absence is sleep.
    expect(n.awakeMs).toBe(5 * MIN);
    // A fresh awake interval opens from now (they're using the app again).
    expect(n.awakeSince).toBe(t);
  });

  it('noteSleepPresence pauses off-screen and resumes on the sleep screen', () => {
    const t = Date.now();
    fresh(t - 60 * MIN);
    noteSleepPresence(false, t - 12 * MIN); // left the screen
    expect(readLive()!.awakeSince).toBe(t - 12 * MIN);
    noteSleepPresence(true, t); // came back
    const n = readLive()!;
    expect(n.awakeSince == null).toBe(true);
    expect(n.awakeMs).toBe(12 * MIN);
    cancelSleep();
  });

  it('exposes the idle threshold as five minutes', () => {
    expect(SLEEP_IDLE_MS).toBe(5 * MIN);
  });
});
