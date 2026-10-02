/** Small shared bits of the Home set screen: names, "Last: …" labels, the live lock. */
import { fmtClock, fmtDayMonth, fmtWeekdayShort, useT } from '../../i18n';
import { liveSleep, useStore } from '../../store';
import type { HomeMove } from '../../homeSets';
import { useExerciseName } from '../../ui';

export function useMoveName() {
  const exName = useExerciseName();
  return (m: HomeMove) => (m.custom ? m.name : exName(m.name));
}

export function useMuscleName() {
  const { t } = useT();
  return (g: string) => (t.muscleGroups as Record<string, string>)[g] ?? g;
}

export function useLastLabel() {
  const { t, locale } = useT();
  return (at: number, min: number): string => {
    const d = new Date(at);
    const today = new Date();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const when = same(d, today)
      ? `${t.homeToday}, ${fmtClock(at)}`
      : same(d, y)
        ? `${t.homeYesterday}, ${fmtClock(at)}`
        : `${fmtWeekdayShort(at, locale)} ${fmtDayMonth(at, locale)}`;
    return t.homeLastRun(when, min);
  };
}

/**
 * One live thing at a time: while a session (with an exercise), an activity or a sleep
 * runs, nothing else can start. `liveName` is what to finish first.
 */
export function useLiveLock() {
  const { t } = useT();
  const store = useStore();
  const open = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const liveAct = store.activities.find((a) => a.finishedAt === null) ?? null;
  const sleepLive = liveSleep(store.sleeps);
  const busy = !!open || !!liveAct || !!sleepLive;
  const locked = (!!open && open.exercises.length > 0) || !!liveAct || !!sleepLive;
  const liveName = open
    ? open.dayName || t.startSessionLabel
    : liveAct
      ? (t.actType[liveAct.type] ?? liveAct.type)
      : sleepLive
        ? t.sleepTitle
        : '';
  return { open, liveAct, sleepLive, busy, locked, liveName };
}
