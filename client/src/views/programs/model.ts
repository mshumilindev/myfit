/**
 * Programs — data model and pure helpers for the builder (design "Spotter —
 * Programs Redesign", direction V06 "Big tiles").
 *
 * A program is a name, a length (N weeks, or 0 = ongoing) and one week of seven
 * weekdays. Every training day is defined EITHER by target muscles OR by
 * exercises: once a day holds exercises its muscles are derived from them and
 * are read-only; a muscles day carries no exercises. Warm-up and cool-down are
 * markers (nothing to log), cardio is a timed item — both sit beside the
 * exercises, not among them.
 */
import type { ActivityEffort, ExerciseKind } from '../../types';
import { activityType } from '../../activities';
import type { VaultEnvelope } from '../../vaultCrypto';
import type { EquipmentId } from '../../data/equipment';
import type { MuscleGroup } from '../../data/exercises';
import { weekOrder } from '../../weekStart';
import { sanitizeWarmupItems } from '../../tools/programEditor';

/**
 * An exercise of a program day's warm-up: a reference to an exercise the app
 * already has (its canonical catalog name + id) with an optional target — reps
 * OR seconds. No free text: program items are stored like the lifts already are
 * (catalog names), nothing new that a person types.
 */
export interface ProgramWarmupItem {
  id: string;
  name: string;
  exerciseId?: string;
  reps?: number;
  durationSec?: number;
  /** Target load in kg (weighted moves only; optional, old data has none). */
  weight?: number;
}

export interface ProgramItem {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
  groupId?: string | null;
  groupOrder?: number | null;
  dropLast?: boolean;
  /** Warm-up marker only: the exercises it holds (absent = a generic warm-up). */
  warmupItems?: ProgramWarmupItem[];
  /**
   * Trainer layer (Coach editor). "Just the exercise": no sets, reps or targets; stored as sets 0 / reps 0.
   * A bare row is valid to save, assign and send; the client picks the numbers in the session.
   */
  bare?: boolean;
  /** Optional targets shown to the client above the set (absent = no target). */
  targetWeight?: number;
  targetRpe?: number;
  /** Rest between sets, seconds. */
  restSec?: number;
  /** A cue shown above the set. */
  note?: string;
}

/** A bare row asks for no sets (R-FE-051). */
export const isBare = (i: Pick<ProgramItem, 'kind' | 'sets'> & { bare?: boolean }): boolean =>
  i.kind === 'strength' && (i.bare === true || i.sets <= 0);

/** Sets a row asks for: a bare row asks for none. */
export const effectiveSets = (
  i: Pick<ProgramItem, 'kind' | 'sets'> & { bare?: boolean },
): number => (i.kind === 'strength' && !isBare(i) ? i.sets : 0);

/**
 * Compact day summary ("3 × 5", "16", "20 min"). Prints nothing for a bare row / a day with no sets
 * (R-KIT-08: it used to print "0 x 0").
 */
export function compactProgramDaySummary(
  items: (Pick<ProgramItem, 'kind' | 'sets' | 'reps' | 'durationMin'> & { bare?: boolean })[],
): string {
  const strength = items.filter((item) => item.kind === 'strength');
  if (strength.length === 0) {
    const totalMin = items.reduce((sum, item) => sum + (item.durationMin ?? 10), 0);
    return `${totalMin} min`;
  }
  const sets = strength.reduce((sum, item) => sum + effectiveSets(item), 0);
  if (sets === 0) return '';
  const reps = strength.length === 1 ? strength[0].reps : null;
  return reps ? `${sets} × ${reps}` : String(sets);
}

/** When in the day a planned activity sits relative to the lifting. */
export type ProgramActivityWhen = 'any' | 'before' | 'after';

/**
 * A planned activity (run, yoga, padel …) on a weekday. Kept apart from the
 * lifting `items` on purpose: trainer assignment, CSV, the session builder and
 * workout start only ever read `items`, so activities can't change them. Only
 * catalog keys and numbers — nothing a person types.
 */
export interface ProgramActivity {
  id: string;
  day: number;
  /** Key in ACTIVITY_TYPES. */
  type: string;
  minutes: number;
  effort: ActivityEffort;
  when: ProgramActivityWhen;
}

export type ProgramStatus = 'draft' | 'active' | 'archived';

export interface Program {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  status: ProgramStatus;
  authorId: string;
  dayNames: Record<string, string>;
  /** Per-day target muscles, keyed by weekday number (Mon = "1"). Only a day
   *  WITHOUT exercises keeps them — an exercises day derives its muscles. */
  targetMuscles: Record<string, MuscleGroup[]>;
  items: ProgramItem[];
  /** Planned activities beside the lifting (absent on programs without any). */
  activities?: ProgramActivity[];
  /** The stored (sealed) form of `activities`; present when the list is encrypted. */
  activitiesEnc?: VaultEnvelope;
  updatedAt?: number;
}

