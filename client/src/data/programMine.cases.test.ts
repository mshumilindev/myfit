import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Play } from '../playbook';
import type { ProgramAssignment, ProgramItem } from './programMine';

const m = vi.hoisted(() => ({
  getDoc: vi.fn(),
  callFn: vi.fn(),
  offlineSet: vi.fn(),
  offlineRemove: vi.fn(),
  offlineDedupe: vi.fn(),
  offlineHydrate: vi.fn(),
  openActivities: vi.fn(),
  startWorkout: vi.fn(),
  addExercise: vi.fn(),
  nicMid: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: m.getDoc,
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../api', () => ({ callFn: m.callFn }));
vi.mock('../offline/offlineCache', () => ({
  offlineSet: m.offlineSet,
  offlineRemove: m.offlineRemove,
  offlineDedupe: m.offlineDedupe,
  offlineHydrate: m.offlineHydrate,
}));
vi.mock('../views/programs/activitiesVault', () => ({ openActivities: m.openActivities }));
vi.mock('../store', () => ({ startWorkout: m.startWorkout, addExercise: m.addExercise }));
vi.mock('../nicotineApply', () => ({ nicMid: m.nicMid }));

const BENCH = 'Barbell Bench Press - Medium Grip';
const SQUAT = 'Barbell Full Squat';

function item(over: Partial<ProgramItem> = {}): ProgramItem {
  return {
    id: 'i1',
    day: 1,
    position: 0,
    name: BENCH,
    kind: 'strength',
    sets: 3,
    reps: 8,
    durationMin: null,
    equipment: ['barbell'],
    ...over,
  };
}

function assignment(
  over: Partial<ProgramAssignment['program']> = {},
  id = 'p1',
): ProgramAssignment {
  return {
    program: {
      id,
      name: 'Prog',
      weeks: 8,
      daysPerWeek: 3,
      items: [],
      ...over,
    },
    assignedBy: null,
    week: 1,
    done: 0,
    total: 0,
    expectedSoFar: 0,
    adherence: null,
  };
}

const snap = (status?: string, exists = true) => ({
  exists: () => exists,
  data: () => (status === undefined ? {} : { status }),
});

async function load(seed?: ProgramAssignment | null) {
  vi.resetModules();
  if (seed !== undefined) {
    const mem = await import('./programMemory');
    mem.setProgramMemory(seed);
  }
  return import('./programMine');
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.getDoc.mockResolvedValue(snap('active'));
  m.callFn.mockResolvedValue({ assignment: null });
  m.offlineDedupe.mockImplementation((_k: string, run: () => Promise<unknown>) => run());
  m.offlineHydrate.mockResolvedValue(false);
  m.openActivities.mockImplementation(async (p: unknown) => p);
  m.nicMid.mockReturnValue(0);
  m.startWorkout.mockReturnValue({ id: 'w1' });
});

describe('program day helpers', () => {
  it('programDayItems filters by day and orders by position without touching the source', async () => {
    const p = await load();
    const a = assignment({
      items: [
        item({ id: 'c', day: 2, position: 2 }),
        item({ id: 'a', day: 2, position: 0 }),
        item({ id: 'x', day: 3, position: 0 }),
        item({ id: 'b', day: 2, position: 1 }),
      ],
    });
    expect(p.programDayItems(a, 2).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(p.programDayItems(a, 5)).toEqual([]);
    expect(a.program.items.map((i) => i.id)).toEqual(['c', 'a', 'x', 'b']);
  });

  it('programDayMuscles reads targetMuscles by stringified day, defaulting to none', async () => {
    const p = await load();
    const a = assignment({ targetMuscles: { '2': ['chest', 'triceps'] } });
    expect(p.programDayMuscles(a, 2)).toEqual(['chest', 'triceps']);
    expect(p.programDayMuscles(a, 3)).toEqual([]);
    expect(p.programDayMuscles(assignment(), 1)).toEqual([]);
  });

  it('programDayHasPlan is true for lifts OR target muscles, false for a rest day', async () => {
    const p = await load();
    const a = assignment({ items: [item({ day: 1 })], targetMuscles: { '3': ['quads'] } });
    expect(p.programDayHasPlan(a, 1)).toBe(true);
    expect(p.programDayHasPlan(a, 3)).toBe(true);
    expect(p.programDayHasPlan(a, 2)).toBe(false);
    expect(p.programDayHasPlan(assignment({ targetMuscles: { '4': [] } }), 4)).toBe(false);
  });

  it('programDayName uses the custom name, else the fallback (including for an empty name)', async () => {
    const p = await load();
    const fb = (d: number) => `Day ${d}`;
    const a = assignment({ dayNames: { '1': 'Push', '2': '' } });
    expect(p.programDayName(a, 1, fb)).toBe('Push');
    expect(p.programDayName(a, 2, fb)).toBe('Day 2');
    expect(p.programDayName(a, 3, fb)).toBe('Day 3');
    expect(p.programDayName(assignment(), 1, fb)).toBe('Day 1');
  });

  it('programDayType picks the split with the most prescribed sets', async () => {
    const p = await load();
    const a = assignment({
      items: [
        item({ id: '1', name: BENCH, sets: 3 }),
        item({ id: '2', name: SQUAT, sets: 5, position: 1 }),
      ],
    });
    expect(p.programDayType(a, 1)).toBe('legs');
    const b = assignment({
      items: [
        item({ id: '1', name: BENCH, sets: 6 }),
        item({ id: '2', name: SQUAT, sets: 5, position: 1 }),
      ],
    });
    expect(p.programDayType(b, 1)).toBe('push');
  });

  it('programDayType keeps the first split on a tie, counts a 0-set lift as 1 and skips non-strength', async () => {
    const p = await load();
    const tie = assignment({
      items: [
        item({ id: '1', name: BENCH, sets: 4 }),
        item({ id: '2', name: SQUAT, sets: 4, position: 1 }),
      ],
    });
    expect(p.programDayType(tie, 1)).toBe('push');
    const zero = assignment({
      items: [
        item({ id: '1', name: BENCH, sets: 0 }),
        item({ id: '2', name: SQUAT, sets: 0, position: 1, kind: 'cardio' }),
      ],
    });
    expect(p.programDayType(zero, 1)).toBe('push');
  });

  it('programDayType counts a 0-set lift as exactly one set', async () => {
    const p = await load();
    const a = assignment({
      items: [
        item({ id: '1', name: SQUAT, sets: 1 }),
        item({ id: '2', name: BENCH, sets: 0, position: 1 }),
      ],
    });
    // legs 1 vs push max(1, 0) = 1 -> tie keeps the first
    expect(p.programDayType(a, 1)).toBe('legs');
    const b = assignment({
      items: [
        item({ id: '1', name: SQUAT, sets: 1 }),
        item({ id: '2', name: BENCH, sets: 2, position: 1 }),
      ],
    });
    expect(p.programDayType(b, 1)).toBe('push');
  });

  it('programDayType falls back to target muscles, then to null', async () => {
    const p = await load();
    const muscles = assignment({ targetMuscles: { '2': ['biceps', 'lats', 'chest'] } });
    expect(p.programDayType(muscles, 2)).toBe('pull');
    // unknown lift names yield no tally -> fall back to muscles
    const unknown = assignment({
      items: [item({ day: 2, name: 'Zzz invented lift' })],
      targetMuscles: { '2': ['quads'] },
    });
    expect(p.programDayType(unknown, 2)).toBe('legs');
    expect(p.programDayType(assignment(), 1)).toBeNull();
    // neck has no split
    expect(p.programDayType(assignment({ targetMuscles: { '1': ['neck'] } }), 1)).toBeNull();
  });
});

describe('startProgramDaySession', () => {
  it('returns null and adds nothing when another live mode blocks the start', async () => {
    m.startWorkout.mockReturnValue(null);
    const p = await load();
    const a = assignment({ items: [item()] });
    expect(p.startProgramDaySession(a, 1, 'Push')).toBeNull();
    expect(m.addExercise).not.toHaveBeenCalled();
  });

  it('starts with gym, day name and the day target muscles', async () => {
    const p = await load();
    const a = assignment({ targetMuscles: { '1': ['chest'] } });
    expect(p.startProgramDaySession(a, 1, 'Push', 'gym-9')).toBe('w1');
    expect(m.startWorkout).toHaveBeenCalledWith('gym-9', {
      dayName: 'Push',
      targetMuscles: ['chest'],
    });
    expect(m.addExercise).not.toHaveBeenCalled();
    p.startProgramDaySession(a, 1, 'Push');
    expect(m.startWorkout).toHaveBeenLastCalledWith(null, expect.anything());
  });

  it('pre-fills a strength item with its sets and reps and no duration', async () => {
    const p = await load();
    const a = assignment({
      items: [
        item({ id: 'z', position: 1, name: 'Second' }),
        item({
          id: 'a',
          position: 0,
          sets: 4,
          reps: 6,
          groupId: 'ss1',
          groupOrder: 1,
          equipment: ['barbell', 'body'],
        }),
        item({ id: 'other-day', day: 2 }),
      ],
    });
    p.startProgramDaySession(a, 1, 'Push');
    expect(m.addExercise).toHaveBeenCalledTimes(2);
    expect(m.addExercise).toHaveBeenNthCalledWith(1, 'w1', BENCH, 'strength', {
      plannedSets: 4,
      plannedReps: 6,
      plannedDurationMin: null,
      equipment: ['barbell', 'body'],
      planItemId: 'a',
      groupId: 'ss1',
      groupOrder: 1,
    });
    expect(m.addExercise.mock.calls[1][1]).toBe('Second');
    expect(m.addExercise.mock.calls[1][3]).toMatchObject({ groupId: null, groupOrder: null });
  });

  it('plans cardio as one set with its duration (default 10) and no reps', async () => {
    const p = await load();
    const a = assignment({
      items: [
        item({ id: 'c1', kind: 'cardio', durationMin: 25, name: 'Run' }),
        item({ id: 'c2', kind: 'cooldown', durationMin: null, name: 'Stretch', position: 1 }),
      ],
    });
    p.startProgramDaySession(a, 1, 'Cardio');
    expect(m.addExercise.mock.calls[0][3]).toMatchObject({
      plannedSets: 1,
      plannedReps: null,
      plannedDurationMin: 25,
    });
    expect(m.addExercise.mock.calls[1][3]).toMatchObject({ plannedDurationMin: 10 });
  });

  it('lengthens a generic warm-up by the nicotine shift, but not other kinds', async () => {
    m.nicMid.mockReturnValue(2.4);
    const p = await load();
    const a = assignment({
      items: [
        item({ id: 'w', kind: 'warmup', durationMin: 8, name: 'Warm-up' }),
        item({ id: 'c', kind: 'cardio', durationMin: 8, name: 'Bike', position: 1 }),
      ],
    });
    p.startProgramDaySession(a, 1, 'D');
    expect(m.nicMid).toHaveBeenCalledWith('warmupMin');
    expect(m.addExercise.mock.calls[0][3].plannedDurationMin).toBe(10);
    expect(m.addExercise.mock.calls[1][3].plannedDurationMin).toBe(8);
  });

  it('a warm-up with exercises arrives holding copies of them and has no duration', async () => {
    const p = await load();
    const warmupItems = [
      { id: 'w1', name: 'Arm circles', exerciseId: 'ex1', reps: 10, weight: 2, durationSec: 30 },
      { id: 'w2', name: 'Jog', reps: 0, weight: 0, durationSec: 0 },
    ];
    const a = assignment({ items: [item({ kind: 'warmup', durationMin: 5, warmupItems })] });
    p.startProgramDaySession(a, 1, 'D');
    const plan = m.addExercise.mock.calls[0][3];
    expect(plan.plannedDurationMin).toBeNull();
    expect(plan.warmupItems).toEqual([
      { name: 'Arm circles', exerciseId: 'ex1', reps: 10, weight: 2, durationSec: 30 },
      { name: 'Jog' },
    ]);
    expect(plan.warmupItems[0]).not.toBe(warmupItems[0]);
  });

  it('an empty warmupItems list is a generic warm-up (duration kept, no items key)', async () => {
    const p = await load();
    const a = assignment({ items: [item({ kind: 'warmup', durationMin: 6, warmupItems: [] })] });
    p.startProgramDaySession(a, 1, 'D');
    const plan = m.addExercise.mock.calls[0][3];
    expect(plan.plannedDurationMin).toBe(6);
    expect('warmupItems' in plan).toBe(false);
  });
});

describe('startPlaySession', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    id: 'p',
    name: 'Leg day',
    readout: null,
    dayType: 'legs',
    sessions: 3,
    lastTrainedAt: 0,
    exercises: [
      {
        name: SQUAT,
        kind: 'strength',
        sets: 4,
        repLow: 5,
        repHigh: 8,
        topWeight: 100,
        frequency: 1,
        staple: true,
        primary: 'quads',
        secondary: ['glutes'],
      },
      {
        name: 'Curl',
        kind: 'strength',
        sets: 3,
        repLow: 10,
        repHigh: 0,
        topWeight: null,
        frequency: 0.5,
        staple: false,
        primary: null,
        secondary: [],
      },
    ] as Play['exercises'],
    coverage: [
      { muscle: 'quads', sets: 8, primary: true },
      { muscle: 'calves', sets: 2, primary: false },
    ],
    suggestions: [],
    sampleWorkoutId: 'w0',
    weekdays: [],
    opensWithWarmup: true,
    ...over,
  });

  it('returns null when blocked', async () => {
    m.startWorkout.mockReturnValue(null);
    const p = await load();
    expect(p.startPlaySession(play(), 'Warm-up')).toBeNull();
    expect(m.addExercise).not.toHaveBeenCalled();
  });

  it('opens with the warm-up marker, then the lifts at top-of-range reps; targets are primary muscles only', async () => {
    const p = await load();
    expect(p.startPlaySession(play(), 'Warm-up', 'g1')).toBe('w1');
    expect(m.startWorkout).toHaveBeenCalledWith('g1', {
      dayName: 'Leg day',
      targetMuscles: ['quads'],
    });
    expect(m.addExercise.mock.calls[0]).toEqual(['w1', 'Warm-up', 'warmup']);
    expect(m.addExercise.mock.calls[1]).toEqual([
      'w1',
      SQUAT,
      'strength',
      { plannedSets: 4, plannedReps: 8, primaryMuscle: 'quads', secondaryMuscles: ['glutes'] },
    ]);
    // repHigh 0 falls back to repLow; no primary -> undefined
    expect(m.addExercise.mock.calls[2][3]).toEqual({
      plannedSets: 3,
      plannedReps: 10,
      primaryMuscle: undefined,
      secondaryMuscles: [],
    });
  });

  it('skips the warm-up when the play does not open with one, and an unnamed play has no day name', async () => {
    const p = await load();
    p.startPlaySession(play({ opensWithWarmup: false, name: null }), 'Warm-up');
    expect(m.addExercise.mock.calls.map((c) => c[2])).toEqual(['strength', 'strength']);
    expect(m.startWorkout.mock.calls[0][1].dayName).toBeUndefined();
  });

  it('plans null reps when a play exercise has no rep range at all', async () => {
    const p = await load();
    const pl = play();
    pl.exercises[1] = { ...pl.exercises[1], repLow: 0, repHigh: 0 };
    p.startPlaySession(pl, 'W');
    expect(m.addExercise.mock.calls[2][3].plannedReps).toBeNull();
  });
});

