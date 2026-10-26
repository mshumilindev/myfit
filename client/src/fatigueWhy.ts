/**
 * Why a muscle's fatigue label reads as it does (SPO-352). Fatigue is recent LOAD,
 * not missing volume: a muscle with no sets in the trailing window is rested and the
 * hint says how long ago it last worked; otherwise it shows the week's sets against
 * the muscle's limit. Pure; shares its map and "days since" with the rest of the app.
 */
import { muscleGapDays } from './recovery';
import type { MuscleFatigue, FatigueLevel } from './fatigue';
import type { MuscleGroup } from './data/exercises';
import type { Workout } from './types';

export type FatigueWhy =
  { kind: 'idle'; days: number | null } | { kind: 'load'; sets: number; mrv: number };

const RANK: Record<FatigueLevel, number> = { fresh: 0, moderate: 1, high: 2, fried: 3 };

export function fatigueWhy(
  groups: readonly MuscleGroup[],
  finished: Workout[],
  now: number,
  map: ReadonlyMap<MuscleGroup, MuscleFatigue>,
): FatigueWhy {
  const lvl = (m: MuscleGroup): number => RANK[map.get(m)?.level ?? 'fresh'];
  // The muscle that sets a family's headline level: the worst one, first wins a tie.
  let g = groups.find((x) => x !== 'cardio') ?? groups[0];
  for (const x of groups) if (x !== 'cardio' && lvl(x) > lvl(g)) g = x;
  const f = map.get(g);
  if (!f || f.sets <= 0) return { kind: 'idle', days: muscleGapDays(finished, g, now) };
  return { kind: 'load', sets: Math.round(f.sets * 10) / 10, mrv: f.mrv };
}