export interface ProgramAssignment {
  program: Program;
  assignedBy: string | null;
  startedAt: number;
  week: number;
  done: number;
  total: number;
  expectedSoFar: number;
  adherence: number | null;
}

export interface Person {
  id: string;
  name: string;
  avatar?: boolean;
  avatarRev?: number;
}

export type DayMode = 'muscles' | 'exercises';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function freshProgram(name: string): Program {
  return {
    id: crypto.randomUUID(),
    name,
    weeks: 8,
    daysPerWeek: 0,
    status: 'draft',
    authorId: '',
    dayNames: {},
    targetMuscles: {},
    items: [],
  };
}

/** Coerce stored (or absent / malformed) warm-up exercises to a clean list (the editor tool owns the rule). */
export { sanitizeWarmupItems };

export function normalizeItems(items: ProgramItem[]): ProgramItem[] {
  const seen = new Map<number, number>();
  return [...items]
    .sort((a, b) => a.day - b.day || a.position - b.position)
    .map((item) => {
      const next = seen.get(item.day) ?? 0;
      seen.set(item.day, next + 1);
      const { warmupItems: rawWarm, ...rest } = item;
      const warm = item.kind === 'warmup' ? sanitizeWarmupItems(rawWarm) : [];
      return {
        ...rest,
        position: next,
        equipment: item.equipment ?? [],
        ...(warm.length ? { warmupItems: warm } : {}),
      };
    });
}

/** Coerce a stored (or legacy/absent) target-muscle map to a clean shape. */
export function sanitizeTargetMuscles(tm: unknown): Record<string, MuscleGroup[]> {
  const out: Record<string, MuscleGroup[]> = {};
  if (tm && typeof tm === 'object') {
    for (const [day, v] of Object.entries(tm as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const cleaned = v.filter((x): x is MuscleGroup => typeof x === 'string');
        if (cleaned.length) out[day] = cleaned;
      }
    }
  }
  return out;
}

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];
const WHENS: ProgramActivityWhen[] = ['any', 'before', 'after'];
const MAX_ACTIVITIES = 28;

function positive(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** Coerce stored (or absent / malformed) planned activities to a clean list. */
export function sanitizeActivities(raw: unknown): ProgramActivity[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramActivity[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const type = typeof r.type === 'string' ? r.type : '';
    const day = Number(r.day);
    const minutes = positive(r.minutes);
    if (!activityType(type) || !Number.isInteger(day) || day < 1 || day > 7 || !minutes) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
      day,
      type,
      minutes: Math.min(600, minutes),
      effort: EFFORTS.includes(r.effort as ActivityEffort)
        ? (r.effort as ActivityEffort)
        : 'moderate',
      when: WHENS.includes(r.when as ProgramActivityWhen) ? (r.when as ProgramActivityWhen) : 'any',
    });
    if (out.length >= MAX_ACTIVITIES) break;
  }
  return out;
}

/** A day's planned activities, in stored order. */
export function dayActivities(p: Program, day: number): ProgramActivity[] {
  return (p.activities ?? []).filter((a) => a.day === day);
}

export function normalizeProgram<T extends Program>(p: T): T {
  return {
    ...p,
    ...(p.activities ? { activities: sanitizeActivities(p.activities) } : {}),
    dayNames: p.dayNames ?? {},
    targetMuscles: sanitizeTargetMuscles(p.targetMuscles),
    items: normalizeItems(p.items ?? []),
  };
}

export function dayItems(p: Program, day: number): ProgramItem[] {
  return p.items.filter((i) => i.day === day).sort((a, b) => a.position - b.position);
}

/** Strength lifts only — markers and cardio are their own item types. */
export function dayExercises(p: Program, day: number): ProgramItem[] {
  return dayItems(p, day).filter((i) => i.kind === 'strength');
}

export function dayName(p: Program, day: number): string {
  return p.dayNames?.[String(day)]?.trim() ?? '';
}

/** A weekday trains when it prescribes anything: items, muscles or a name. */
export function isTrainingDay(p: Program, day: number): boolean {
  return (
    p.items.some((i) => i.day === day) ||
    (p.targetMuscles?.[String(day)]?.length ?? 0) > 0 ||
    !!dayName(p, day)
  );
}

/** Training days in training-week order (first day: Profile › Settings). */
export function trainingDays(p: Program): number[] {
  return weekOrder().filter((d) => isTrainingDay(p, d));
}

/** A day holding any exercise/cardio/marker item is an exercises day. */
export function dayMode(p: Program, day: number): DayMode {
  return p.items.some((i) => i.day === day) ? 'exercises' : 'muscles';
}

