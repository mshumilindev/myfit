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
  mergeServerSleepsWithLocal,
  setVolumeKg,
  autoWarmupSets,
  WARMUP_FRAC,
  setTypeOf,
  startWorkout,
  startActivity,
  finishWorkout,
  finishActivity,
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

describe('mergeServerSleepsWithLocal', () => {
  const night = (over: Partial<SleepNight>): SleepNight => ({
    id: 'n',
    date: 'd',
    bedtime: 1000,
    wake: 2000,
    source: 'live',
    updatedAt: 1,
    ...over,
  });

  it("keeps a live night's local pause state over the server copy", () => {
    const server = [night({ id: 'x', wake: null, awakeMs: 0 })];
    const local = [night({ id: 'x', wake: null, awakeMs: 5000, awakeSince: 1234, lastSeen: 1500 })];
    const [m] = mergeServerSleepsWithLocal(server, local);
    expect(m.awakeSince).toBe(1234); // local live state preserved
    expect(m.awakeMs).toBe(5000);
  });

  it('adopts a server-finalized night over a local still-open one (auto-end)', () => {
    const server = [night({ id: 'x', wake: 9999, source: 'auto', updatedAt: 5 })];
    const local = [night({ id: 'x', wake: null, awakeSince: 1234 })];
    const [m] = mergeServerSleepsWithLocal(server, local);
    expect(m.wake).toBe(9999);
    expect(m.awakeSince).toBeUndefined();
  });

  it('keeps a newer local edit (last-write-wins)', () => {
    const server = [night({ id: 'x', quality: 'ok', updatedAt: 1 })];
    const local = [night({ id: 'x', quality: 'good', updatedAt: 9 })];
    expect(mergeServerSleepsWithLocal(server, local)[0].quality).toBe('good');
  });

  it('keeps a local night the server has not seen yet', () => {
    const merged = mergeServerSleepsWithLocal([], [night({ id: 'pending' })]);
    expect(merged.map((n) => n.id)).toContain('pending');
  });
});

describe('setVolumeKg counts warm-ups', () => {
  it('includes a warm-up set in tonnage', () => {
    expect(setVolumeKg(set({ weight: 60, reps: 10, isWarmup: true, type: 'warmup' }))).toBe(600);
  });
  it('matches a working set of the same load', () => {
    const warm = setVolumeKg(set({ weight: 50, reps: 8, isWarmup: true, type: 'warmup' }));
    const work = setVolumeKg(set({ weight: 50, reps: 8 }));
    expect(warm).toBe(work);
  });
});

describe('autoWarmupSets', () => {
  const S = (over: Partial<SetEntry> & { position: number }): SetEntry => set({ reps: 5, ...over });

  it('tags leading light sets and stops at the first working set', () => {
    // Top set 100 → threshold 85. 40 and 60 are warm-ups; 100 and a later 90 work.
    const sets = [
      S({ position: 0, weight: 40 }),
      S({ position: 1, weight: 60 }),
      S({ position: 2, weight: 100 }),
      S({ position: 3, weight: 90 }),
    ];
    const out = autoWarmupSets(sets, 'weight');
    expect(out.map(setTypeOf)).toEqual(['warmup', 'warmup', 'working', 'working']);
  });

  it('does not warm-up a light set that comes after a working set (fatigue drop)', () => {
    const sets = [
      S({ position: 0, weight: 100 }), // working (the top)
      S({ position: 1, weight: 40 }), // light, but after working → stays working
    ];
    expect(autoWarmupSets(sets, 'weight').map(setTypeOf)).toEqual(['working', 'working']);
  });

  it('respects a manual choice', () => {
    const sets = [
      S({ position: 0, weight: 40, warmupManual: true, type: 'working', isWarmup: false }),
      S({ position: 1, weight: 100 }),
    ];
    // The manual light "working" set anchors — nothing is auto-warmed.
    expect(setTypeOf(autoWarmupSets(sets, 'weight')[0])).toBe('working');
  });

  it('leaves special set types alone', () => {
    const sets = [
      S({ position: 0, weight: 40, type: 'drop', drops: [{ reps: 5, weight: 30 }] }),
      S({ position: 1, weight: 100 }),
    ];
    expect(setTypeOf(autoWarmupSets(sets, 'weight')[0])).toBe('drop');
  });

  it('is a no-op for non-weight load (assist / band / bodyweight)', () => {
    const sets = [S({ position: 0, weight: 10 }), S({ position: 1, weight: 100 })];
    expect(autoWarmupSets(sets, 'assist')).toBe(sets);
  });

  it('uses an 85% reference by default', () => {
    expect(WARMUP_FRAC).toBe(0.85);
  });
});

describe('one live mode at a time (mutual exclusion)', () => {
  const liveWorkoutId = () => {
    const raw = localStorage.getItem('spotter.state');
    const list = raw ? (JSON.parse(raw) as Array<{ id: string; finishedAt: number | null }>) : [];
    return list.find((w) => w.finishedAt === null)?.id;
  };
  const liveActivityId = () => {
    const raw = localStorage.getItem('spotter.activities');
    const list = raw ? (JSON.parse(raw) as Array<{ id: string; finishedAt: number | null }>) : [];
    return list.find((a) => a.finishedAt === null)?.id;
  };
  const cleanup = () => {
    cancelSleep();
    const w = liveWorkoutId();
    if (w) finishWorkout(w);
    const a = liveActivityId();
    if (a) finishActivity(a);
  };

  it('a live workout blocks starting an activity or a sleep', () => {
    cleanup();
    const w = startWorkout(null);
    expect(w).not.toBeNull();
    expect(startActivity('run', 'conditioning')).toBeNull();
    expect(startSleep()).toBeNull();
    cleanup();
  });

  it('a live activity blocks starting a workout or a sleep', () => {
    cleanup();
    const a = startActivity('run', 'conditioning');
    expect(a).not.toBeNull();
    expect(startWorkout(null)).toBeNull();
    expect(startSleep()).toBeNull();
    cleanup();
  });

  it('a live sleep blocks starting a workout or an activity', () => {
    cleanup();
    const n = startSleep();
    expect(n).not.toBeNull();
    expect(startWorkout(null)).toBeNull();
    expect(startActivity('run', 'conditioning')).toBeNull();
    cleanup();
  });
});
