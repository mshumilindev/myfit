/**
 * A drawer for one calendar day, opened from the Today calendars (week strip and
 * program calendar). Shows that day's logged history — workouts, activities and
 * sleep, each opening its own detail — or, when a program day was skipped (and
 * it wasn't rest / illness / vacation), a "missed session" note.
 */
import { useState } from 'react';
import { Icon, Sheet } from '../ui';
import {
  dayKey,
  latestWeight,
  prescribedTrainingDays,
  programDayNameForWeekday,
  useStore,
  weekdayOf,
} from '../store';
import { fmtWeekdayDayMonth, useT } from '../i18n';
import { WorkoutRow, ActivityRow, SleepRow } from './HistoryTimeline';

export function DayHistorySheet({
  day,
  onClose,
  onOpenWorkout,
  onOpenActivity,
  onOpenSleep,
}: {
  /** Midnight (local) of the day to show. */
  day: number;
  onClose: () => void;
  onOpenWorkout?: (id: string) => void;
  onOpenActivity?: (id: string) => void;
  onOpenSleep?: (id: string) => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const end = day + 24 * 3600 * 1000;
  const [todayKey] = useState(() => dayKey(Date.now()));

  const workouts = store.workouts.filter(
    (w) => w.finishedAt !== null && w.startedAt >= day && w.startedAt < end,
  );
  const acts = store.activities.filter(
    (a) => a.finishedAt !== null && a.startedAt >= day && a.startedAt < end,
  );
  const sleeps = store.sleeps.filter((n) => n.wake !== null && n.wake >= day && n.wake < end);

  const dk = dayKey(day);
  const rest = store.restPeriods.find(
    (r) => dk >= r.startDay && dk <= (r.open ? todayKey : r.endDay),
  );
  const empty = workouts.length === 0 && acts.length === 0 && sleeps.length === 0;
  const missed = empty && !rest && prescribedTrainingDays().has(weekdayOf(day));
  const missedName = programDayNameForWeekday(weekdayOf(day));
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const wrap = (fn?: (id: string) => void) =>
    fn
      ? (id: string) => {
          onClose();
          fn(id);
        }
      : undefined;

  return (
    <Sheet onClose={onClose}>
      <div className="day-sheet-head">
        <span className="t">{fmtWeekdayDayMonth(day, locale)}</span>
      </div>
      {missed ? (
        <div className="day-sheet-missed">
          <span className="dsm-ic">
            <Icon name="x" />
          </span>
          <div className="dsm-text">
            <div className="dsm-title">{t.dayMissedTitle}</div>
            <div className="dsm-body">
              {missedName ? t.dayMissedNamed(missedName) : t.dayMissedGeneric}
            </div>
          </div>
        </div>
      ) : (
        <div className="hist-timeline day-sheet-items">
          {[...workouts]
            .sort((a, b) => a.startedAt - b.startedAt)
            .map((w) => (
              <WorkoutRow
                key={w.id}
                w={w}
                allWorkouts={store.workouts}
                bodyKg={bodyKg}
                onOpen={wrap(onOpenWorkout) ?? (() => {})}
              />
            ))}
          {[...acts]
            .sort((a, b) => a.startedAt - b.startedAt)
            .map((a) => (
              <ActivityRow key={a.id} a={a} bodyKg={bodyKg} onOpen={wrap(onOpenActivity)} />
            ))}
          {[...sleeps]
            .sort((a, b) => (a.wake ?? 0) - (b.wake ?? 0))
            .map((n) => (
              <SleepRow key={n.id} n={n} onOpen={wrap(onOpenSleep)} />
            ))}
        </div>
      )}
    </Sheet>
  );
}
