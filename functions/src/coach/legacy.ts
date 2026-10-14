/**
 * The consent cut for the LEGACY trainer/admin callables (`profileUser`, `athleteWorkout`, `athleteExerciseHistory`,
 * `trainerClients`, `trainerClientDetail`, `adminUserDetail`, `adminExportUser`).
 *
 * Before: they authorised by `users.trainerId == uid` (or role admin) and returned whole workout documents. Now they
 * answer from the SAME relationship the coach read path uses (`coaching/{client}`: trainer of record, status active,
 * mode not program) and the SAME per-category levels as `coachRead`. An admin has coach rights only for the clients they
 * coach themselves; there is no other bypass. Pure helpers + one Kv read; unit tested without Firebase.
 */
import type { Kv } from './kv';
import { CATEGORIES, legacyLevel, type Category, type CoachingDoc, type Level } from './logic';

export type LegacyCut = Record<Category, Level> & { coach: boolean };

/** `null` = the viewer IS the subject (no cut). Otherwise the level the viewer may use per category. */
export async function legacyCut(
  kv: Kv,
  viewerUid: string,
  targetId: string,
): Promise<LegacyCut | null> {
  if (viewerUid === targetId) return null;
  const c = (await kv.get(`coaching/${targetId}`)) as CoachingDoc | null;
  const out = { coach: false } as LegacyCut;
  for (const cat of CATEGORIES) out[cat] = legacyLevel(c, viewerUid, cat);
  out.coach = !!c && c.trainerId === viewerUid && c.status === 'active' && c.mode !== 'program';
  return out;
}

export const canSeeFull = (cut: LegacyCut | null, cat: Category): boolean =>
  cut === null || cut[cat] === 'full';
export const canSeeSummary = (cut: LegacyCut | null, cat: Category): boolean =>
  cut === null || cut[cat] !== 'off';

const WORKOUT_OPEN = [
  'id',
  'startedAt',
  'finishedAt',
  'stats',
  'autoFinished',
  'gymId',
  'dayName',
] as const;

/** A workout reduced to its open fields: never `exercises` or the sealed `enc`. */
export function openWorkout<T extends object>(w: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of WORKOUT_OPEN) if (k in w) out[k] = (w as Record<string, unknown>)[k];
  return out as Partial<T>;
}

/** What the viewer may see of a workout list: full documents (sets), open fields (totals full), or nothing. */
export function cutWorkouts<T extends object>(cut: LegacyCut | null, ws: readonly T[]): T[] {
  if (cut === null || cut.sets === 'full') return [...ws];
  return cut.totals === 'full' ? ws.map((w) => openWorkout(w) as T) : [];
}

/** Aggregates may be computed when any totals level is granted (effects = summary numbers only). */
export function aggregateWorkouts<T extends object>(cut: LegacyCut | null, ws: readonly T[]): T[] {
  if (cut === null || cut.sets === 'full') return [...ws];
  return cut.totals === 'off' ? [] : ws.map((w) => openWorkout(w) as T);
}
