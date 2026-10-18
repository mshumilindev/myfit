import { useMemo, useState } from 'react';
import type { MuscleGroup } from '../data/exercises';
import { muscleReadiness } from '../recovery';
import { referenceE1rm, setTanks, type SetTank, type TankExercise } from '../setTank';
import { stalledMuscles } from '../fatigue';
import { isMarkerExercise, isStrengthExercise, loadTypeFor, resolveMuscles } from '../store';
import { dropTolerance, finalDrop, performanceDrops } from '../stimulus';
import type { Workout } from '../types';

/** The lift's earlier sessions that have sets; `done` is already sorted newest first. */
function sessionsOf(done: readonly Workout[], name: string) {
  const needle = name.trim().toLowerCase();
  return done
    .map((w) => ({
      startedAt: w.startedAt,
      sets: w.exercises.find((x) => x.name.trim().toLowerCase() === needle)?.sets ?? [],
    }))
    .filter((x) => x.sets.length > 0);
}

const EMPTY: Workout[] = [];
const NONE: ReadonlyMap<string, SetTank> = new Map();

/**
 * Set bars of a LIVE workout (spec docs/specs/set-bars-tank.md): the tank of the
 * target muscle after every set, keyed by set id. Empty unless `live` — finished
 * and past views show no bars. Inputs are fixed at the workout start (base
 * readiness without boost/alcohol/nicotine, e1RM history before the session), so
 * the result is a pure function of the logged sets.
 */
export function useSetBars(
  workout: Workout | undefined,
  live: boolean,
  workouts: readonly Workout[],
): ReadonlyMap<string, SetTank> {
  const id = workout?.id;
  const startedAt = workout?.startedAt;
  const filtered =
    live && id !== undefined && startedAt !== undefined
      ? workouts.filter((w) => w.finishedAt !== null && w.id !== id && w.startedAt < startedAt)
      : EMPTY;
  // `workouts` changes identity on every logged set (it holds the live workout), but the
  // finished history before it does not: keep the previous subset while every element is
  // the same object, so the history-derived work below runs only when history changes.
  const [before, setBefore] = useState<Workout[]>(filtered);
  if (before.length !== filtered.length || filtered.some((w, i) => w !== before[i]))
    setBefore(filtered);
  const base = useMemo(() => {
    const ready = new Map<string, number>();
    if (before.length === 0 || startedAt === undefined)
      return { ready, stalled: new Set<MuscleGroup>() };
    for (const [m, r] of muscleReadiness(before, startedAt, 0)) ready.set(m, r.readiness);
    return { ready, stalled: stalledMuscles(before, startedAt) };
  }, [before, startedAt]);

  // Newest first, sorted once per history instead of once per exercise per logged set.
  const newestFirst = useMemo(
    () => [...before].sort((a, b) => b.startedAt - a.startedAt),
    [before],
  );

  return useMemo(() => {
    if (!live || !workout) return NONE;
    const exercises: TankExercise[] = workout.exercises
      .filter((e) => isStrengthExercise(e) && !isMarkerExercise(e))
      .map((e) => {
        const { primary, secondary } = resolveMuscles(e);
        const weighted = loadTypeFor(e) === 'weight';
        const past = sessionsOf(newestFirst, e.name);
        const drops = past
          .slice(0, 6)
          .map((x) => finalDrop(x.sets))
          .filter((n): n is number => n !== null);
        return {
          id: e.id,
          primary,
          secondary: secondary as MuscleGroup[],
          weighted,
          e1rmRef: referenceE1rm(past, workout.startedAt, weighted),
          sets: e.sets,
          perfDrop: performanceDrops(e.sets),
          dropTolerance: dropTolerance(
            drops,
            !!primary && base.stalled.has(primary as MuscleGroup),
          ),
        };
      });
    const breaks = workout.exercises
      .filter((e) => e.kind === 'cooldown' && e.markerAt)
      .map((e) => e.markerAt as number);
    return setTanks({ exercises, readiness: base.ready, breaks });
  }, [live, workout, base, newestFirst]);
}
