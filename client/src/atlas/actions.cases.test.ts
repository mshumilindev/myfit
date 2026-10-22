import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boundaries only: Firestore, the uid and the vault key. The real store and runAction run.
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
  callFn: vi.fn(async () => {
    throw new Error('offline');
  }),
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => ({ union: a }),
    arrayRemove: (...a: unknown[]) => ({ remove: a }),
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async () => undefined),
    setDoc: vi.fn(async () => undefined),
    onSnapshot: () => () => undefined,
  };
});
vi.mock('../vaultIO', async (orig) => {
  const real = await orig<typeof import('../vaultIO')>();
  const { readyVault } = await import('../testVault');
  const v = await readyVault();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from '../store';
import { runAction } from './actions';
import { richCtx } from './testCtx';
import type { Tr, AtlasAction } from './intentKit';

const T0 = new Date(2026, 9, 7, 15, 30).getTime(); // Wed 7 Oct 2026, local
const DAY = 86_400_000;
const en: Tr = (e) => e;
const uk: Tr = (_e, u) => u;
const fmtEx = (n: string) => `«${n}»`;
const st = () => store.__getStateForTests();
const run = (a: AtlasAction, L = en) => runAction(a, st(), T0, L, fmtEx);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  store.resetLocalData();
});
afterEach(() => {
  vi.useRealTimers();
  store.resetLocalData();
});

describe('runAction: settings', () => {
  it('temper sets the temper and answers in the chosen language', () => {
    expect(run({ type: 'temper', temper: 5 })).toEqual({ text: 'Done. Better?' });
    expect(st().coach.temper).toBe(5);
    expect(run({ type: 'temper', temper: 1 }, uk).text).toBe('Готово. Так краще?');
    expect(st().coach.temper).toBe(1);
  });
  it('mute lasts until local midnight tonight', () => {
    run({ type: 'mute' });
    expect(st().coach.mutedUntil).toBe(new Date(2026, 9, 8, 0, 0, 0, 0).getTime());
  });
  it('rest stores the per-exercise rest and says it as m:ss', () => {
    const r = run({ type: 'rest', exercise: 'Squat', sec: 125 });
    expect(r.text).toBe('Done — «Squat» rest is 2:05.');
    expect(st().exerciseRest.squat).toBe(125);
    expect(run({ type: 'rest', exercise: 'Squat', sec: 60 }).text).toBe(
      'Done — «Squat» rest is 1:00.',
    );
    expect(run({ type: 'rest', exercise: 'Squat', sec: 45 }, uk).text).toBe(
      'Готово — відпочинок для «Squat» 0:45.',
    );
  });
});

describe('runAction: memory', () => {
  it('avoid adds the exercise once to the avoid list', () => {
    run({ type: 'avoid', exercise: 'Lunge' });
    run({ type: 'avoid', exercise: 'Lunge' });
    run({ type: 'avoid', exercise: 'Deadlift' });
    expect(st().coach.memory?.avoid).toEqual(['Lunge', 'Deadlift']);
    expect(run({ type: 'avoid', exercise: 'Lunge' }).text).toBe(
      'Done — no more «Lunge» in your plans.',
    );
  });
  it('swap replaces an earlier swap for the same source lift', () => {
    run({ type: 'swap', from: 'Squat', to: 'Leg Press' });
    run({ type: 'swap', from: 'Row', to: 'Pulldown' });
    const r = run({ type: 'swap', from: 'Squat', to: 'Hack Squat' });
    expect(r.text).toBe('Done — «Hack Squat» instead of «Squat» from now on.');
    expect(st().coach.memory?.prefer).toEqual([
      { from: 'Row', to: 'Pulldown' },
      { from: 'Squat', to: 'Hack Squat' },
    ]);
  });
  it('forget wipes the memory', () => {
    run({ type: 'avoid', exercise: 'Lunge' });
    const r = run({ type: 'forget' });
    expect(st().coach.memory).toEqual({});
    expect(r.text).toBe('Forgotten. Clean slate — your log stays.');
  });
});

describe('runAction: plan', () => {
  it('writes a programme and remembers the days and minutes', () => {
    const r = run({ type: 'plan', days: 3, lengthMin: 50 });
    expect(r.text).toMatch(/^Done — 3 days a week, ~50 min\./);
    expect(st().coach.plan).toBeTruthy();
    expect(st().coach.memory?.days).toMatchObject({ v: 3, at: T0 });
    expect(st().coach.memory?.minutes).toMatchObject({ v: 50, at: T0 });
  });
  it('speaks Ukrainian when asked', () => {
    expect(run({ type: 'plan', days: 4, lengthMin: 60 }, uk).text).toMatch(
      /^Готово — 4 дн\. на тиждень, ~60 хв\./,
    );
  });
});

