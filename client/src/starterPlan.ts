/**
 * A sensible first session when there's no history to learn from (a beginner,
 * or a weekday never trained before) — how muscle groups are usually spread
 * over a training week:
 *
 *  - Train each muscle about twice a week: higher frequency beats once a week
 *    at matched volume (Schoenfeld, Ogborn & Krieger 2016, Sports Med).
 *  - Novices: whole-body sessions 2–3×/week (ACSM position stand on
 *    progression models, 2009) — so with little history every day is full body.
 *  - Trained lifters: a split — here push / pull / legs + upper / lower over the
 *    week, which hits every group twice with ≥48 h between hits.
 *  - A muscle still recovering from a recent session isn't pushed again: when
 *    the weekday's template collides with recovery, the most-ready template wins.
 *
 * Each slot is a muscle; the lift for it comes from the catalog (compound
 * first, then the generic pick quality), limited to what the gym stocks.
 * Pure: callers pass the pick items, history and readiness.
 */
import type { MuscleGroup } from './data/exercises';
import type { PickItem } from './picker';

export type SplitDay = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';

/** Muscles in the order a session of that type usually runs (big first). */
export const SPLIT_SLOTS: Record<SplitDay, MuscleGroup[]> = {
  push: ['chest', 'shoulders', 'chest', 'triceps', 'shoulders'],
  pull: ['lats', 'traps', 'lats', 'biceps', 'traps'],
  legs: ['quads', 'hamstrings', 'glutes', 'quads', 'calves'],
  upper: ['chest', 'lats', 'shoulders', 'traps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  full: ['quads', 'chest', 'lats', 'shoulders', 'hamstrings'],
};

/**
 * The well-known staple lifts per muscle, best first — what a coach puts in a
 * first programme (compound, easy to learn, easy to load). The catalog tags
 * rows as traps, so rows lead the traps slot. When the gym lacks the kit, the
 * next staple is used, then the catalog's generic ranking.
 */
export const STAPLES: Partial<Record<MuscleGroup, string[]>> = {
  quads: ['Barbell Squat', 'Leg Press', 'Goblet Squat', 'Dumbbell Lunges'],
  chest: [
    'Barbell Bench Press - Medium Grip',
    'Dumbbell Bench Press',
    'Barbell Incline Bench Press - Medium Grip',
    'Incline Dumbbell Press',
    'Pushups',
  ],
  lats: ['Wide-Grip Lat Pulldown', 'Pullups', 'Chin-Up'],
  traps: ['Bent Over Barbell Row', 'Seated Cable Rows', 'One-Arm Dumbbell Row', 'Barbell Shrug'],
  shoulders: [
    'Dumbbell Shoulder Press',
    'Standing Military Press',
    'Machine Shoulder (Military) Press',
    'Side Lateral Raise',
  ],
  hamstrings: ['Romanian Deadlift', 'Lying Leg Curls', 'Seated Leg Curl'],
  glutes: ['Barbell Hip Thrust', 'Barbell Glute Bridge', 'Glute Kickback'],
  triceps: ['Triceps Pushdown', 'Close-Grip Barbell Bench Press', 'EZ-Bar Skullcrusher'],
  biceps: ['Barbell Curl', 'Dumbbell Bicep Curl', 'Hammer Curls'],
  calves: ['Standing Calf Raises', 'Seated Calf Raise', 'Calf Press On The Leg Press Machine'],
  core: ['Plank', 'Cable Crunch', 'Hanging Leg Raise', 'Crunches'],
};

/** Weekday template (Sunday = 0) for a trained lifter. */
const WEEK: SplitDay[] = ['full', 'push', 'pull', 'legs', 'upper', 'lower', 'full'];

/** Fewer finished sessions than this → treat as a novice (full body). */
export const NOVICE_SESSIONS = 6;

export interface StarterPlan {
  day: SplitDay;
  /** Ordered lifts, one per slot (fewer when the gym can't cover a slot). */
  lifts: { name: string; muscle: MuscleGroup; image: string | null }[];
}

export function starterPlan(p: {
  weekday: number;
  finishedCount: number;
  items: PickItem[];
  /** true when the muscle is still recovering (don't hit it again yet). */
  recovering: (m: MuscleGroup) => boolean;
}): StarterPlan {
  const novice = p.finishedCount < NOVICE_SESSIONS;
  const preferred: SplitDay = novice ? 'full' : WEEK[p.weekday % 7];
  const clash = (d: SplitDay) => {
    const ms = [...new Set(SPLIT_SLOTS[d])];
    return ms.filter((m) => p.recovering(m)).length / ms.length;
  };
  let day = preferred;
  if (clash(preferred) >= 0.5) {
    const order: SplitDay[] = novice
      ? ['full']
      : [preferred, ...(['upper', 'lower', 'push', 'pull', 'legs', 'full'] as SplitDay[])];
    day = order.reduce((best, d) => (clash(d) < clash(best) ? d : best), preferred);
  }
  const used = new Set<string>();
  const lifts: StarterPlan['lifts'] = [];
  for (const m of SPLIT_SLOTS[day]) {
    const ok = (i: PickItem) => i.available && !i.doneToday && !used.has(i.key);
    const staple = (STAPLES[m] ?? [])
      .map((n) => p.items.find((i) => i.key === n.toLowerCase()))
      .find((i): i is PickItem => !!i && ok(i));
    const pick =
      staple ??
      p.items
        .filter((i) => i.primary === m && ok(i))
        .sort(
          (a, b) =>
            Number(b.compound) - Number(a.compound) ||
            b.quality - a.quality ||
            b.timesDone - a.timesDone,
        )[0];
    if (!pick) continue;
    used.add(pick.key);
    lifts.push({ name: pick.name, muscle: m, image: pick.image });
  }
  return { day, lifts };
}