export function setCount(items: ProgramItem[]): number {
  return items.reduce((n, it) => n + effectiveSets(it), 0);
}

/** A training day is complete when it is named and has muscles or items. */
export function isDayComplete(p: Program, day: number): boolean {
  if (!dayName(p, day)) return false;
  return dayMode(p, day) === 'exercises'
    ? p.items.some((i) => i.day === day)
    : (p.targetMuscles?.[String(day)]?.length ?? 0) > 0;
}

export type Readiness =
  | { ok: true }
  | { ok: false; reason: 'no-days' }
  | { ok: false; reason: 'unnamed' | 'empty'; day: number };

/** Why Activate is (not) available — named, never a mystery disabled button. */
export function readiness(p: Program): Readiness {
  const days = trainingDays(p);
  if (days.length === 0) return { ok: false, reason: 'no-days' };
  for (const d of days) if (!dayName(p, d)) return { ok: false, reason: 'unnamed', day: d };
  for (const d of days) if (!isDayComplete(p, d)) return { ok: false, reason: 'empty', day: d };
  return { ok: true };
}

/** The document written to Firestore: exercises days drop stale muscles. */
export function toSaved(p: Program, uid: string, fallbackName: string): Program {
  const rawW = Number(p.weeks);
  const weeks = rawW === 0 ? 0 : Math.max(1, Math.min(52, rawW || 8));
  const items = p.items
    .filter((i) => i.name.trim())
    .map((i, idx) => ({
      id: i.id || crypto.randomUUID(),
      day: Math.max(1, Math.min(7, i.day || 1)),
      position: i.position ?? idx,
      name: i.name.trim().slice(0, 120),
      kind: i.kind,
      sets: i.sets,
      reps: i.reps,
      durationMin: i.durationMin,
      equipment: i.equipment ?? [],
      groupId: i.groupId ?? null,
      groupOrder: i.groupOrder ?? null,
      dropLast: !!i.dropLast,
      ...(i.bare ? { bare: true } : {}),
      ...(i.targetWeight ? { targetWeight: i.targetWeight } : {}),
      ...(i.targetRpe ? { targetRpe: i.targetRpe } : {}),
      ...(i.restSec ? { restSec: i.restSec } : {}),
      ...(i.note?.trim() ? { note: i.note.trim().slice(0, 120) } : {}),
      ...(i.kind === 'warmup' && sanitizeWarmupItems(i.warmupItems).length
        ? { warmupItems: sanitizeWarmupItems(i.warmupItems) }
        : {}),
    }));
  const withItems = new Set(items.map((i) => String(i.day)));
  const targetMuscles: Record<string, MuscleGroup[]> = {};
  for (const [d, ms] of Object.entries(sanitizeTargetMuscles(p.targetMuscles))) {
    if (!withItems.has(d)) targetMuscles[d] = ms;
  }
  const dayNames: Record<string, string> = {};
  for (const [d, n] of Object.entries(p.dayNames ?? {})) {
    const v = n.trim().slice(0, 40);
    if (v) dayNames[d] = v;
  }
  const next: Program = {
    id: p.id,
    authorId: uid,
    name: p.name.trim() || fallbackName,
    weeks,
    daysPerWeek: 0,
    status: p.status ?? 'draft',
    dayNames,
    targetMuscles,
    items,
    // Sealing happens at write time (activitiesVault.ts); a list this device can't
    // open (`activities` undefined) keeps its stored envelope.
    ...(p.activities !== undefined
      ? sanitizeActivities(p.activities).length
        ? { activities: sanitizeActivities(p.activities) }
        : {}
      : p.activitiesEnc
        ? { activitiesEnc: p.activitiesEnc }
        : {}),
    updatedAt: Date.now(),
  };
  next.daysPerWeek = Math.max(1, trainingDays(next).length);
  return next;
}

// --- mutations (pure: Program → Program) ----------------------------------------

/** Every target muscle — what "Full body" switches on. */
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

export function duplicateOf(p: Program, name: string): Program {
  const groupMap = new Map<string, string>();
  return {
    ...p,
    id: crypto.randomUUID(),
    name,
    status: 'draft',
    ...(p.activities?.length
      ? { activities: p.activities.map((a) => ({ ...a, id: crypto.randomUUID() })) }
      : {}),
    items: p.items.map((it) => {
      let groupId = it.groupId ?? null;
      if (groupId) {
        if (!groupMap.has(groupId)) groupMap.set(groupId, crypto.randomUUID());
        groupId = groupMap.get(groupId)!;
      }
      return { ...it, id: crypto.randomUUID(), groupId };
    }),
  };
}