describe('trainer overlay and cache reads', () => {
  it('readProgramCache is null without a program and returns the in-memory one', async () => {
    expect((await load()).readProgramCache()).toBeNull();
    const a = assignment();
    expect((await load(a)).readProgramCache()).toEqual(a);
  });

  it('setProgramOverlay applies to reads, can be cleared, and does not invent a program', async () => {
    const a = assignment();
    const p = await load(a);
    p.setProgramOverlay((prog) => ({ ...prog, name: 'Coached' }));
    expect(p.readProgramCache()?.program.name).toBe('Coached');
    expect(a.program.name).toBe('Prog');
    p.setProgramOverlay(null);
    expect(p.readProgramCache()?.program.name).toBe('Prog');
    const empty = await load();
    empty.setProgramOverlay((prog) => ({ ...prog, name: 'X' }));
    expect(empty.readProgramCache()).toBeNull();
  });

  it('a mounted consumer re-renders when the overlay changes', async () => {
    m.callFn.mockReturnValue(new Promise(() => {}));
    const p = await load(assignment());
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.callFn).toHaveBeenCalled());
    act(() => p.setProgramOverlay((prog) => ({ ...prog, name: 'Overlaid' })));
    expect(result.current.assignment?.program.name).toBe('Overlaid');
  });
});

