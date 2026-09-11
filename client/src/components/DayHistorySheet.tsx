/**
 * A drawer for one calendar day, opened from the Today calendars (week strip and
 * program calendar). Shows that day's logged history — workouts, activities and
 * sleep merged in chronological order (earliest on top), each opening its own
 * detail — plus a note when the day was rest / vacation / illness, or a "missed
 * session" note when a program day was skipped.
 */
import { useState, type ReactNode } from 'react';
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
import { workoutCalories, activityCalories } from '../activities';

type NoteState = 'missed' | 'rest' | 'vacation' | 'illness';

const NOTE_ICON: Record<NoteState, string> = {
  missed: 'x',
  rest: 'moon',
  vacation: 'sun-horizon',
  illness: 'pulse',
};
const NOTE_COLOR: Record<NoteState, string> = {
  missed: 'var(--color-danger)',
  rest: 'var(--color-rest-400)',
  vacation: '#e8933f',
  illness: 'var(--care)',
};

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
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const wrap = (fn?: (id: string) => void) =>
    fn
      ? (id: string) => {
          onClose();
          fn(id);
        }
      : undefined;

  // Every logged thing on the day, merged and sorted earliest-first.
  const rows: { ts: number; node: ReactNode }[] = [];
  for (const w of store.workouts)
    if (w.finishedAt !== null && w.startedAt >= day && w.startedAt < end)
      rows.push({
        ts: w.startedAt,
        node: (
          <WorkoutRow
            key={w.id}
            w={w}
            allWorkouts={store.workouts}
            bodyKg={bodyKg}
            onOpen={wrap(onOpenWorkout) ?? (() => {})}
          />
        ),
      });
  for (const a of store.activities)
    if (a.finishedAt !== null && a.startedAt >= day && a.startedAt < end)
      rows.push({
        ts: a.startedAt,
        node: <ActivityRow key={a.id} a={a} bodyKg={bodyKg} onOpen={wrap(onOpenActivity)} />,
      });
  for (const n of store.sleeps)
    if (n.wake !== null && n.wake >= day && n.wake < end)
      rows.push({
        ts: n.wake,
        node: <SleepRow key={n.id} n={n} onOpen={wrap(onOpenSleep)} />,
      });
  rows.sort((a, b) => a.ts - b.ts);

  // Day energy: the persisted resting/baseline burn for the day (present only
  // from the day this feature shipped — never backfilled) plus the active burn
  // of everything logged that day. Shown when either is available.
  const restKcal = store.energyDays[String(dayKey(day))]?.restKcal ?? null;
  let activeKcal = 0;
  for (const w of store.workouts)
    if (w.finishedAt !== null && w.startedAt >= day && w.startedAt < end)
      activeKcal += workoutCalories(w, bodyKg) ?? 0;
  for (const a of store.activities)
    if (a.finishedAt !== null && a.startedAt >= day && a.startedAt < end)
      activeKcal += activityCalories(a, bodyKg) ?? 0;
  activeKcal = Math.round(activeKcal);
  const totalKcal = (restKcal ?? 0) + activeKcal;
  const showEnergy = restKcal != null || activeKcal > 0;

  // Day state note (rest / vacation / illness, or a skipped program day).
  const dk = dayKey(day);
  const rest = store.restPeriods.find(
    (r) => dk >= r.startDay && dk <= (r.open ? todayKey : r.endDay),
  );
  const restSpan = rest ? (rest.open ? todayKey : rest.endDay) - rest.startDay + 1 : 0;
  let note: NoteState | null = null;
  if (rest) note = rest.mode === 'illness' ? 'illness' : restSpan >= 4 ? 'vacation' : 'rest';
  else if (rows.length === 0 && prescribedTrainingDays().has(weekdayOf(day))) note = 'missed';

  const missedName = programDayNameForWeekday(weekdayOf(day));
  const noteText: Record<NoteState, { title: string; body: string }> = {
    missed: {
      title: t.dayMissedTitle,
      body: missedName ? t.dayMissedNamed(missedName) : t.dayMissedGeneric,
    },
    rest: { title: t.histStateRest, body: t.dayRestBody },
    vacation: { title: t.histStateVacation, body: t.dayVacationBody },
    illness: { title: t.histStateSick, body: t.daySickBody },
  };

  return (
    <Sheet onClose={onClose}>
      <div className="day-sheet-head">
        <span className="t">{fmtWeekdayDayMonth(day, locale)}</span>
      </div>
      {note && (
        <div className="day-sheet-note" style={{ ['--nc' as string]: NOTE_COLOR[note] }}>
          <span className="dsm-ic">
            <Icon name={NOTE_ICON[note]} />
          </span>
          <div className="dsm-text">
            <div className="dsm-title">{noteText[note].title}</div>
            <div className="dsm-body">{noteText[note].body}</div>
          </div>
        </div>
      )}
      {showEnergy && (
        <div className="day-energy">
          <span className="de-ic">
            <Icon name="flame" weight="fill" />
          </span>
          <div className="de-body">
            <div className="de-total tnum">
              ~{totalKcal.toLocaleString(locale)} <span className="de-unit">{t.kcalShort}</span>
            </div>
            <div className="de-break">
              {restKcal != null ? t.dayEnergyResting(restKcal) : ''}
              {restKcal != null && activeKcal > 0 ? ' · ' : ''}
              {activeKcal > 0 ? t.dayEnergyActive(activeKcal) : ''}
            </div>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="hist-timeline day-sheet-items">{rows.map((r) => r.node)}</div>
      )}
    </Sheet>
  );
}
