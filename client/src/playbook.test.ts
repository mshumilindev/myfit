import { describe, expect, it } from 'vitest';
import { computePlaybook, playForWeekday } from './playbook';
import type { Exercise, Workout } from './types';

const DAY = 86400000;
// 2026-01-05 is a Monday.
const MON = Date.UTC(2026, 0, 5, 17);
let n = 0;
const lift = (name: string, pos: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: pos,
    sets: [8, 8, 8].map((r, i) => ({
      id: `s${n++}`,
      reps: r,
      weight: 50,
      isWarmup: false,
      position: i,
    })),
  }) as unknown as Exercise;
const warm = (): Exercise =>
  ({
    id: `w${n++}`,
    name: 'Warm-up',
    kind: 'warmup',
    position: -1,
    sets: [],
  }) as unknown as Exercise;
const session = (at: number, names: string[], withWarm = false): Workout =>
  ({
    id: `W${n++}`,
    startedAt: at,
    finishedAt: at + 3600000,
    gymId: null,
    exercises: [...(withWarm ? [warm()] : []), ...names.map((x, i) => lift(x, i))],
  }) as unknown as Workout;

const CHEST = [
  'Barbell Bench Press - Medium Grip',
  'Incline Dumbbell Press',
  'Dips - Chest Version',
  'Cable Crossover',
];
const SHOULDERS = [
  'Standing Military Press',
  'Side Lateral Raise',
  'Seated Dumbbell Press',
  'Face Pull',
];
const BACK = [
  'Wide-Grip Lat Pulldown',
  'Bent Over Barbell Row',
  'Seated Cable Rows',
  'Barbell Curl',
];
const LEGS = ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Standing Calf Raises'];

describe('playbook: every day you train gets its own play', () => {
  const ws: Workout[] = [];
  for (let wk = 0; wk < 4; wk++) {
    const base = MON + wk * 7 * DAY;
    ws.push(session(base, CHEST, true)); // Mon
    ws.push(session(base + 1 * DAY, BACK)); // Tue
    ws.push(session(base + 3 * DAY, SHOULDERS, true)); // Thu
    ws.push(session(base + 5 * DAY, LEGS)); // Sat
  }
  const pb = computePlaybook(ws, MON + 40 * DAY);
  it('chest and shoulders days are separate plays (not one "Push")', () => {
    expect(pb.plays.length).toBe(4);
  });
  it('the weekday picks its play; warm-up habit is learned', () => {
    const dow = (d: number) => new Date(MON + d * DAY).getDay();
    const thu = playForWeekday(pb.plays, dow(3))!;
    expect(thu.exercises.map((e) => e.name)).toContain('Side Lateral Raise');
    expect(thu.opensWithWarmup).toBe(true);
    expect(playForWeekday(pb.plays, dow(1))!.opensWithWarmup).toBe(false);
    expect(playForWeekday(pb.plays, dow(2))).toBeNull(); // nothing on Wednesdays
  });
});