describe('runAction: with a training history', () => {
  const history = richCtx('en').s.workouts;
  const withHistory = () => ({ ...st(), workouts: history });

  it('plan with a history writes the requested number of training days', () => {
    store.setCoach({ enabled: true, role: 'main' });
    runAction({ type: 'plan', days: 3, lengthMin: 60 }, withHistory(), T0, en, fmtEx);
    expect(st().coach.plan!.days.length).toBe(3);
    expect(st().coach.plan!.days.every((d) => d.weekday >= 0 && d.weekday <= 6)).toBe(true);
  });
  it('start on a planned day builds the day from the history and opens it', () => {
    store.setCoach({ enabled: true, role: 'main' });
    runAction({ type: 'plan', days: 7, lengthMin: 60 }, withHistory(), T0, en, fmtEx);
    const r = runAction({ type: 'start' }, withHistory(), T0, en, fmtEx);
    expect(r.text).toBe('Go. I’m watching.');
    const w = st().workouts.find((x) => x.id === r.openWorkoutId)!;
    expect(w.finishedAt).toBeNull();
    expect(w.exercises.length).toBeGreaterThan(0);
  });
});

describe('runAction: moveDay', () => {
  it('says there is nothing to change without a programme', () => {
    expect(run({ type: 'moveDay', from: 1, to: 3 }).text).toBe('No programme to change.');
    expect(run({ type: 'moveDay', from: 1, to: 3 }, uk).text).toBe('Нема програми, щоб змінювати.');
  });
  it('swaps two training weekdays and keeps the days in week order (Mon first)', () => {
    const days = [1, 3, 5].map((weekday) => ({ weekday, name: `D${weekday}` }));
    store.setCoach({ plan: { days } as never });
    const r = run({ type: 'moveDay', from: 1, to: 0 });
    expect(r.text).toBe('Done — the programme is updated.');
    // Monday (1) -> Sunday (0); Sunday sorts last in a Monday-first week.
    expect(st().coach.plan!.days.map((d) => [d.weekday, d.name])).toEqual([
      [3, 'D3'],
      [5, 'D5'],
      [0, 'D1'],
    ]);
  });
  it('moving onto a day that is already used swaps the two', () => {
    store.setCoach({
      plan: {
        days: [
          { weekday: 1, name: 'A' },
          { weekday: 4, name: 'B' },
        ],
      } as never,
    });
    run({ type: 'moveDay', from: 1, to: 4 });
    expect(st().coach.plan!.days.map((d) => [d.weekday, d.name])).toEqual([
      [1, 'B'],
      [4, 'A'],
    ]);
  });
});

