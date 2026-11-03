import { useCallback, useEffect, useState } from 'react';
import { useCallsT } from '../i18n/calls';
import { navigateHash } from '../navigateHash';
import { cooldownInProgress, isMarkerExercise, useStore } from '../store';
import type { Workout } from '../types';
import { useExerciseName } from '../ui';

/** The route of the open workout (`App.toHash` for the `session` overlay). */
export const SESSION_HASH = '#/session';

export interface WorkoutChipData {
  /** Raw (catalog) name of the exercise being worked, null when the session has none yet. */
  exercise: string | null;
  /** Number of the set that is next (1-based) or, when every planned set is logged, the last one. */
  setNo: number;
  /** Planned sets of that exercise, null when unplanned. */
  planned: number | null;
  /** Seconds since the last logged set while rest runs (off in a cool-down), else null. */
  restSec: number | null;
  /** Seconds since the session started. */
  elapsedSec: number;
}

const secs = (ms: number) => Math.max(0, Math.floor(ms / 1000));

/**
 * Where the person is in an open workout, derived the same way the session screen does: "current" is the exercise of the
 * most recent set while it still has sets to go, else the first unfinished one by position. Rest counts up from the last
 * logged set (it is derived, not stored), so it is exact after a reload and while the call hides the session.
 */
export function workoutChipData(w: Workout, now: number): WorkoutChipData {
  const lifts = [...w.exercises]
    .filter((e) => !isMarkerExercise(e))
    .sort((a, b) => a.position - b.position);
  let lastAt = 0;
  let lastId: string | null = null;
  for (const e of lifts)
    for (const s of e.sets)
      if ((s.loggedAt ?? 0) > lastAt) {
        lastAt = s.loggedAt ?? 0;
        lastId = e.id;
      }
  const planned = (e: (typeof lifts)[number]) => Math.max(0, e.plannedSets ?? 0);
  const going = (e: (typeof lifts)[number]) =>
    planned(e) > 0 ? e.sets.length < planned(e) : e.sets.length === 0;
  const last = lastId ? lifts.find((e) => e.id === lastId) : undefined;
  const cur =
    (last && (planned(last) > 0 ? last.sets.length < planned(last) : true) ? last : undefined) ??
    lifts.find(going) ??
    last ??
    lifts[0];
  const p = cur ? planned(cur) : 0;
  const done = cur?.sets.length ?? 0;
  const restRunning = lastAt > 0 && !cooldownInProgress(w);
  return {
    exercise: cur?.name ?? null,
    setNo: p > 0 ? Math.min(done + 1, p) : done + 1,
    planned: p > 0 ? p : null,
    restSec: restRunning ? secs(now - lastAt) : null,
    elapsedSec: secs(now - w.startedAt),
  };
}

export const clock = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export interface WorkoutChip {
  title: string;
  detail: string;
  time: string;
  /** Opens the session screen. */
  open: () => void;
}

/** The open workout as the `CallSessionChip` props, ticking every second; null when no workout is open. */
export function useWorkoutChip(): WorkoutChip | null {
  const store = useStore();
  const { cl } = useCallsT();
  const exName = useExerciseName();
  const w = store.workouts.find((x) => x.finishedAt === null) ?? null;
  const [now, setNow] = useState(() => Date.now());
  const on = w !== null;
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  const open = useCallback(() => navigateHash(SESSION_HASH), []);
  if (!w) return null;
  const d = workoutChipData(w, now);
  const setText = cl.callSessionSet(d.planned ? `${d.setNo}/${d.planned}` : String(d.setNo));
  return {
    title: d.exercise ? exName(d.exercise) : cl.callSessionLabel,
    detail: d.exercise ? (d.restSec !== null ? `${setText} · ${cl.callSessionRest}` : setText) : '',
    time: clock(d.restSec ?? d.elapsedSec),
    open,
  };
}
