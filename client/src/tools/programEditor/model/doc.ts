/**
 * The program document: plain, JSON-serialisable data, owned by the tool. A host program (Coach plan, the app's own
 * `Program`) is structurally a `ProgramDoc` plus fields the tool never reads; every operation here spreads the input,
 * so host-only fields (ids, status, sealed blobs) survive a round trip untouched.
 *
 * Weekdays are ISO numbers: 1 = Monday .. 7 = Sunday. `dayNames` and `targetMuscles` are keyed by the day as a string.
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'lats'
  | 'traps'
  | 'lower_back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'glutes'
  | 'abductors'
  | 'calves'
  | 'core'
  | 'neck'
  | 'fullbody'
  | 'cardio';

export type ExerciseKind = 'strength' | 'cardio' | 'warmup' | 'cooldown';
export type ActivityEffort = 'light' | 'moderate' | 'hard';
export type ActivityWhen = 'any' | 'before' | 'after';
export type DayMode = 'muscles' | 'exercises';
export type Dow = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DOW_OF_ISO: readonly Dow[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ISO_OF_DOW: Record<Dow, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const dowOf = (iso: number): Dow => DOW_OF_ISO[iso - 1];

export interface WarmupExerciseDoc {
  id: string;
  name: string;
  exerciseId?: string;
  reps?: number;
  durationSec?: number;
  weight?: number;
}

export interface ProgramItemDoc {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: string[];
  groupId?: string | null;
  groupOrder?: number | null;
  dropLast?: boolean;
  warmupItems?: WarmupExerciseDoc[];
  /** "Just the exercise": no sets, reps or targets (stored as sets 0 / reps 0). */
  bare?: boolean;
  targetWeight?: number;
  targetRpe?: number;
  /** Rest between sets, seconds. */
  restSec?: number;
  /** A cue shown above the set. */
  note?: string;
}

export interface ProgramActivityDoc {
  id: string;
  day: number;
  /** Key in the host's activity catalog. */
  type: string;
  minutes: number;
  effort: ActivityEffort;
  when: ActivityWhen;
}

export interface ProgramDoc {
  name: string;
  /** Per-day name, keyed by weekday ("1" = Monday). */
  dayNames: Record<string, string>;
  /** Per-day target muscles; only a day WITHOUT exercises keeps them (an exercises day derives its muscles). */
  targetMuscles: Record<string, MuscleGroup[]>;
  items: ProgramItemDoc[];
  activities?: ProgramActivityDoc[];
}

/** Per-host view of the calendar: the order the training week is read in (a user's week-start setting). */
export interface DocEnv {
  weekOrder?: readonly number[];
}
const MON_FIRST: readonly number[] = WEEKDAYS;
const weekOrderOf = (env?: DocEnv): readonly number[] => env?.weekOrder ?? MON_FIRST;

/* ---- reading ------------------------------------------------------------------------------------------------- */

/** A bare row asks for no sets. */
export const isBare = (i: Pick<ProgramItemDoc, 'kind' | 'sets'> & { bare?: boolean }): boolean =>
  i.kind === 'strength' && (i.bare === true || i.sets <= 0);

/** Sets a row asks for: a bare row asks for none. */
export const effectiveSets = (
  i: Pick<ProgramItemDoc, 'kind' | 'sets'> & { bare?: boolean },
): number => (i.kind === 'strength' && !isBare(i) ? i.sets : 0);

export function dayItems(p: ProgramDoc, day: number): ProgramItemDoc[] {
  return p.items.filter((i) => i.day === day).sort((a, b) => a.position - b.position);
}

/** Strength lifts only: markers and cardio are their own item types. */
export function dayExercises(p: ProgramDoc, day: number): ProgramItemDoc[] {
  return dayItems(p, day).filter((i) => i.kind === 'strength');
}

export function dayActivities(p: ProgramDoc, day: number): ProgramActivityDoc[] {
  return (p.activities ?? []).filter((a) => a.day === day);
}

export function dayName(p: ProgramDoc, day: number): string {
  return p.dayNames?.[String(day)]?.trim() ?? '';
}

/** A weekday trains when it prescribes anything: items, muscles or a name. */
export function isTrainingDay(p: ProgramDoc, day: number): boolean {
  return (
    p.items.some((i) => i.day === day) ||
    (p.targetMuscles?.[String(day)]?.length ?? 0) > 0 ||
    !!dayName(p, day)
  );
}

/** Training days in the host's training-week order. */
export function trainingDays(p: ProgramDoc, env?: DocEnv): number[] {
  return weekOrderOf(env).filter((d) => isTrainingDay(p, d));
}

/** A day holding any exercise/cardio/marker item is an exercises day. */
export function dayMode(p: ProgramDoc, day: number): DayMode {
  return p.items.some((i) => i.day === day) ? 'exercises' : 'muscles';
}

export function setCount(items: ProgramItemDoc[]): number {
  return items.reduce((n, it) => n + effectiveSets(it), 0);
}

export const programSets = (p: ProgramDoc, day?: number): number =>
  p.items
    .filter((i) => (day == null || i.day === day) && i.kind === 'strength' && !isBare(i))
    .reduce((n, i) => n + i.sets, 0);

/** "A1", "B2"... per day, in order of first appearance. */
export function supersetLabels(items: ProgramItemDoc[]): Map<string, string> {
  const letters = new Map<string, number>();
  const out = new Map<string, string>();
  for (const it of items) {
    if (!it.groupId) continue;
    if (!letters.has(it.groupId)) letters.set(it.groupId, letters.size);
    out.set(
      it.id,
      `${String.fromCharCode(65 + letters.get(it.groupId)!)}${(it.groupOrder ?? 0) + 1}`,
    );
  }
  return out;
}

/** Every target muscle: what "Full body" switches on. */
export const ALL_MUSCLES: MuscleGroup[] = [
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'abductors',
  'calves',
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'forearms',
  'neck',
  'fullbody',
];

/** An empty document (a host starting a new program). */
export const emptyDoc = (name = ''): ProgramDoc => ({
  name,
  dayNames: {},
  targetMuscles: {},
  items: [],
});

/** Items sorted and re-numbered per day (positions 0..n-1), equipment never undefined. */
export function normalizeItems(items: ProgramItemDoc[]): ProgramItemDoc[] {
  const seen = new Map<number, number>();
  return [...items]
    .sort((a, b) => a.day - b.day || a.position - b.position)
    .map((item) => {
      const next = seen.get(item.day) ?? 0;
      seen.set(item.day, next + 1);
      return { ...item, position: next, equipment: item.equipment ?? [] };
    });
}