describe('useProgramMine / refreshProgramMine', () => {
  it('starts from the in-memory assignment, painting before any network answer', async () => {
    m.callFn.mockReturnValue(new Promise(() => {}));
    const p = await load(assignment({ name: 'Cached' }));
    const { result } = renderHook(() => p.useProgramMine());
    expect(result.current.assignment?.program.name).toBe('Cached');
    expect(result.current.active).toBe(true);
  });

  it('fetches the assignment, opens sealed activities in memory only and caches the stripped copy', async () => {
    const net = assignment({
      activities: [{ id: 'sealed' }] as never,
      activitiesEnc: { ct: 'x' },
    });
    m.callFn.mockResolvedValue({ assignment: net });
    m.openActivities.mockImplementation(async (prog: ProgramAssignment['program']) => ({
      ...prog,
      activities: [{ id: 'opened' }],
      activitiesEnc: undefined,
    }));
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.assignment?.program.id).toBe('p1'));
    expect(m.callFn).toHaveBeenCalledWith('programMine');
    expect(result.current.assignment?.program.activities).toEqual([{ id: 'opened' }]);
    expect(m.offlineSet).toHaveBeenCalledTimes(1);
    const [key, stored] = m.offlineSet.mock.calls[0];
    expect(key).toBe('programMine');
    expect('activities' in stored.program).toBe(false);
    expect('activitiesEnc' in stored.program).toBe(false);
    expect(stored.program.name).toBe('Prog');
    expect(p.readProgramCache()?.program.id).toBe('p1');
    expect(m.offlineDedupe.mock.calls[0][0]).toBe(p.PROGRAM_NET_KEY);
    expect(p.PROGRAM_NET_KEY).toBe('programMine.net');
  });

  it('a mount revalidates without forcing; an explicit refresh forces', async () => {
    const p = await load();
    renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.offlineDedupe).toHaveBeenCalledTimes(1));
    expect(m.offlineDedupe.mock.calls[0][2]).toEqual({ force: false });
    p.refreshProgramMine();
    expect(m.offlineDedupe.mock.calls[1][2]).toEqual({ force: true });
    p.refreshProgramMine(false);
    expect(m.offlineDedupe.mock.calls[2][2]).toEqual({ force: false });
  });

  it('an empty server answer clears the cache and the memory copy', async () => {
    const p = await load(assignment());
    m.callFn.mockResolvedValue({ assignment: null });
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.assignment).toBeNull());
    expect(m.offlineRemove).toHaveBeenCalledWith('programMine');
    expect(m.offlineSet).not.toHaveBeenCalled();
    expect(p.readProgramCache()).toBeNull();
  });

  it('keeps the cached assignment on a transient network error', async () => {
    m.callFn.mockRejectedValue(new Error('offline'));
    const p = await load(assignment({ name: 'Cached' }));
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.callFn).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.assignment?.program.name).toBe('Cached');
    expect(m.offlineRemove).not.toHaveBeenCalled();
    expect(m.offlineSet).not.toHaveBeenCalled();
  });

  it('applies the overlay to freshly fetched data', async () => {
    m.callFn.mockResolvedValue({ assignment: assignment() });
    const p = await load();
    p.setProgramOverlay((prog) => ({ ...prog, name: 'Overlaid' }));
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.assignment?.program.name).toBe('Overlaid'));
  });
});

