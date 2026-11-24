/**
 * SPO-558 (F0): "was = is". Pins what the fatigue and readiness code returns today for a fixed history, before it moves behind
 * the add-on seam. With the add-on installed every number must stay exactly as here (the rule of 05.11: installed = as now).
 * Regenerate on purpose only: `UPDATE_GOLDEN=1 npx vitest run src/fatigue/fatigueGolden.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addonsPref } from '../addons/enabledSet';
import { deloadSuggestion, muscleFatigue, stalledMuscles } from '../fatigue';
import { muscleReadiness, computeReadiness } from '../recovery';
import { FAMILIES, familyFatigueLevel, familyReadiness, fatigueByGroup } from '../picker';
import { planRest, type RestInputs } from '../restTimer';
import { readinessFactor, type RpeContext } from '../rpe';
import { buildDay, type BuildContext } from '../sessionBuilder';
import { personalLandmarks } from '../personalize';
import type { BodyMetrics, Exercise, SetEntry, Workout } from '../types';

// Equipment installed, as in the sibling tests (the gym inventory filters exercises).
beforeAll(() => addonsPref.set(['equipment']));
afterAll(() => addonsPref.reset());

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 23, 12);
const set = (reps: number, weight: number | null, i: number): SetEntry => ({
  id: `s${i}`,
  reps,
  weight,
  isWarmup: false,
  position: i,
  loggedAt: NOW,
});
const ex = (name: string, n: number, reps = 8, kg = 60): Exercise => ({
  id: name,
  name,
  position: 0,
  sets: Array.from({ length: n }, (_, i) => set(reps, kg, i)),
});
const wk = (id: string, daysAgo: number, exercises: Exercise[]): Workout => ({
  id,
  startedAt: NOW - daysAgo * DAY,
  finishedAt: NOW - daysAgo * DAY + 3600000,
  autoFinished: false,
  exercises,
});

/** A busy chest week, legs two days back, back a week ago, and older repeats so some lifts have history. */
const HISTORY: Workout[] = [
  wk('a', 1, [ex('Barbell Bench Press', 6, 6, 90), ex('Incline Dumbbell Press', 5, 10, 30)]),
  wk('b', 2, [ex('Barbell Back Squat', 8, 5, 110), ex('Romanian Deadlift', 5, 8, 100)]),
  wk('c', 4, [ex('Barbell Bench Press', 6, 6, 90), ex('Cable Fly', 4, 12, 20)]),
  wk('d', 8, [ex('Wide-Grip Lat Pulldown', 6, 10, 60), ex('Barbell Row', 5, 8, 70)]),
  wk('e', 9, [ex('Barbell Bench Press', 5, 6, 87.5)]),
  wk('f', 15, [ex('Barbell Back Squat', 5, 5, 105)]),
  wk('g', 22, [ex('Barbell Bench Press', 5, 6, 85)]),
];

/** A brutal week: every big muscle far past its volume ceiling, so the deload rule fires. */
const HEAVY: Workout[] = [1, 2, 3, 4, 5, 6].map((d) =>
  wk(`h${d}`, d, [
    ex('Barbell Bench Press', 12, 6, 90),
    ex('Barbell Back Squat', 12, 5, 110),
    ex('Barbell Row', 12, 8, 70),
    ex('Overhead Press', 12, 6, 50),
    ex('Barbell Curl', 12, 10, 30),
    ex('Romanian Deadlift', 12, 8, 100),
  ]),
);

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const plain = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_k, x) =>
      typeof x === 'number'
        ? r6(x)
        : x instanceof Map
          ? [...x.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
          : x instanceof Set
            ? [...x].sort()
            : x,
    ),
  );

function snapshot() {
  const lm = personalLandmarks(HISTORY, NOW);
  const fat = muscleFatigue(HISTORY, NOW, lm);
  const weekly = muscleFatigue(HISTORY, NOW, lm, { acute: false });
  const rest: Record<string, number> = {};
  const base: RestInputs = {
    compound: true,
    equipment: ['barbell'],
    primary: 'chest',
    lastType: 'normal',
    intensity: 0.8,
    reps: 6,
    failure: false,
    rpe: 8,
    muscleFatigue: 0,
    illness: false,
    shortSleep: false,
    midRound: false,
  };
  for (const f of [0, 0.1, 0.16, 0.3, 0.5, 0.75, 1, 1.4])
    rest[`fatigue ${f}`] = planRest({ ...base, muscleFatigue: f }).sec;
  const rpe: Record<string, unknown> = {};
  const ctx: RpeContext = {
    refE1: 100,
    daysSinceLift: 3,
    illnessCut: 0,
    muscleFatigue: 0,
    sleepShortH: 0,
    priorSets: 0,
  };
  for (const f of [0, 0.2, 0.5, 1, 2])
    for (const p of [0, 2, 5])
      rpe[`fatigue ${f} prior ${p}`] = readinessFactor({ ...ctx, muscleFatigue: f, priorSets: p });
  const body: BodyMetrics = {
    sex: 'male',
    dob: '1992-01-01',
    heightCm: 180,
    weights: [{ id: 'w', at: NOW - 3 * DAY, weight: 82 }],
  };
  const bctx: BuildContext = {
    finished: HISTORY,
    activities: [],
    body,
    goals: undefined,
    gym: null,
    now: NOW,
    intent: 'muscle',
    targetMuscles: ['chest', 'back', 'quads'],
    warmup: false,
    cardio: false,
    cooldown: false,
    bodyKg: 82,
    sex: 'male',
  };
  const day = buildDay(bctx);
  return plain({
    fatigue: fat,
    weekly,
    deload: deloadSuggestion(fat),
    deloadBias: [-1, 1].map((b) => deloadSuggestion(fat, b)),
    stalled: stalledMuscles(HISTORY, NOW),
    readiness: muscleReadiness(HISTORY, NOW),
    readinessBoost: muscleReadiness(HISTORY, NOW, 0.5),
    pure: [
      computeReadiness(null, 0, 2, 12),
      computeReadiness(1, 8, 2, 12),
      computeReadiness(3, 14, 3, 14, 0.2, NOW),
    ],
    pickerFatigue: fatigueByGroup(HISTORY, NOW),
    families: FAMILIES.map((f) => ({
      id: f.id,
      ready: familyReadiness(f, HISTORY, NOW),
      level: familyFatigueLevel(f.groups, fatigueByGroup(HISTORY, NOW)),
    })),
    heavy: (() => {
      const f = muscleFatigue(HEAVY, NOW, personalLandmarks(HEAVY, NOW));
      return { fatigue: f, deload: deloadSuggestion(f), stalled: stalledMuscles(HEAVY, NOW) };
    })(),
    rest,
    rpe,
    day: {
      main: day.main,
      estMinutes: day.estMinutes,
    },
  });
}

const GOLDEN = join(__dirname, 'fatigueGolden.json');

describe('fatigue and readiness: numbers as they are today', () => {
  it('match the golden file', () => {
    const now = snapshot();
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
      writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n');
    }
    expect(now).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  });
  it('covers real data, not an empty history', () => {
    const s = snapshot() as { fatigue: unknown[]; readiness: unknown[]; day: { main: unknown[] } };
    expect(s.fatigue.length).toBeGreaterThan(5);
    expect(s.readiness.length).toBeGreaterThan(5);
    expect(s.day.main.length).toBeGreaterThan(0);
  });
});
