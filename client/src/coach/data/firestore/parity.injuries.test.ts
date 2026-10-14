/**
 * The trainer reads the injuries a member shares (injury consent `full`): opened on the TRAINER's device with the member's
 * grant, shown read-only; below `full` nothing is readable. Also the streak of weeks the real adapter now fills.
 * Real adapters on both sides over one shared store (see parity/harness.ts).
 */
import { describe, expect, it } from 'vitest';
import { sealDoc } from '../../../encryptedDoc';
import { C, NOW } from './parity/harness';
import { linkUp, type World } from './parity/flow';
import type { Workout } from '../../../types';

const DAY = 86_400_000;
const ac = () => ({ signal: new AbortController().signal });

const injury = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  reason: 'injury',
  bodyPart: 'knee',
  side: 'right',
  muscles: ['quads'],
  stage: 'rebuild',
  startDay: 20_000,
  createdAt: NOW - 30 * DAY,
  updatedAt: NOW - DAY,
  checkins: [],
  note: 'Clicks on the way down',
  healedDay: null,
  ...over,
});
const seedInjuries = async (w: World, ...list: ReturnType<typeof injury>[]) => {
  const m = w.cl.vault.materialOrNull()!;
  for (const x of list)
    await w.cl.fs.set(
      `users/${C}/injuries/${x.id}`,
      (await sealDoc('injuries', x as never, m.key, m.salt)) as never,
    );
};
const workoutAt = (id: string, startedAt: number): Workout =>
  ({
    id,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    autoFinished: false,
    gymId: null,
    exercises: [],
    stats: { volumeKg: 100, sets: 1 },
  }) as unknown as Workout;
const seedWorkouts = async (w: World, ...ws: Workout[]) => {
  const m = w.cl.vault.materialOrNull()!;
  for (const x of ws)
    await w.cl.fs.set(
      `users/${C}/workouts/${x.id}`,
      (await sealDoc('workouts', x as never, m.key, m.salt)) as never,
    );
};

describe('the trainer reads shared injuries', () => {
  it('injury `full`: the list is opened on the trainer device, active before healed, note included', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full', injury: 'full' });
    await seedInjuries(
      w,
      injury('i1'),
      injury('i2', { bodyPart: 'shoulder', side: 'left', healedDay: 20_100, note: undefined }),
    );
    const data = await w.tr.world.load(ac());
    const me = data.clients.find((c) => c.id === C)!;
    expect(me.injuries?.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(me.injuries?.[0]).toMatchObject({
      bodyPart: 'knee',
      side: 'right',
      stage: 'rebuild',
      healed: false,
      note: 'Clicks on the way down',
    });
    expect(me.injuries?.[1].healed).toBe(true);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('injury `effects` or `off`: nothing is readable (no document is ever published below full)', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full', injury: 'effects' });
    await seedInjuries(w, injury('i1'));
    const me = (await w.tr.world.load(ac())).clients.find((c) => c.id === C)!;
    expect(me.injuries).toBeUndefined();
    const off = await linkUp({ totals: 'full', sets: 'full' });
    await seedInjuries(off, injury('i1'));
    expect(
      (await off.tr.world.load(ac())).clients.find((c) => c.id === C)!.injuries,
    ).toBeUndefined();
  });

  it('the streak counts consecutive weeks with a session (totals full)', async () => {
    const w = await linkUp({ totals: 'full', sets: 'off' });
    const now = w.tr.fs.now();
    await seedWorkouts(
      w,
      workoutAt('a', now - 1 * DAY),
      workoutAt('b', now - 8 * DAY),
      workoutAt('c', now - 15 * DAY),
    );
    const me = (await w.tr.world.load(ac())).clients.find((c) => c.id === C)!;
    expect(me.streakWeeks).toBeGreaterThanOrEqual(2);
  });
});

describe('the trainer sees logged vs prescribed (history from the shared sets)', () => {
  const planned = (id: string, at: number): Workout =>
    ({
      id,
      startedAt: at,
      finishedAt: at + 3_600_000,
      autoFinished: false,
      gymId: null,
      dayName: 'Upper A',
      exercises: [
        {
          id: 'e1',
          name: 'Barbell Bench Press',
          kind: 'strength',
          position: 0,
          plannedSets: 4,
          plannedReps: 8,
          sets: [
            { id: 's1', position: 0, reps: 8, weight: 80, isWarmup: false },
            { id: 's2', position: 1, reps: 8, weight: 80, isWarmup: false },
            { id: 's3', position: 2, reps: 6, weight: 80, isWarmup: false, rpe: 9 },
          ],
        },
        {
          id: 'e2',
          name: 'Cable Row',
          kind: 'strength',
          position: 1,
          sets: [{ id: 's4', position: 0, reps: 10, weight: 50, isWarmup: false }],
        },
      ],
    }) as unknown as Workout;

  it('sets `full`: sessions, tonnage of working sets, the plan comparison per exercise and as a percentage', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full' });
    await seedWorkouts(w, planned('w1', w.tr.fs.now() - 2 * DAY));
    const data = await w.tr.world.load(ac());
    const h = data.history?.[C];
    expect(h?.workouts?.entries).toHaveLength(1);
    const e = h!.workouts!.entries[0];
    expect(e).toMatchObject({
      title: 'Upper A',
      sets: 4,
      tonnageKg: 80 * 8 + 80 * 8 + 80 * 6 + 500,
    });
    expect(e.compliance).toBe(75); // 3 of the 4 prescribed sets (the unplanned row does not count)
    expect(e.exercises?.[0].prescribed).toEqual({ sets: 4, reps: 8 });
    expect(e.exercises?.[1].prescribed).toBeUndefined();
    expect(h!.lifts.map((l) => l.name)).toContain('Barbell Bench Press');
    expect(h!.lifts[0].target.kg).toBeGreaterThan(0);
    expect(h!.workouts!.exercises[0].sessions[0].top).toBe('80x8');
  });

  it('below sets `full` the trainer gets no history', async () => {
    const w = await linkUp({ totals: 'full', sets: 'effects' });
    await seedWorkouts(w, planned('w1', w.tr.fs.now() - 2 * DAY));
    expect((await w.tr.world.load(ac())).history?.[C]).toBeUndefined();
  });
});