describe('program status gate', () => {
  it('hides (active=false) a readable draft program', async () => {
    m.getDoc.mockResolvedValue(snap('draft'));
    m.callFn.mockResolvedValue({ assignment: assignment() });
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.active).toBe(false));
    expect(result.current.assignment?.program.id).toBe('p1');
  });

  it.each([
    ['active', snap('active'), true],
    ['missing document', snap(undefined, false), true],
    ['no status field', snap(undefined, true), true],
  ])('shows the program for %s', async (_label, s, expected) => {
    m.getDoc.mockResolvedValue(s);
    m.callFn.mockResolvedValue({ assignment: assignment() });
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.getDoc).toHaveBeenCalled());
    await waitFor(() => expect(result.current.assignment).not.toBeNull());
    expect(result.current.active).toBe(expected);
  });

  it('reads programs/<id> and keeps showing the program when the read fails', async () => {
    m.getDoc.mockRejectedValue(new Error('denied'));
    m.callFn.mockResolvedValue({ assignment: assignment({}, 'abc') });
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.getDoc).toHaveBeenCalled());
    expect(m.getDoc.mock.calls[0][0]).toEqual({ path: 'programs/abc' });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.active).toBe(true);
  });

  it('checks each program id once, and again when the assignment changes to another program', async () => {
    m.callFn.mockResolvedValue({ assignment: assignment({}, 'p1') });
    const p = await load();
    renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.getDoc).toHaveBeenCalledTimes(1));
    p.refreshProgramMine();
    await waitFor(() => expect(m.callFn).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    expect(m.getDoc).toHaveBeenCalledTimes(1);
    m.callFn.mockResolvedValue({ assignment: assignment({}, 'p2') });
    p.refreshProgramMine();
    await waitFor(() => expect(m.getDoc).toHaveBeenCalledTimes(2));
    expect(m.getDoc.mock.calls[1][0]).toEqual({ path: 'programs/p2' });
  });

  it('a late status answer for a replaced program is ignored', async () => {
    let resolveFirst!: (s: ReturnType<typeof snap>) => void;
    m.getDoc
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue(snap('active'));
    m.callFn
      .mockResolvedValueOnce({ assignment: assignment({}, 'p1') })
      .mockResolvedValue({ assignment: assignment({}, 'p2') });
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.getDoc).toHaveBeenCalledTimes(1));
    p.refreshProgramMine();
    await waitFor(() => expect(result.current.assignment?.program.id).toBe('p2'));
    await act(async () => {
      resolveFirst(snap('draft'));
    });
    expect(result.current.active).toBe(true);
  });

  it('clearing the assignment re-activates a previously hidden draft state', async () => {
    m.getDoc.mockResolvedValue(snap('draft'));
    m.callFn.mockResolvedValueOnce({ assignment: assignment() });
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.active).toBe(false));
    m.callFn.mockResolvedValue({ assignment: null });
    p.refreshProgramMine();
    await waitFor(() => expect(result.current.assignment).toBeNull());
    expect(result.current.active).toBe(true);
  });
});

