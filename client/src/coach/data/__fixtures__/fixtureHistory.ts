/**
 * Overview history for the fixtures adapter (lifts, last sessions, weekly rhythm). Oleh Bondar is copied from
 * the lab (v11 adata/bdata); the other clients get a small deterministic series so every screen has data.
 * Kept out of fixtures.ts on purpose: plain data keyed by client id, no engine inputs.
 */
import type { ExerciseResult, ExerciseSession, WorkoutEntry } from '../../domain/workouts';
import type { ClientHistory, LiftSummary, SessionSummary, WeekCount } from '../../domain/history';
import { DAY } from '../../domain/time';
import { withSets } from './fixtureSets';
import type { CoachClient } from '../../domain/types';

const D = (m: number, d: number) => Date.UTC(2026, m - 1, d, 18, 0);

const OLEH_LIFTS: LiftSummary[] = [
  {
    id: 'bench',
    name: 'Bench press',
    target: { kg: 100, reps: 5 },
    e1rm: 116,
    series: [111, 113, 116, 116, 116, 115, 116, 116],
  },
  {
    id: 'row',
    name: 'Bent-over row',
    target: { kg: 70, reps: 8 },
    e1rm: 89,
    series: [80, 82, 83, 85, 86, 87, 88, 89],
  },
  {
    id: 'incline',
    name: 'Incline dumbbell press',
    target: { kg: 30, reps: 10 },
    e1rm: 40,
    series: [34, 35, 36, 37, 38, 38, 39, 40],
  },
  {
    id: 'lateral',
    name: 'Lateral raise',
    target: { kg: 10, reps: 15 },
    e1rm: 15,
    series: [11, 12, 12, 13, 14, 14, 15, 15],
  },
];

const OLEH_SESSIONS: SessionSummary[] = [
  { id: 'h1', at: D(10, 6), title: 'Upper A', sets: 15, tonnageKg: 4700 },
  { id: 'h2', at: D(10, 3), title: 'Lower B', sets: 12, tonnageKg: 6800 },
  { id: 'h3', at: D(10, 2), title: 'Upper B', sets: 13, tonnageKg: 6400 },
  { id: 'h4', at: D(10, 1), title: 'Lower A', sets: 14, tonnageKg: 15700 },
  { id: 'h5', at: D(9, 29), title: 'Upper A', sets: 16, tonnageKg: 5000 },
];

const TRAINER_DOW = new Set([2, 5]); // Oleh's 1:1 days with the trainer: Tue, Fri (UTC weekday)

/** Oleh: 41 sessions in 12 weeks (Tue Upper A, Thu Lower A, Fri Upper B, Sat Lower B), newest first. */
function olehEntries(now: number): WorkoutEntry[] {
  const plan: [number, string][] = [
    [1, 'Upper A'],
    [3, 'Lower A'],
    [4, 'Upper B'],
    [5, 'Lower B'],
  ];
  const monday = Date.UTC(2026, 9, 5, 18, 0);
  const out: WorkoutEntry[] = [];
  for (let w = 0; w < 12; w++) {
    plan.forEach(([off, title], i) => {
      const at = monday - w * 7 * DAY + off * DAY;
      if (at > now) return;
      if (w > 0 && (w * 4 + i) % 11 === 3) return; // a few missed sessions
      const known = OLEH_SESSIONS.find((s) => s.at === at);
      const sets = known?.sets ?? 12 + ((w * 3 + i) % 5);
      out.push({
        id: `w${w}-${i}`,
        at,
        title,
        minutes: 44 + ((w * 7 + i * 5) % 26),
        sets,
        tonnageKg:
          known?.tonnageKg ?? (title.startsWith('Lower A') ? 15000 : 5000) + ((w * 337) % 1700),
        withTrainer: TRAINER_DOW.has(new Date(at).getUTCDay()),
        pr: title === 'Lower A' && w % 3 === 0 && w > 0,
        compliance: w === 0 ? 94 : 100,
        gym: 'Iron Yard',
      });
    });
  }
  return out;
}

/** [name, e1rm now, slope per session, stalled]. */
const OLEH_EXERCISES: [string, number, number, boolean][] = [
  ['Bench press', 116, 0, true],
  ['Bent-over row', 89, 0.35, false],
  ['Incline dumbbell press', 40, 0.35, false],
  ['Bulgarian split squat', 35, 0, false],
  ['Deadlift', 167, 0.55, false],
  ['Lying leg curl', 63, 0.45, false],
  ['Lat pulldown', 87, 0.45, false],
  ['Preacher curl', 42, 0.35, false],
  ['Skull crusher', 49, 0.35, false],
  ['Leg press', 277, 1.2, false],
  ['Romanian deadlift', 127, 0.8, false],
  ['Squat', 137, 0.7, false],
  ['Standing calf raise', 112, 0.8, false],
];

