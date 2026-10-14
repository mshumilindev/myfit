/**
 * CSV for the Coach exports (Workouts, Strength, Decisions). Pure: columns are ids (the UI localises the header),
 * and a category the client has not shared never produces a column: it is listed in `omitted` instead, so the
 * menu can say "Left out: ...". Cells that look like formulas are neutralised (CSV injection).
 */
import type { DecisionRecord, OutcomeResult } from './decisions';
import type { LiftRow, WorkoutEntry } from './workouts';

export interface CsvSpec<C extends string = string> {
  columns: readonly C[];
  /** Columns dropped because the data is not shared with the coach. */
  omitted: readonly C[];
  rows: readonly (readonly string[])[];
}

const cell = (v: string): string => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Header (already localised) + rows -> text. UTF-8 BOM is added by the download helper, not here. */
export function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
const kg1 = (n: number): string => String(Math.round(n * 10) / 10);

export type WorkoutsCol =
  'date' | 'session' | 'minutes' | 'sets' | 'tonnage' | 'pr' | 'compliance' | 'trainer';
const WORKOUTS_ALL: readonly WorkoutsCol[] = [
  'date',
  'session',
  'minutes',
  'trainer',
  'sets',
  'tonnage',
  'pr',
  'compliance',
];
const WORKOUTS_DETAIL: readonly WorkoutsCol[] = ['sets', 'tonnage', 'pr', 'compliance'];

export function workoutsCsv(
  entries: readonly WorkoutEntry[],
  detail: boolean,
): CsvSpec<WorkoutsCol> {
  const columns = WORKOUTS_ALL.filter((c) => detail || !WORKOUTS_DETAIL.includes(c));
  const omitted = WORKOUTS_ALL.filter((c) => !columns.includes(c));
  const val = (e: WorkoutEntry, c: WorkoutsCol): string => {
    switch (c) {
      case 'date':
        return iso(e.at);
      case 'session':
        return e.title;
      case 'minutes':
        return String(e.minutes);
      case 'trainer':
        return e.withTrainer ? 'yes' : 'no';
      case 'sets':
        return String(e.sets);
      case 'tonnage':
        return String(Math.round(e.tonnageKg));
      case 'pr':
        return e.pr ? 'yes' : 'no';
      case 'compliance':
        return String(e.compliance);
    }
  };
  return { columns, omitted, rows: entries.map((e) => columns.map((c) => val(e, c))) };
}

export type SetsCol = 'date' | 'session' | 'exercise' | 'set' | 'kg' | 'reps' | 'rpe';
const SETS_COLS: readonly SetsCol[] = ['date', 'session', 'exercise', 'set', 'kg', 'reps', 'rpe'];

/**
 * One row per logged set (the recap's per-set grid). Needs `sets` at Full: call it only with entries from
 * `gateWorkouts` in the `full` state (below that an entry has no `exercises`, so the file has no rows).
 */
export function setsCsv(entries: readonly WorkoutEntry[]): CsvSpec<SetsCol> {
  const rows = entries.flatMap((e) =>
    (e.exercises ?? []).flatMap((x) =>
      x.sets.map((s, i) => [
        iso(e.at),
        e.title,
        x.name,
        String(i + 1),
        kg1(s.kg),
        String(s.reps),
        s.rpe == null ? '' : kg1(s.rpe),
      ]),
    ),
  );
  return { columns: SETS_COLS, omitted: [], rows };
}

export type StrengthCol = 'exercise' | 'date' | 'sets' | 'top' | 'e1rm' | 'rpe';
const STRENGTH_COLS: readonly StrengthCol[] = ['exercise', 'date', 'sets', 'top', 'e1rm', 'rpe'];

/** One row per exercise session, newest first within an exercise. */
export function strengthCsv(lifts: readonly LiftRow[]): CsvSpec<StrengthCol> {
  const rows = lifts.flatMap((l) =>
    [...l.sessions]
      .reverse()
      .map((s) => [l.name, iso(s.at), String(s.sets), s.top, kg1(s.e1rm), kg1(s.rpe)]),
  );
  return { columns: STRENGTH_COLS, omitted: [], rows };
}

export type DecisionsCol = 'date' | 'client' | 'decision' | 'result' | 'followup';
const DECISIONS_COLS: readonly DecisionsCol[] = [
  'date',
  'client',
  'decision',
  'result',
  'followup',
];

export interface DecisionCsvRow {
  rec: DecisionRecord;
  client: string;
  title: string;
  result: OutcomeResult | 'waiting';
  resultLabel: string;
  followupLabel: string;
}

export function decisionsCsv(rows: readonly DecisionCsvRow[]): CsvSpec<DecisionsCol> {
  return {
    columns: DECISIONS_COLS,
    omitted: [],
    rows: rows.map((r) => [
      iso(r.rec.decidedAt),
      r.client,
      r.title,
      r.resultLabel,
      r.followupLabel,
    ]),
  };
}
