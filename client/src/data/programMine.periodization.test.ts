import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramAssignment, ProgramItem } from './programMine';

const m = vi.hoisted(() => ({ startWorkout: vi.fn(), addExercise: vi.fn(), on: false }));
// The store is mocked below, so the gate is too: the module is "installed" while `m.on` is true.
vi.mock('../addons/featureGates', () => ({ periodizationAvailable: () => m.on }));
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: vi.fn() }));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../api', () => ({ callFn: vi.fn() }));
vi.mock('../offline/offlineCache', () => ({
  offlineSet: vi.fn(),
  offlineRemove: vi.fn(),
  offlineDedupe: vi.fn(),
  offlineHydrate: vi.fn(async () => false),
}));
vi.mock('../views/programs/activitiesVault', () => ({ openActivities: async (p: unknown) => p }));
vi.mock('../store', () => ({ startWorkout: m.startWorkout, addExercise: m.addExercise }));
vi.mock('../nicotineApply', () => ({ nicMid: () => 0 }));

import { periodizationHost } from '../periodizationApi';
import { activeWeekPlan, loadKg, repsLabel, repsMinOf } from '../periodization/cycle';
import { programDayItems, startProgramDaySession } from './programMine';

const row = (over: Partial<ProgramItem> = {}): ProgramItem => ({
  id: 'i1',
  day: 1,
  position: 0,
  name: 'Barbell Full Squat',
  kind: 'strength',
  sets: 3,
  reps: 8,
  durationMin: null,
  equipment: ['barbell'],
  ...over,
});

const assignment = (week: number): ProgramAssignment =>
  ({
    program: {
      id: 'p',
      name: 'P',
      weeks: 8,
      daysPerWeek: 3,
      items: [
        row({ id: 'w1', targetPct: 85, repsMin: 6 }),
        row({ id: 'w1b', name: 'Plank', day: 2 }),
      ],
      cycle: {
        length: 2,
        weeks: [
          {
            label: 'deload',
            dayNames: {},
            targetMuscles: {},
            items: [row({ id: 'w2', targetPct: 60, repsMin: 6 })],
          },
        ],
      },
    },
    assignedBy: null,
    week,
    done: 0,
    total: 0,
    expectedSoFar: 0,
    adherence: null,
  }) as unknown as ProgramAssignment;

/** What the Periodization chunk fills in when it loads. */
const loadChunk = (max: number | null) => {
  periodizationHost.weekPlan = activeWeekPlan;
  periodizationHost.load = loadKg;
  periodizationHost.repsLabel = repsLabel;
  periodizationHost.repsMin = repsMinOf;
  periodizationHost.maxFor = () => max;
};

beforeEach(() => {
  m.startWorkout.mockReset().mockReturnValue({ id: 'w' });
  m.addExercise.mockReset();
  m.on = false;
});
afterEach(() => {
  m.on = false;
  for (const k of Object.keys(periodizationHost) as (keyof typeof periodizationHost)[])
    (periodizationHost as unknown as Record<string, unknown>)[k] = null;
});

const firstPlan = () => m.addExercise.mock.calls[0]?.[3] as Record<string, unknown>;

describe('starting a program day with Periodization off (the default)', () => {
  it('asks for nothing of the cycle or the percent, even if the chunk was loaded earlier', () => {
    loadChunk(140);
    startProgramDaySession(assignment(2), 1, 'Day', null);
    const plan = firstPlan();
    expect(plan).not.toHaveProperty('plannedPct');
    expect(plan).not.toHaveProperty('plannedKg');
    expect(plan).not.toHaveProperty('plannedRepsMin');
    expect(m.addExercise.mock.calls[0]?.[3]?.planItemId).toBe('w1');
  });
});

describe('starting a program day with Periodization on', () => {
  beforeEach(() => {
    m.on = true;
  });

  it('turns the percent into kilograms against the max, on the 2.5 step', () => {
    loadChunk(140);
    startProgramDaySession(assignment(1), 1, 'Day', null);
    expect(firstPlan()).toMatchObject({
      plannedPct: 85,
      plannedKg: 120,
      plannedRepsMin: 6,
      plannedReps: 8,
    });
  });
  it('keeps the percent without kilograms when there is no max yet', () => {
    loadChunk(null);
    startProgramDaySession(assignment(1), 1, 'Day', null);
    const plan = firstPlan();
    expect(plan).toMatchObject({ plannedPct: 85 });
    expect(plan).not.toHaveProperty('plannedKg');
  });
  it("trains the cycle week's own rows in week 2", () => {
    loadChunk(140);
    expect(programDayItems(assignment(2), 1).map((i) => i.id)).toEqual(['w2']);
    startProgramDaySession(assignment(2), 1, 'Day', null);
    expect(firstPlan()).toMatchObject({ planItemId: 'w2', plannedPct: 60, plannedKg: 85 });
  });
  it('does not ask the chunk yet while it is loading: plain kilograms, the program week', () => {
    startProgramDaySession(assignment(2), 1, 'Day', null);
    expect(firstPlan()).toMatchObject({ planItemId: 'w1' });
    expect(firstPlan()).not.toHaveProperty('plannedPct');
  });
});
