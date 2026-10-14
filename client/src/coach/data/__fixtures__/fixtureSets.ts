/**
 * Fixture per-set detail for the session recap: deterministic sets for a workout entry, so the grid has data
 * everywhere the fixtures have sessions. The set count equals the entry's `sets`; the weights are scaled so the
 * tonnage lands near the entry's (round 2.5 kg steps). Plain data, no copy.
 */
import type { SessionExercise, SetEntry, WorkoutEntry } from '../../domain/workouts';

const hash = (s: string): number => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** [name, working kg, reps] */
type Pool = readonly (readonly [string, number, number])[];
const UPPER: Pool = [
  ['Bench press', 85, 5],
  ['Bent-over row', 70, 8],
  ['Incline dumbbell press', 30, 10],
  ['Lat pulldown', 62, 10],
  ['Lateral raise', 10, 15],
  ['Skull crusher', 35, 10],
  ['Preacher curl', 30, 10],
];
const LOWER: Pool = [
  ['Squat', 105, 5],
  ['Romanian deadlift', 100, 8],
  ['Leg press', 200, 10],
  ['Bulgarian split squat', 28, 10],
  ['Lying leg curl', 45, 12],
  ['Standing calf raise', 80, 15],
  ['Deadlift', 140, 5],
];
const FULL: Pool = [
  ['Back squat', 75, 8],
  ['Overhead press', 40, 8],
  ['Romanian deadlift', 70, 10],
  ['Bent-over row', 55, 10],
  ['Lat pulldown', 50, 12],
  ['Standing calf raise', 60, 15],
];

const poolOf = (title: string): Pool =>
  /^lower|^legs|^glute/i.test(title) ? LOWER : /^upper|^push|^pull/i.test(title) ? UPPER : FULL;

const round25 = (kg: number): number => Math.max(2.5, Math.round(kg / 2.5) * 2.5);

/** The sets of one session: `entry.sets` sets over 3 to 6 exercises, in a stable order. */
export function setsFor(
  entry: Pick<WorkoutEntry, 'id' | 'title' | 'sets' | 'tonnageKg'> &
    Partial<Pick<WorkoutEntry, 'compliance'>>,
): SessionExercise[] {
  const total = Math.max(0, Math.round(entry.sets));
  if (total === 0) return [];
  const h = hash(entry.id);
  const pool = poolOf(entry.title);
  const k = Math.min(pool.length, Math.max(1, Math.min(6, Math.round(total / 3))));
  const picked = Array.from({ length: k }, (_, i) => pool[(h + i) % pool.length]);
  const per = picked.map((_, i) => Math.floor(total / k) + (i < total % k ? 1 : 0));
  // scale the weights so the session's tonnage is close to the recorded one
  const raw = picked.reduce((n, [, kg, reps], i) => n + kg * reps * per[i], 0);
  const f = raw > 0 && entry.tonnageKg > 0 ? entry.tonnageKg / raw : 1;
  return picked.map(([name, kg, reps], i) => {
    const sets: SetEntry[] = Array.from({ length: per[i] }, (_, j) => {
      const last = j === per[i] - 1;
      const drift = (h >> (i + j)) % 3 === 0 && j > 0 ? -1 : 0;
      return {
        kg: round25(kg * f),
        reps: Math.max(1, reps + drift),
        rpe: Math.min(10, 7 + (last ? 1.5 : 0.5 * (j % 2))),
      };
    });
    // the plan asked for the sets that were done, plus one more in the first exercise of a session that fell short
    const short = (entry.compliance ?? 100) < 100 && i === 0 ? 1 : 0;
    return { name, sets, prescribed: { sets: per[i] + short, reps } };
  });
}

/** Entries with their per-set detail filled in. */
export const withSets = (entries: readonly WorkoutEntry[]): WorkoutEntry[] =>
  entries.map((e) => ({ ...e, exercises: setsFor(e) }));
