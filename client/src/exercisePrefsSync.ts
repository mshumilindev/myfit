/**
 * The person's display settings that used to live only on the device (SPO-385): the weight unit (kg/lb), the unit, load
 * type, sides and rest target pinned per exercise, and the rest-timer switches. They are one sealed document
 * `users/{uid}/meta/exercisePrefs` (last-write-wins by one stamp, like `mastery`); the `spotter.*` keys stay as the cache.
 *
 * Pure (no Firebase, no store import): store.ts owns the listener and the write; this file decides what to keep.
 */
import type { LoadType } from './loads';
import { REST_PREFS_DEFAULT, type RestPrefs } from './restTimer';

export type Unit = 'kg' | 'lb';
export interface ExercisePrefs {
  weightUnit: Unit;
  exerciseUnits: Record<string, Unit>;
  exerciseLoadTypes: Record<string, LoadType>;
  exerciseSides: Record<string, 'one' | 'both'>;
  exerciseRest: Record<string, number>;
  restPrefs: RestPrefs;
}

export const EMPTY_EXERCISE_PREFS: ExercisePrefs = {
  weightUnit: 'kg',
  exerciseUnits: {},
  exerciseLoadTypes: {},
  exerciseSides: {},
  exerciseRest: {},
  restPrefs: REST_PREFS_DEFAULT,
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function pick<V>(raw: unknown, ok: (v: unknown) => v is V): Record<string, V> {
  const out: Record<string, V> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (ok(v)) out[k] = v;
  return out;
}

/** A stored or received value to a safe shape: anything unknown is dropped, never guessed. */
export function normalizeExercisePrefs(raw: unknown): ExercisePrefs {
  const o = isObj(raw) ? raw : {};
  const rest = isObj(o.restPrefs) ? o.restPrefs : {};
  const restPrefs = { ...REST_PREFS_DEFAULT };
  for (const k of Object.keys(REST_PREFS_DEFAULT) as (keyof RestPrefs)[]) {
    if (typeof rest[k] === 'boolean') restPrefs[k] = rest[k];
  }
  return {
    weightUnit: o.weightUnit === 'lb' ? 'lb' : 'kg',
    exerciseUnits: pick(o.exerciseUnits, (v): v is Unit => v === 'kg' || v === 'lb'),
    exerciseLoadTypes: pick(
      o.exerciseLoadTypes,
      (v): v is LoadType => v === 'weight' || v === 'assist' || v === 'band',
    ),
    exerciseSides: pick(o.exerciseSides, (v): v is 'one' | 'both' => v === 'one' || v === 'both'),
    exerciseRest: pick(
      o.exerciseRest,
      (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
    ),
    restPrefs,
  };
}

/** Anything the person has set (so a first sync has something to keep). */
export function hasCustomExercisePrefs(p: ExercisePrefs): boolean {
  return (
    p.weightUnit !== 'kg' ||
    Object.keys(p.exerciseUnits).length > 0 ||
    Object.keys(p.exerciseLoadTypes).length > 0 ||
    Object.keys(p.exerciseSides).length > 0 ||
    Object.keys(p.exerciseRest).length > 0 ||
    (Object.keys(REST_PREFS_DEFAULT) as (keyof RestPrefs)[]).some(
      (k) => p.restPrefs[k] !== REST_PREFS_DEFAULT[k],
    )
  );
}

export interface ExercisePrefsDecision {
  /** Take this from the account. */
  apply?: { at: number; prefs: ExercisePrefs };
  /** Write this device's values to the account. */
  push?: boolean;
}

/**
 * A snapshot of the account's document arrived. `remote` is null when the account has none yet.
 * - none yet: keep what this device has (push it, once, if it is not all defaults);
 * - a newer local edit that has not echoed back yet wins over the snapshot;
 * - otherwise the account's values replace this device's.
 */
export function reconcileExercisePrefs(
  local: { at: number; prefs: ExercisePrefs },
  remote: { at: number; raw: unknown } | null,
  now: number = Date.now(),
): ExercisePrefsDecision {
  if (!remote) return hasCustomExercisePrefs(local.prefs) ? { push: true } : {};
  if (local.at > remote.at) {
    // A newer local edit wins; if the account still holds something else (an older write reached it last), send ours.
    return canon(normalizeExercisePrefs(remote.raw)) === canon(local.prefs) ? {} : { push: true };
  }
  const theirs = normalizeExercisePrefs(remote.raw);
  // First contact (this device never edited or synced these): the account's values stand untouched; only what this
  // device has and the account lacks is added, then written back. Nothing the account holds is ever overwritten.
  if (local.at === 0 && isObj(remote.raw) && hasCustomExercisePrefs(local.prefs)) {
    const merged = mergeAdditive(theirs, local.prefs);
    // A new stamp: two devices merging at the same moment must not write different contents under one stamp.
    if (merged) return { apply: { at: Math.max(remote.at + 1, now), prefs: merged }, push: true };
  }
  return { apply: { at: remote.at, prefs: theirs } };
}

/** Key-order-independent text of a value, to compare two settings objects. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : x,
  );
}

/** `theirs` plus the per-exercise entries only `mine` has; null when there is nothing to add. */
function mergeAdditive(theirs: ExercisePrefs, mine: ExercisePrefs): ExercisePrefs | null {
  let added = false;
  const add = <V>(a: Record<string, V>, b: Record<string, V>): Record<string, V> => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (!(k in out)) {
        out[k] = v;
        added = true;
      }
    }
    return out;
  };
  const merged: ExercisePrefs = {
    ...theirs,
    exerciseUnits: add(theirs.exerciseUnits, mine.exerciseUnits),
    exerciseLoadTypes: add(theirs.exerciseLoadTypes, mine.exerciseLoadTypes),
    exerciseSides: add(theirs.exerciseSides, mine.exerciseSides),
    exerciseRest: add(theirs.exerciseRest, mine.exerciseRest),
  };
  return added ? merged : null;
}
