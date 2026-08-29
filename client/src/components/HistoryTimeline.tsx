/**
 * Unified history timeline — finished workouts and finished activities merged
 * into one list, grouped by calendar day. The date shows once per day on the
 * left (like the workout-history date column); a day's items stack in
 * chronological order, earliest on top. Used by the Today preview and the full
 * history, capped to `maxDays` days.
 */
import { useState } from 'react';
import {
  deleteActivity,
  muscleWorkSorted,
  programDayNameFor,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
} from '../store';
import { fmtDurationHM, fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { MuscleRow } from './Muscle';
import { ConfirmDialog, Icon } from '../ui';
import {
  activityType,
  activityCategory,
  activityCalories,
  workoutCalories,
  durationMin as activityDurationMin,
} from '../activities';
import type { MuscleGroup } from '../data/exercises';
import type { Activity, Workout } from '../types';

type Item = { kind: 'w'; ts: number; w: Workout } | { kind: 'a'; ts: number; a: Activity };

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Merge + group finished workouts and activities into day buckets, newest day
 *  first, and each day's items in chronological order (earliest on top). */
export function buildHistoryDays(
  workouts: Workout[],
  activities: Activity[],
): { key: string; ts: number; items: Item[] }[] {
  const items: Item[] = [
    ...workouts
      .filter((w) => w.finishedAt !== null)
      .map((w) => ({ kind: 'w' as const, ts: w.startedAt, w })),
    ...activities
      .filter((a) => a.finishedAt !== null)
      .map((a) => ({ kind: 'a' as const, ts: a.startedAt, a })),
  ];
  const map = new Map<string, { key: string; ts: number; items: Item[] }>();
  for (const it of items) {
    const key = dayKey(it.ts);
    let g = map.get(key);
    if (!g) {
      g = { key, ts: it.ts, items: [] };
      map.set(key, g);
    }
    g.items.push(it);
    if (it.ts > g.ts) g.ts = it.ts;
  }
  const days = [...map.values()].sort((a, b) => b.ts - a.ts);
  for (const d of days) d.items.sort((x, y) => x.ts - y.ts);
  return days;
}

export function HistoryTimeline({
  workouts,
  activities,
  allWorkouts,
  bodyKg,
  maxDays,
  dayOffset = 0,
  onOpenWorkout,
  openMuscleHistory,
  showMuscles = true,
}: {
  /** Finished workouts to show. */
  workouts: Workout[];
  /** Finished activities to show. */
  activities: Activity[];
  /** All workouts — used to resolve program day names. */
  allWorkouts: Workout[];
  bodyKg: number | null;
  /** Cap the number of days rendered; omit to show all. */
  maxDays?: number;
  /** Skip this many of the most-recent days first (for paging). */
  dayOffset?: number;
  onOpenWorkout: (id: string) => void;
  openMuscleHistory?: (m: MuscleGroup) => void;
  showMuscles?: boolean;
}) {
  const { t, locale } = useT();
  const allDays = buildHistoryDays(workouts, activities);
  const days =
    maxDays != null ? allDays.slice(dayOffset, dayOffset + maxDays) : allDays.slice(dayOffset);

  const title = (w: Workout) => {
    const dn = programDayNameFor(w, allWorkouts);
    if (dn) return dn;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  if (days.length === 0) return null;

  return (
    <div className="hist-timeline">
      {days.map((day) => (
        <div className="hist-day" key={day.key}>
          <span className="hist-day-date">{fmtShortDate(day.items[0].ts, locale)}</span>
          <div className="hist-day-items">
            {day.items.map((it) =>
              it.kind === 'w' ? (
                <button
                  key={it.w.id}
                  className="hist-item hist-workout"
                  onClick={() => onOpenWorkout(it.w.id)}
                >
                  <span className="hist-item-body">
                    <span className="hist-item-name">{title(it.w)}</span>
                    <div className="hist-item-stats">
                      {workoutSets(it.w)} {t.sets} · {fmtKg(workoutVolumeKg(it.w))}
                      {it.w.finishedAt
                        ? ` · ${fmtDurationHM(it.w.finishedAt - it.w.startedAt)}`
                        : ''}
                      {(() => {
                        const kc = it.w.finishedAt ? workoutCalories(it.w, bodyKg) : null;
                        return kc != null ? (
                          <span className="stat-kcal">
                            {' '}
                            · ~{kc} {t.kcalShort}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {showMuscles && muscleWorkSorted(it.w).length > 0 && (
                      <MuscleRow entries={muscleWorkSorted(it.w)} onOpen={openMuscleHistory} />
                    )}
                  </span>
                  <Icon name="arrow-up-right" className="go" />
                </button>
              ) : (
                <ActivityRow key={it.a.id} a={it.a} bodyKg={bodyKg} />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One finished activity in the timeline — the type icon sits inline with the
 *  name; the date lives in the shared day column. */
function ActivityRow({ a, bodyKg }: { a: Activity; bodyKg: number | null }) {
  const { t } = useT();
  const [confirmDel, setConfirmDel] = useState(false);
  const cat = activityCategory(a);
  const kcal = a.calories ?? activityCalories(a, bodyKg);
  const min = Math.round(activityDurationMin(a));
  return (
    <div className={`hist-item hist-activity cat-${cat}`}>
      <span className="hist-item-body">
        <span className="hist-item-name">
          <Icon name={activityType(a.type)?.icon ?? 'heartbeat'} className="hist-act-icon" />
          {t.actType[a.type] ?? a.type}
        </span>
        <div className="hist-item-stats">
          {min} {t.minShort}
          {a.distanceKm ? ` · ${a.distanceKm} ${t.kmShort}` : ''} ·{' '}
          {cat === 'recovery' ? t.actRecovery : t.actConditioning}
        </div>
      </span>
      {kcal != null && (
        <span className="ta-kcal tnum">
          <Icon name="flame" weight="fill" />~{kcal}
        </span>
      )}
      <button
        className="ta-del"
        onClick={() => setConfirmDel(true)}
        aria-label={t.delete}
        title={t.delete}
      >
        <Icon name="trash" />
      </button>
      {confirmDel && (
        <ConfirmDialog
          title={t.actDeleteTitle}
          body={t.actDeleteBody}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteActivity(a.id);
            setConfirmDel(false);
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
