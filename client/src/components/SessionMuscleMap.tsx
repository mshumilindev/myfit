/**
 * Session muscle map — a full-body, colour-coded picture of where each muscle
 * stands this week (today's sets included), plus day-relative hints: what's
 * still worth training today, what to ease off, and what's already covered.
 *
 * Grading combines two references (design confirmed with the user):
 *   • the science-based weekly landmarks (MEV/MAV/MRV), personalised to history,
 *     drive the body-map colours — so "too much" is honest across the week; and
 *   • this training day's own history (median sets per muscle on the same
 *     program day) drives the "still worth doing today" targets.
 */
import { useMemo, useState } from 'react';
import { Sheet, Icon } from '../ui';
import { useT } from '../i18n';
import { useStore, muscleSetsInWorkout, programDayNameFor } from '../store';
import { personalLandmarks } from '../personalize';
import {
  LANDMARKS,
  VOLUME_MUSCLES,
  ZONE_COLOR,
  classifyZone,
  weeklyMuscleSets,
  type Zone,
} from '../volume';
import { MuscleHeatmap } from './Muscle';
import type { MuscleGroup } from '../data/exercises';
import type { Workout } from '../types';

type TodoHint = { muscle: MuscleGroup; sets: number | null; color: string };
type EaseHint = { muscle: MuscleGroup; over: boolean; color: string };
type DoneHint = { muscle: MuscleGroup; color: string };

export function SessionMuscleMap({
  workout,
  now: nowProp,
  onClose,
  onOpenMuscle,
}: {
  workout: Workout;
  now: number;
  onClose: () => void;
  onOpenMuscle?: (m: MuscleGroup) => void;
}) {
  const { t } = useT();
  const store = useStore();
  // Freeze the clock at open time — the volume window is day-scale, so a second
  // ticking by must not re-grade the map underfoot.
  const [now] = useState(nowProp);

  const { colors, todo, ease, done } = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const landmarks = personalLandmarks(finished, now);
    const weekly = weeklyMuscleSets(finished, now, 7);
    const today = muscleSetsInWorkout(workout);

    // Body-map colours: this week's sets (today included) vs each muscle's range.
    const colorMap: Partial<Record<MuscleGroup, string>> = {};
    const zoneOf = new Map<MuscleGroup, Zone>();
    for (const m of VOLUME_MUSCLES) {
      const lm = landmarks.get(m) ?? LANDMARKS[m];
      if (!lm) continue;
      const sets = (weekly.get(m) ?? 0) + (today.get(m) ?? 0);
      const zone = classifyZone(sets, lm);
      zoneOf.set(m, zone);
      if (zone !== 'none') colorMap[m] = ZONE_COLOR[zone];
    }

    // "This training day" history — same program day (by name, else weekday).
    const dayName = programDayNameFor(workout, store.workouts);
    const weekday = new Date(workout.startedAt).getDay();
    const daySessions = finished.filter((w) => {
      if (w.id === workout.id) return false;
      return dayName
        ? programDayNameFor(w, store.workouts) === dayName
        : new Date(w.startedAt).getDay() === weekday;
    });
    const dayTypical = (m: MuscleGroup): number => {
      const vals = daySessions
        .map((w) => muscleSetsInWorkout(w).get(m) ?? 0)
        .filter((v) => v > 0)
        .sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : 0;
    };

    const targets = (workout.targetMuscles ?? []).filter((m): m is MuscleGroup =>
      VOLUME_MUSCLES.includes(m as MuscleGroup),
    );
    const scope = new Set<MuscleGroup>(targets);
    for (const m of VOLUME_MUSCLES) {
      if (dayTypical(m) > 0 || (today.get(m) ?? 0) > 0) scope.add(m);
    }

    const todoOut: TodoHint[] = [];
    const easeOut: EaseHint[] = [];
    const doneOut: DoneHint[] = [];
    for (const m of scope) {
      const doneToday = today.get(m) ?? 0;
      const typical = dayTypical(m);
      const zone = zoneOf.get(m) ?? 'none';
      const color = ZONE_COLOR[zone === 'none' ? 'under' : zone];
      const remaining = Math.max(0, Math.round(typical - doneToday));
      if (zone === 'over') {
        easeOut.push({ muscle: m, over: true, color: ZONE_COLOR.over });
      } else if (remaining >= 1) {
        todoOut.push({ muscle: m, sets: remaining, color });
      } else if (typical === 0 && doneToday === 0 && targets.includes(m)) {
        todoOut.push({ muscle: m, sets: null, color });
      } else if (zone === 'high' && doneToday > 0) {
        easeOut.push({ muscle: m, over: false, color: ZONE_COLOR.high });
      } else if (doneToday > 0) {
        doneOut.push({ muscle: m, color: ZONE_COLOR.productive });
      }
    }
    todoOut.sort((a, b) => (b.sets ?? 99) - (a.sets ?? 99));

    return { colors: colorMap, todo: todoOut, ease: easeOut, done: doneOut };
  }, [workout, store.workouts, now]);

  const empty = todo.length === 0 && ease.length === 0;

  const row = (muscle: MuscleGroup, color: string, detail: string, key: string) => (
    <button
      key={key}
      className="mm-hint"
      onClick={() => onOpenMuscle?.(muscle)}
      disabled={!onOpenMuscle}
    >
      <span className="mm-dot" style={{ background: color }} />
      <span className="mm-hint-name">{t.muscleGroups[muscle]}</span>
      <span className="mm-hint-detail">{detail}</span>
    </button>
  );

  return (
    <Sheet className="muscle-map-sheet" onClose={onClose}>
      <div className="sheet-label">{t.muscleMapTitle}</div>
      <div className="mm-map">
        <MuscleHeatmap colors={colors} />
      </div>
      <div className="vol-legend mm-legend">
        {(['under', 'productive', 'high', 'over'] as Zone[]).map((z) => (
          <span key={z} className="vol-leg">
            <span className="sw" style={{ background: ZONE_COLOR[z] }} />
            {t.volZone[z]}
          </span>
        ))}
      </div>
      <div className="mm-note">{t.muscleMapWeekNote}</div>

      {empty && done.length === 0 ? null : (
        <div className="mm-hints">
          {todo.length > 0 && (
            <div className="mm-group">
              <div className="mm-group-label">{t.muscleMapTodo}</div>
              {todo.map((h) =>
                row(
                  h.muscle,
                  h.color,
                  h.sets != null ? t.muscleMapSetsLeft(h.sets) : t.muscleMapPlanned,
                  `todo-${h.muscle}`,
                ),
              )}
            </div>
          )}
          {ease.length > 0 && (
            <div className="mm-group">
              <div className="mm-group-label">{t.muscleMapEase}</div>
              {ease.map((h) =>
                row(
                  h.muscle,
                  h.color,
                  h.over ? t.muscleMapOver : t.muscleMapNearLimit,
                  `ease-${h.muscle}`,
                ),
              )}
            </div>
          )}
          {done.length > 0 && (
            <div className="mm-done">
              <Icon name="check" />
              <span>
                {t.muscleMapDone}: {done.map((h) => t.muscleGroups[h.muscle]).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
      {empty && <div className="mm-covered">{t.muscleMapCovered}</div>}
    </Sheet>
  );
}