function exerciseSessions(
  entries: readonly WorkoutEntry[],
  e1rmNow: number,
  slope: number,
  seed: number,
  count = 10,
  rpe = 8,
  noisy = false,
): ExerciseSession[] {
  const days = [...entries].slice(0, count).reverse();
  return days.map((d, i) => {
    const jitter = noisy ? ((i * 7 + seed) % 5) - 2 : 0;
    const wiggle = slope > 0 ? (((i * 5 + seed) % 4) - 1.5) * 0.25 : 0;
    const last = i === days.length - 1;
    const e1rm =
      Math.round((e1rmNow - (days.length - 1 - i) * slope + jitter + (last ? 0 : wiggle)) * 10) /
      10;
    const kg = Math.round(e1rm * 0.85);
    return {
      at: d.at,
      sets: 3 + ((i + seed) % 2),
      top: `${kg}x5`,
      e1rm,
      rpe: rpe - ((i + seed) % 2) * 0.5,
    };
  });
}

function olehExercises(entries: readonly WorkoutEntry[]): ExerciseResult[] {
  return OLEH_EXERCISES.map(([name, e1, slope], k) => ({
    id: `ex${k}`,
    name,
    sessions: exerciseSessions(
      entries.slice(k % 3),
      e1,
      slope,
      k,
      name === 'Bench press' ? 21 : 10,
      8,
      name === 'Bench press',
    ),
  }));
}

const hash = (s: string): number => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

const GENERIC_LIFTS: [string, number, number, number][] = [
  ['Back squat', 90, 5, 108],
  ['Romanian deadlift', 80, 8, 104],
  ['Overhead press', 40, 6, 52],
];

function generic(c: CoachClient, now: number): ClientHistory {
  const h = hash(c.id);
  const lifts: LiftSummary[] = GENERIC_LIFTS.map(([name, kg, reps, e1rm], i) => {
    const base = e1rm + (h % 7) - 3;
    const series = Array.from({ length: 8 }, (_, k) => base - (7 - k) * (1 + ((h >> i) % 2)));
    return {
      id: `${c.id}-l${i}`,
      name,
      target: { kg: kg + (h % 5), reps },
      e1rm: series[7],
      series,
    };
  });
  const titles = ['Full A', 'Full B', 'Full C'];
  const sessions: SessionSummary[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${c.id}-s${i}`,
    at: now - (i * 2 + 1) * DAY - (h % 3) * DAY,
    title: titles[(h + i) % titles.length],
    sets: 10 + ((h + i * 3) % 7),
    tonnageKg: 3000 + ((h * (i + 2)) % 4000),
  }));
  const weeks: WeekCount[] = Array.from({ length: 7 }, (_, i) => ({
    done: 7 - i <= c.streakWeeks ? c.planned : Math.max(0, Math.floor(c.planned / 2)),
    planned: c.planned,
  }));
  const entries: WorkoutEntry[] = Array.from({ length: 12 }, (_, i) => ({
    id: `${c.id}-w${i}`,
    at: now - (i * 3 + 1) * DAY - (h % 3) * DAY,
    title: titles[(h + i) % titles.length],
    minutes: 40 + ((h + i * 4) % 25),
    sets: sessions[i % 5]?.sets ?? 12,
    tonnageKg: 3000 + ((h * (i + 2)) % 4000),
    withTrainer: false,
    pr: i === 4,
    compliance: i === 0 ? 92 : 100,
    ...(c.gym ? { gym: c.gym } : {}),
  }));
  const exercises: ExerciseResult[] = lifts.map((l, i) => ({
    id: l.id,
    name: l.name,
    sessions: exerciseSessions(entries, l.e1rm, 1 + ((h >> i) % 2), i + h, 8),
  }));
  return { lifts, sessions, weeks, workouts: { entries: withSets(entries), exercises } };
}

export function buildFixtureHistory(
  clients: readonly CoachClient[],
  now: number,
): Record<string, ClientHistory> {
  const out: Record<string, ClientHistory> = {};
  for (const c of clients) {
    if (c.invite || c.mode === 'program') continue;
    out[c.id] = generic(c, now);
  }
  const oleh = out.c1;
  if (oleh) {
    out.c1 = {
      lifts: OLEH_LIFTS,
      sessions: OLEH_SESSIONS,
      weeks: Array.from({ length: 7 }, () => ({ done: 4, planned: 4 })),
      workouts: {
        entries: withSets(olehEntries(now)),
        exercises: olehExercises(olehEntries(now)),
        planned: [
          { at: Date.UTC(2026, 9, 8, 18, 0), title: 'Lower A' },
          { at: Date.UTC(2026, 9, 9, 18, 0), title: 'Upper B' },
          { at: Date.UTC(2026, 9, 10, 18, 0), title: 'Lower B' },
        ],
      },
    };
  }
  return out;
}
