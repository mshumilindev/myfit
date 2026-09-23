import { describe, expect, it } from 'vitest';
import {
  CARDIO_PROFILES,
  cardioMachineOf,
  pace500Sec,
  pickCardioMachine,
  timedEntryKcal,
} from './cardio';
import { workoutCalories } from './activities';
import { EQUIPMENT_CATALOG } from './data/equipmentCatalog';
import type { Exercise, SetEntry, Workout } from './types';

const entry = (over: Partial<SetEntry>): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps: 0,
  weight: null,
  isWarmup: false,
  position: 0,
  ...over,
});
const cardio = (machine: string | null): Pick<Exercise, 'kind' | 'equipmentItems'> => ({
  kind: 'cardio',
  equipmentItems: machine ? [machine] : [],
});

describe('cardio machine profiles', () => {
  it('covers every cardio machine in the equipment catalog', () => {
    const ids = EQUIPMENT_CATALOG.filter((e) => e.category === 'cardio').map((e) => e.id);
    expect(ids.filter((id) => !(id in CARDIO_PROFILES))).toEqual([]);
  });
  it('finds the machine among other picked equipment', () => {
    expect(cardioMachineOf({ equipmentItems: ['belt', 'cardio-rower'] })).toBe('cardio-rower');
    expect(cardioMachineOf({ equipmentItems: ['belt'] })).toBeNull();
  });
});

describe('timedEntryKcal', () => {
  it('trusts kcal copied off the console over any estimate', () => {
    expect(
      timedEntryKcal(cardio('cardio-treadmill'), entry({ durationMin: 30, calories: 321 }), 80),
    ).toBe(321);
  });
  it('costs a treadmill run by speed (ACSM), and incline makes it dearer', () => {
    const flat = timedEntryKcal(
      cardio('cardio-treadmill'),
      entry({ durationMin: 30, speedKmh: 10 }),
      80,
    )!;
    // 10 km/h → 166.7 m/min → VO2 36.8 → 36.8·80·5/1000·30 ≈ 442
    expect(Math.round(flat)).toBe(442);
    const hill = timedEntryKcal(
      cardio('cardio-treadmill'),
      entry({ durationMin: 30, speedKmh: 10, inclinePct: 5 }),
      80,
    )!;
    expect(hill).toBeGreaterThan(flat);
  });
  it('derives treadmill speed from distance over time when speed is missing', () => {
    const a = timedEntryKcal(
      cardio('cardio-treadmill'),
      entry({ durationMin: 30, distanceKm: 5 }),
      80,
    );
    const b = timedEntryKcal(
      cardio('cardio-treadmill'),
      entry({ durationMin: 30, speedKmh: 10 }),
      80,
    );
    expect(a).toBeCloseTo(b!, 5);
  });
  it('costs ergometers by watts', () => {
    const easy = timedEntryKcal(
      cardio('cardio-rower'),
      entry({ durationMin: 20, watts: 100 }),
      80,
    )!;
    const hard = timedEntryKcal(
      cardio('cardio-rower'),
      entry({ durationMin: 20, watts: 200 }),
      80,
    )!;
    expect(hard).toBeGreaterThan(easy);
  });
  it('falls back to the machine MET, nudged by RPE', () => {
    const ell = timedEntryKcal(cardio('cardio-elliptical'), entry({ durationMin: 30 }), 80)!;
    const stairs = timedEntryKcal(cardio('cardio-stairclimber'), entry({ durationMin: 30 }), 80)!;
    expect(ell).toBe(5.0 * 80 * 0.5);
    expect(stairs).toBeGreaterThan(ell);
    const hard = timedEntryKcal(
      cardio('cardio-elliptical'),
      entry({ durationMin: 30, rpe: 9 }),
      80,
    )!;
    expect(hard).toBeGreaterThan(ell);
  });
  it('ignores resistance level (not comparable across brands)', () => {
    const a = timedEntryKcal(cardio('cardio-elliptical'), entry({ durationMin: 30, level: 4 }), 80);
    const b = timedEntryKcal(
      cardio('cardio-elliptical'),
      entry({ durationMin: 30, level: 14 }),
      80,
    );
    expect(a).toBe(b);
  });
  it('is null without body weight or time', () => {
    expect(timedEntryKcal(cardio(null), entry({ durationMin: 30 }), null)).toBeNull();
    expect(timedEntryKcal(cardio(null), entry({ durationMin: 0 }), 80)).toBeNull();
  });
});

describe('pace500Sec', () => {
  it('reads rower pace per 500 m', () => {
    expect(pace500Sec(entry({ durationMin: 8, distanceKm: 2 }))).toBe(120);
  });
});

describe('workoutCalories with cardio', () => {
  it('prices cardio by machine and takes its minutes off the lifting clock', () => {
    const w: Workout = {
      id: 'w',
      startedAt: 0,
      finishedAt: 30 * 60000,
      autoFinished: false,
      exercises: [
        {
          id: 'c',
          name: 'Stair climber',
          kind: 'cardio',
          position: 0,
          equipmentItems: ['cardio-stairclimber'],
          sets: [entry({ durationMin: 30 })],
        },
      ],
    };
    // The whole session was the climber: 9 MET · 80 kg · 0.5 h = 360
    expect(workoutCalories(w, 80)).toBe(360);
  });
});

describe('pickCardioMachine', () => {
  const session = (t: number, machine: string) => ({
    startedAt: t,
    exercises: [
      {
        id: 'x',
        name: 'c',
        kind: 'cardio' as const,
        position: 0,
        equipmentItems: [machine],
        sets: [entry({ durationMin: 10 })],
      },
    ],
  });
  it('prefers the machine you use most', () => {
    const hist = [
      session(1, 'cardio-rower'),
      session(2, 'cardio-rower'),
      session(3, 'cardio-elliptical'),
    ];
    expect(pickCardioMachine(hist, null)).toBe('cardio-rower');
  });
  it('only picks from the gym when the gym lists cardio machines', () => {
    const hist = [session(1, 'cardio-rower')];
    expect(pickCardioMachine(hist, ['cardio-elliptical', 'cardio-upright-bike'])).toBe(
      'cardio-upright-bike',
    );
  });
  it('defaults to a treadmill with nothing to go on', () => {
    expect(pickCardioMachine([], null)).toBe('cardio-treadmill');
  });
});