describe('sealed snapshot hydration', () => {
  type Spec = { accept: (a: ProgramAssignment) => boolean; isLive: () => boolean };

  it('seeds memory and state from the snapshot, then verifies its status', async () => {
    const cached = assignment({ name: 'FromDisk' }, 'disk');
    m.callFn.mockReturnValue(new Promise(() => {}));
    m.offlineHydrate.mockImplementation(
      async (_k: string, apply: (a: ProgramAssignment) => void) => {
        apply(cached);
        return true;
      },
    );
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.assignment?.program.name).toBe('FromDisk'));
    expect(m.offlineHydrate.mock.calls[0][0]).toBe('programMine');
    expect(p.readProgramCache()?.program.id).toBe('disk');
    await waitFor(() => expect(m.getDoc).toHaveBeenCalledTimes(1));
  });

  it('does not overwrite live network data with an older snapshot', async () => {
    m.callFn.mockResolvedValue({ assignment: assignment({ name: 'Live' }) });
    let applyLate!: (a: ProgramAssignment) => void;
    m.offlineHydrate.mockImplementation(
      async (_k: string, apply: (a: ProgramAssignment) => void) => {
        applyLate = apply;
        return true;
      },
    );
    const p = await load();
    const { result } = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(result.current.assignment?.program.name).toBe('Live'));
    act(() => applyLate(assignment({ name: 'Stale' }, 'old')));
    expect(result.current.assignment?.program.name).toBe('Live');
  });

  it('accepts only well-formed assignments and reports liveness', async () => {
    const p = await load();
    renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.offlineHydrate).toHaveBeenCalled());
    const spec = m.offlineHydrate.mock.calls[0][2] as Spec;
    expect(spec.accept(assignment())).toBe(true);
    expect(spec.accept(null as never)).toBe(false);
    expect(spec.accept('x' as never)).toBe(false);
    expect(spec.accept({} as never)).toBe(false);
    expect(spec.accept({ program: { items: 'no' } } as never)).toBe(false);
    expect(spec.isLive()).toBe(false);
    m.callFn.mockResolvedValue({ assignment: assignment() });
    p.refreshProgramMine();
    await waitFor(() => expect(spec.isLive()).toBe(true));
  });

  it('retries hydration on the next mount after a miss but not after a hit', async () => {
    m.offlineHydrate.mockResolvedValueOnce(false).mockResolvedValue(true);
    const p = await load();
    const first = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.offlineHydrate).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    first.unmount();
    const second = renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.offlineHydrate).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    second.unmount();
    renderHook(() => p.useProgramMine());
    await waitFor(() => expect(m.callFn).toHaveBeenCalledTimes(3));
    expect(m.offlineHydrate).toHaveBeenCalledTimes(2);
  });
});
