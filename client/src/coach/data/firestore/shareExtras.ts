/**
 * Pure helpers for the parts of a client's share data that are not workouts: logged activities, sets per muscle this
 * week, and the days trained with the trainer. No I/O and no Firebase, so the client publisher, the trainer's share
 * source and the tests use the very same code.
 *
 *   activities   cardio / recovery sessions the member logged (Activity). Session-level detail: they are published only
 *                at totals `full` (a sealed `shares/totals` doc, opened with the trainer's grant), never at `effects`.
 *   weeklySets   working sets of THIS week per primary muscle. At sets `effects` it is part of the sealed weekly view
 *                the client device publishes (`shares/sets`); at `full` the trainer's device derives it from the opened
 *                workouts with the same function.
 *   trainerDays  the weekdays trained with the trainer. These are the trainer's own plan (or, for a member without an
 *                in-app trainer, their own marker), not a consent category.
 */
import type { Activity, ActivityEffort, Exercise, Workout } from '../../../types';
import { DAY, weekStartOf } from '../../domain/time';
import { DOWS, type Dow } from '../../domain/types';
import type { ActivitySource } from '../../share/types';

/**
 * What the pure helpers need from the app's catalogues. Injected (see `shareCatalog.ts`) so these helpers and the adapters
 * stay free of the exercise catalogue (it pulls the i18n bundle: not loadable in a node-side test).
 */
export interface ExtrasCatalog {
  /** primary muscle id of an exercise name (catalogue or the member's custom exercises) */
  primaryMuscle(name: string): string | null;
  /** icon name of an activity type key */
  activityIcon(type: string): string | null;
}
export const plainCatalog: ExtrasCatalog = { primaryMuscle: () => null, activityIcon: () => null };

export const ACTIVITY_DAYS = 90;
const MAX_ACTIVITIES = 200;
const EFFORTS: readonly ActivityEffort[] = ['light', 'moderate', 'hard'];

/** Finished activities of the last 90 days as the share cards show them (no note, no GPS: neither is stored). */
export function activitiesForShare(
  acts: readonly Activity[],
  now: number,
  cat: ExtrasCatalog = plainCatalog,
): ActivitySource[] {
  return acts
    .filter((a) => a.finishedAt != null && a.startedAt >= now - ACTIVITY_DAYS * DAY)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_ACTIVITIES)
    .map((a) => ({
      id: a.id,
      at: a.startedAt,
      type: a.type,
      icon: cat.activityIcon(a.type) ?? 'activity',
      minutes: Math.max(1, Math.round(a.durationMin)),
      effort: a.effort ?? 'moderate',
      ...(a.distanceKm && a.distanceKm > 0 ? { km: Math.round(a.distanceKm * 10) / 10 } : {}),
    }));
}

/** An opened (untrusted) activity view -> clean ActivitySource[]; anything malformed is dropped. */
export function activitiesFromView(view: unknown): ActivitySource[] | undefined {
  const list = (view as { activities?: unknown } | undefined)?.activities;
  if (!Array.isArray(list)) return undefined;
  const out: ActivitySource[] = [];
  for (const x of list.slice(0, MAX_ACTIVITIES)) {
    const a = x as Partial<ActivitySource> | null;
    if (
      !a ||
      typeof a.id !== 'string' ||
      typeof a.type !== 'string' ||
      typeof a.icon !== 'string' ||
      !Number.isFinite(a.at) ||
      !Number.isFinite(a.minutes)
    )
      continue;
    out.push({
      id: a.id.slice(0, 80),
      at: a.at as number,
      type: a.type.slice(0, 40),
      icon: a.icon.slice(0, 40),
      minutes: a.minutes as number,
      effort: EFFORTS.includes(a.effort as ActivityEffort)
        ? (a.effort as ActivityEffort)
        : 'moderate',
      ...(Number.isFinite(a.km) && (a.km as number) > 0 ? { km: a.km as number } : {}),
    });
  }
  return out;
}

const isWorking = (s: { isWarmup?: boolean; type?: string }) =>
  !(s.isWarmup || s.type === 'warmup');
const primaryOf = (e: Exercise, cat: ExtrasCatalog): string | null =>
  e.primaryMuscle ?? cat.primaryMuscle(e.name);

/** Working sets of this (Monday-based) week per primary muscle id. Warm-ups and non-lifting rows do not count. */
export function weeklySetsOf(
  workouts: readonly Workout[],
  now: number,
  cat: ExtrasCatalog = plainCatalog,
): Record<string, number> {
  const from = weekStartOf(now);
  const out: Record<string, number> = {};
  for (const w of workouts) {
    if (w.finishedAt == null || w.startedAt < from || w.startedAt >= from + 7 * DAY) continue;
    for (const e of w.exercises ?? []) {
      if ((e.kind ?? 'strength') !== 'strength') continue;
      const m = primaryOf(e, cat);
      if (!m) continue;
      const n = (e.sets ?? []).filter(isWorking).length;
      if (n) out[m] = (out[m] ?? 0) + n;
    }
  }
  return out;
}

/** An opened (untrusted) weekly view -> a clean muscle -> sets map. */
export function weeklySetsFromView(view: unknown): Record<string, number> | undefined {
  const w = (view as { weeklySets?: unknown } | undefined)?.weeklySets;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(w as Record<string, unknown>))
    if (/^[a-z_]{2,24}$/.test(k) && Number.isInteger(v) && (v as number) > 0 && (v as number) < 500)
      out[k] = v as number;
  return out;
}

/** Weekday (Mon-based) of a timestamp in the viewer's local time, as the Dow the program uses. */
export const dowOfTime = (at: number): Dow => DOWS[(new Date(at).getDay() + 6) % 7];

/** Is this session on a day the member trains with the trainer? */
export const onTrainerDay = (at: number, trainerDays: readonly Dow[]): boolean =>
  trainerDays.includes(dowOfTime(at));

export const cleanDows = (x: unknown): Dow[] =>
  Array.isArray(x) ? DOWS.filter((d) => x.includes(d)) : [];
