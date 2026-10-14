/**
 * Client 360 Workouts (S-04) and Strength (S-05): the raw record is plain data, `gateWorkouts` is the ONLY place
 * it is cut down to the client's consent (R-FE-061), so a locked category never reaches a component.
 *  - Workouts needs `totals` (sessions, minutes); `sets` adds sets, tonnage, PR and compliance + the recap.
 *  - Strength needs `sets` at Full (estimated 1RM is built from the sets).
 */
import { effectiveConsent } from './consent';
import { NOISE_KG } from './signalConfig';
import { DAY, weekStartOf } from './time';
import type { Consent, LogMode } from './types';

/** One logged set of a session (the per-set grid of the recap). */
export interface SetEntry {
  kg: number;
  reps: number;
  /** Rate of perceived exertion, 1-10 in halves; absent = not logged. */
  rpe?: number;
}

/** What was done in one exercise of a session, in the order it was done. */
export interface SessionExercise {
  /** Exercise name as a data label. */
  name: string;
  sets: readonly SetEntry[];
  /** What the plan prescribed for this exercise (absent = it was not planned): the logged sets are compared with it. */
  prescribed?: { sets: number; reps: number | null };
}

export interface WorkoutEntry {
  id: string;
  at: number;
  /** Session title as a data label ("Upper A"). */
  title: string;
  minutes: number;
  sets: number;
  tonnageKg: number;
  /** The session fell on a 1:1 trainer day of the client's assignment. */
  withTrainer: boolean;
  pr: boolean;
  /** Sets done against the plan, 0-100. */
  compliance: number;
  /** Name of the gym the session was logged at (a data label). Needs `sets` at Full like the grid; absent = not attached. */
  gym?: string;
  /**
   * The per-set grid of the recap. Needs `sets` at Full like `sets` / `tonnageKg`: `gateWorkouts` removes it at any
   * lower level, so a component never sees a set the client did not share. Absent = no set detail recorded.
   */
  exercises?: readonly SessionExercise[];
}

export interface ExerciseSession {
  at: number;
  sets: number;
  /** Best set of the session as "100x5". */
  top: string;
  e1rm: number;
  rpe: number;
}

export interface ExerciseResult {
  id: string;
  /** Exercise name as a data label. */
  name: string;
  /** Oldest first. */
  sessions: readonly ExerciseSession[];
}

/** A session the program has planned (trainer sessions are slots; this covers the client's own days too). */
export interface PlannedSession {
  at: number;
  title: string;
}

export interface ClientWorkouts {
  /** Newest first. */
  entries: readonly WorkoutEntry[];
  exercises: readonly ExerciseResult[];
  /** Upcoming program sessions, oldest first. */
  planned?: readonly PlannedSession[];
}

export type WorkoutsState = 'program' | 'locked' | 'totals' | 'full';
export type StrengthState = 'program' | 'locked' | 'ok';

export interface GatedWorkouts {
  state: WorkoutsState;
  /** Entries with the fields the level does not allow zeroed out and `detail` false. */
  entries: readonly WorkoutEntry[];
  detail: boolean;
}

export function gateWorkouts(
  data: ClientWorkouts | undefined,
  mode: LogMode,
  consent: Consent,
): GatedWorkouts {
  const c = effectiveConsent(mode, consent);
  if (mode === 'program') return { state: 'program', entries: [], detail: false };
  if (c.totals === 'off' || !data) return { state: 'locked', entries: [], detail: false };
  // Newest first whatever order the adapter delivers (history, week groups and the CSV all read this order).
  const newest = [...data.entries].sort((a, b) => b.at - a.at);
  if (c.sets === 'full') return { state: 'full', entries: newest, detail: true };
  return {
    state: 'totals',
    detail: false,
    entries: newest.map((entry) => {
      // The per-set detail is withheld; `exercises` is dropped from the entry.
      const { exercises, gym, ...e } = entry;
      void exercises;
      void gym;
      return { ...e, sets: 0, tonnageKg: 0, pr: false, compliance: 0 };
    }),
  };
}