describe('runAction: health and body', () => {
  it('bodyweight logs a weigh-in at now', () => {
    const r = run({ type: 'bodyweight', kg: 81.5 });
    expect(r.text).toBe('Logged 81.5 kg.');
    expect(store.latestWeight(st().bodyMetrics)).toMatchObject({ weight: 81.5, at: T0 });
    expect(run({ type: 'bodyweight', kg: 80 }, uk).text).toBe('Записав 80 кг.');
  });
  it('pause rests N days starting today, inclusive', () => {
    const r = run({ type: 'pause', days: 3 });
    expect(r.text).toMatch(/^Done — plan paused for 3 days/);
    const today = store.dayKey(T0);
    expect(st().restPeriods[0]).toMatchObject({
      mode: 'off',
      startDay: today,
      endDay: today + 2,
      note: 'Atlas',
    });
  });
  it('illness opens an open-ended sick period for today', () => {
    const r = run({ type: 'illness' });
    expect(r.text).toMatch(/^Logged — you're off sick/);
    expect(st().restPeriods[0]).toMatchObject({ mode: 'illness', open: true });
  });
  it('injury: full rest, protect and lighter-stage wordings', () => {
    const rest = run({ type: 'injury', bodyPart: 'knee', stage: 'protect', restDays: 5 });
    expect(rest.text).toMatch(/^Logged in Injuries: 5 days of rest/);
    expect(st().injuries[0]).toMatchObject({ bodyPart: 'knee', stage: 'protect', note: 'Atlas' });
    expect(st().injuries[0].fullRestUntil).toBe(store.dayKey(T0) + 5);
    expect(run({ type: 'injury', bodyPart: 'knee', stage: 'protect' }).text).toMatch(
      /out of your sessions for now/,
    );
    const light = run(
      { type: 'injury', bodyPart: 'knee', stage: 'reintroduce', note: 'my note' },
      uk,
    );
    expect(light.text).toMatch(/цю зону поки тренуємо легко/);
    expect(st().injuries[0].note).toBe('my note');
    expect(st().injuries[0].fullRestUntil ?? null).toBeNull();
  });
  it('injury for an unknown body part still logs it, with no muscles', () => {
    run({ type: 'injury', bodyPart: 'toe-of-doom', stage: 'protect' });
    expect(st().injuries[0].muscles).toEqual([]);
  });
});

describe('runAction: activity', () => {
  it('logs a catalog activity with calories from the latest weight and distance only when tracked', () => {
    store.addWeight(80, T0 - DAY);
    const r = run({ type: 'activity', kind: 'run', minutes: 30, km: 5, at: T0 - 3_600_000 });
    expect(r.text).toBe('Logged — it’s in your activities and counts in your load now.');
    const a = st().activities[0];
    expect(a).toMatchObject({
      type: 'run',
      startedAt: T0 - 3_600_000,
      finishedAt: T0 - 3_600_000 + 30 * 60_000,
      durationMin: 30,
      note: 'Atlas',
    });
    expect(a.calories).toBeGreaterThan(0);
    expect(a.distanceKm).toBe(5);
  });
  it('a tracked-distance activity without km logs no distance; a non-tracked one ignores km', () => {
    run({ type: 'activity', kind: 'run', minutes: 20, at: T0 });
    expect(st().activities[0].distanceKm).toBeNull();
    expect(st().activities[0].calories).toBeNull(); // no weigh-in yet
  });
  it('an unknown kind is logged as conditioning with no calories and no distance', () => {
    run({ type: 'activity', kind: 'underwater-chess', minutes: 20, km: 3, at: T0 });
    expect(st().activities[0]).toMatchObject({
      category: 'conditioning',
      calories: null,
      distanceKm: null,
    });
  });
});

describe('runAction: start', () => {
  it('opens the workout that is already running', () => {
    const w = store.startWorkout(null)!;
    expect(run({ type: 'start' })).toEqual({ text: 'Opening your workout.', openWorkoutId: w.id });
  });
  it('without a plan it starts an empty session', () => {
    const r = run({ type: 'start' });
    expect(r.text).toBe('Go. I’m watching.');
    expect(st().workouts.find((w) => w.id === r.openWorkoutId)?.finishedAt).toBeNull();
  });
  it('refuses while an activity is running', () => {
    store.logActivity({
      type: 'run',
      category: 'conditioning',
      startedAt: T0 - 600_000,
      finishedAt: null,
      durationMin: 0,
    });
    const r = run({ type: 'start' }, uk);
    expect(r.openWorkoutId).toBeUndefined();
    expect(r.text).toBe('Не можу почати — вже йде щось інше (активність чи сон).');
    expect(run({ type: 'start' }).text).toMatch(/^Can’t start/);
  });
  it('with a main-coach plan for today it builds that day', () => {
    store.setCoach({ enabled: true, role: 'main' });
    run({ type: 'plan', days: 7, lengthMin: 45 });
    const r = run({ type: 'start' });
    expect(r.text).toBe('Go. I’m watching.');
    const w = st().workouts.find((x) => x.id === r.openWorkoutId)!;
    expect(w).toBeTruthy();
    expect(w.finishedAt).toBeNull();
  });
  it('an extra coach never builds the programme day', () => {
    store.setCoach({ enabled: true, role: 'extra' });
    run({ type: 'plan', days: 7, lengthMin: 45 });
    const r = run({ type: 'start' });
    expect(st().workouts.find((x) => x.id === r.openWorkoutId)?.exercises).toEqual([]);
  });
});

describe('runAction: many', () => {
  it('runs the actions in order, each on the store the previous one left; joins the lines', () => {
    const r = run({
      type: 'many',
      actions: [
        { type: 'avoid', exercise: 'Lunge' },
        { type: 'avoid', exercise: 'Deadlift' },
        { type: 'temper', temper: 5 },
      ],
    });
    expect(st().coach.memory?.avoid).toEqual(['Lunge', 'Deadlift']);
    expect(st().coach.temper).toBe(5);
    expect(r.text).toBe(
      'Done — no more «Lunge» in your plans. Done — no more «Deadlift» in your plans. Done. Better?',
    );
    expect(r.openWorkoutId).toBeUndefined();
  });
  it('surfaces the first workout to open', () => {
    const r = run({ type: 'many', actions: [{ type: 'temper', temper: 3 }, { type: 'start' }] });
    expect(r.openWorkoutId).toBeTruthy();
  });
});