export function gateStrength(
  data: ClientWorkouts | undefined,
  mode: LogMode,
  consent: Consent,
): { state: StrengthState; exercises: readonly ExerciseResult[] } {
  const c = effectiveConsent(mode, consent);
  if (mode === 'program') return { state: 'program', exercises: [] };
  if (c.sets !== 'full' || !data) return { state: 'locked', exercises: [] };
  return { state: 'ok', exercises: data.exercises };
}

/* ---- history by week ----------------------------------------------------------------------------------------- */
export interface WeekGroup {
  /** Monday 00:00 of the week (coach time zone, see `weekStartOf`). */
  start: number;
  items: WorkoutEntry[];
  sets: number;
  tonnageKg: number;
}

/** Entries (newest first) grouped by week, newest week first. */
export function groupByWeek(entries: readonly WorkoutEntry[]): WeekGroup[] {
  const out: WeekGroup[] = [];
  for (const e of entries) {
    const start = weekStartOf(e.at);
    const g = out.find((x) => x.start === start);
    if (g) {
      g.items.push(e);
      g.sets += e.sets;
      g.tonnageKg += e.tonnageKg;
    } else out.push({ start, items: [e], sets: e.sets, tonnageKg: e.tonnageKg });
  }
  return out;
}

/* ---- strength ------------------------------------------------------------------------------------------------ */
export type StrengthSort = 'recent' | 'change' | 'stalled';

export interface LiftRow {
  id: string;
  name: string;
  e1rm: number;
  lastAt: number;
  count: number;
  /** Estimated 1RM change over the last 4 weeks, kg. */
  change: number;
  stalled: boolean;
  /** `rising` only when the change reaches NOISE_KG: smaller moves are noise and stay neutral. */
  tone: 'rising' | 'stalled' | 'neutral';
  series: number[];
  sessions: readonly ExerciseSession[];
}

const WINDOW = 28 * DAY;

export function liftRow(x: ExerciseResult): LiftRow | null {
  // Oldest first whatever order the adapter delivers (the spark, the 4-week reference and the table rely on it).
  const s = [...x.sessions].sort((a, b) => a.at - b.at);
  if (!s.length) return null;
  const last = s[s.length - 1];
  /* The reference is the last session at least 4 weeks before the latest one. Without it (a short history) the
     change is measured from the first session and nothing can be called a stall yet. */
  const old = [...s].reverse().find((v) => v.at <= last.at - WINDOW);
  const ref = old ?? s[0];
  const change = Math.round((last.e1rm - ref.e1rm) * 10) / 10;
  const recent = s.filter((v) => v.at > last.at - WINDOW);
  const stalled = old != null && recent.length >= 3 && Math.abs(change) < NOISE_KG;
  return {
    id: x.id,
    name: x.name,
    e1rm: last.e1rm,
    lastAt: last.at,
    count: s.length,
    change,
    stalled,
    tone: stalled ? 'stalled' : change >= NOISE_KG ? 'rising' : 'neutral',
    series: s.map((v) => v.e1rm),
    sessions: s,
  };
}

export function liftRows(
  all: readonly ExerciseResult[],
  q: string,
  sort: StrengthSort,
): { rows: LiftRow[]; total: number; stalled: number } {
  const every = all.map(liftRow).filter((r): r is LiftRow => r !== null);
  const ql = q.trim().toLowerCase();
  const rows = every
    .filter((r) => !ql || r.name.toLowerCase().includes(ql))
    .sort((a, b) =>
      sort === 'recent'
        ? b.lastAt - a.lastAt || a.name.localeCompare(b.name)
        : sort === 'change'
          ? b.change - a.change || a.name.localeCompare(b.name)
          : Number(b.stalled) - Number(a.stalled) || a.change - b.change,
    );
  return { rows, total: every.length, stalled: every.filter((r) => r.stalled).length };
}

export { NOISE_KG };
export const SESSIONS_PAGE = 12;
