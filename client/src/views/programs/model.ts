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
import type { ExerciseKind } from '../../types';
import type { EquipmentId } from '../../data/equipment';
import type { MuscleGroup } from '../../data/exercises';
import { resolveMuscles } from '../../store';
import { weekOrder } from '../../weekStart';

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

export function normalizeItems(items: ProgramItem[]): ProgramItem[] {
  const seen = new Map<number, number>();
  return [...items]
    .sort((a, b) => a.day - b.day || a.position - b.position)
    .map((item) => {
      const next = seen.get(item.day) ?? 0;
      seen.set(item.day, next + 1);
      return { ...item, position: next, equipment: item.equipment ?? [] };
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

export function normalizeProgram<T extends Program>(p: T): T {
  return {
    ...p,
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

/** Muscles an exercises day works — primaries first, then secondaries. */
export function derivedMuscles(items: ProgramItem[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  const add = (m: MuscleGroup | null | undefined) => {
    if (m && m !== 'cardio' && !out.includes(m)) out.push(m);
  };
  for (const it of items) {
    if (it.kind !== 'strength') continue;
    add(resolveMuscles({ name: it.name, kind: it.kind }).primary);
  }
  for (const it of items) {
    if (it.kind !== 'strength') continue;
    for (const s of resolveMuscles({ name: it.name, kind: it.kind }).secondary) add(s);
  }
  return out;
}

/** The muscles a day trains, whichever way it is defined. */
export function dayMuscles(p: Program, day: number): MuscleGroup[] {
  return dayMode(p, day) === 'exercises'
    ? derivedMuscles(dayItems(p, day))
    : (p.targetMuscles?.[String(day)] ?? []);
}

export function setCount(items: ProgramItem[]): number {
  return items.reduce((n, it) => n + (it.kind === 'strength' ? it.sets : 0), 0);
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
    updatedAt: Date.now(),
  };
  next.daysPerWeek = Math.max(1, trainingDays(next).length);
  return next;
}

// --- mutations (pure: Program → Program) ----------------------------------------

export function setDayName(p: Program, day: number, name: string): Program {
  const dayNames = { ...p.dayNames };
  if (name.trim()) dayNames[String(day)] = name;
  else delete dayNames[String(day)];
  return { ...p, dayNames };
}

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

/** Toggle one target muscle. "Full body" switches every muscle on (or all
 *  off); picking the last missing muscle turns "Full body" on, dropping any
 *  one turns it off. */
export function toggleMuscle(p: Program, day: number, muscle: MuscleGroup): Program {
  const key = String(day);
  const cur = p.targetMuscles[key] ?? [];
  let next: MuscleGroup[];
  if (muscle === 'fullbody') {
    next = cur.includes('fullbody') ? [] : [...ALL_MUSCLES];
  } else {
    next = cur.includes(muscle)
      ? cur.filter((m) => m !== muscle && m !== 'fullbody')
      : [...cur, muscle];
    const parts = ALL_MUSCLES.filter((m) => m !== 'fullbody');
    if (!next.includes('fullbody') && parts.every((m) => next.includes(m))) next.push('fullbody');
  }
  const targetMuscles = { ...p.targetMuscles };
  if (next.length) targetMuscles[key] = next;
  else delete targetMuscles[key];
  return { ...p, targetMuscles };
}

/** Turn a weekday into rest: drops its name, muscles and items. */
export function clearDay(p: Program, day: number): Program {
  const key = String(day);
  const dayNames = { ...p.dayNames };
  delete dayNames[key];
  const targetMuscles = { ...p.targetMuscles };
  delete targetMuscles[key];
  return { ...p, dayNames, targetMuscles, items: p.items.filter((i) => i.day !== day) };
}

/** Switch a day to muscles: its items go (the caller confirms first). */
export function toMusclesMode(p: Program, day: number): Program {
  const muscles = derivedMuscles(dayItems(p, day)).slice(0, 6);
  const targetMuscles = { ...p.targetMuscles };
  if (!targetMuscles[String(day)]?.length && muscles.length) targetMuscles[String(day)] = muscles;
  return { ...p, targetMuscles, items: p.items.filter((i) => i.day !== day) };
}

export function addItem(p: Program, item: Omit<ProgramItem, 'id' | 'position'>): Program {
  const existing = dayItems(p, item.day);
  // Warm-up opens a day; cool-down closes it; cardio sits before the cool-down;
  // lifts go after the last lift (before cardio/cool-down).
  const rank = (k: ExerciseKind) =>
    k === 'warmup' ? 0 : k === 'strength' ? 1 : k === 'cardio' ? 2 : 3;
  const insertAt = existing.findIndex((x) => rank(x.kind) > rank(item.kind));
  const next = [...existing];
  const created: ProgramItem = { ...item, id: crypto.randomUUID(), position: 0 };
  if (insertAt < 0) next.push(created);
  else next.splice(insertAt, 0, created);
  const others = p.items.filter((i) => i.day !== item.day);
  const targetMuscles = { ...p.targetMuscles };
  delete targetMuscles[String(item.day)];
  return {
    ...p,
    targetMuscles,
    items: [...others, ...next.map((x, i) => ({ ...x, position: i }))],
  };
}

export function patchItem(p: Program, id: string, patch: Partial<ProgramItem>): Program {
  return { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function removeItem(p: Program, id: string): Program {
  const gone = p.items.find((i) => i.id === id);
  let items = p.items.filter((i) => i.id !== id);
  // A superset of one is no superset.
  if (gone?.groupId) {
    const rest = items.filter((i) => i.groupId === gone.groupId);
    if (rest.length < 2)
      items = items.map((i) =>
        i.groupId === gone.groupId ? { ...i, groupId: null, groupOrder: null } : i,
      );
  }
  return { ...p, items: normalizeItems(items) };
}

export function moveItem(p: Program, id: string, dir: -1 | 1): Program {
  const it = p.items.find((i) => i.id === id);
  if (!it) return p;
  const list = dayItems(p, it.day);
  const idx = list.findIndex((i) => i.id === id);
  const j = idx + dir;
  if (j < 0 || j >= list.length) return p;
  const next = [...list];
  [next[idx], next[j]] = [next[j], next[idx]];
  const others = p.items.filter((i) => i.day !== it.day);
  return { ...p, items: [...others, ...next.map((x, i) => ({ ...x, position: i }))] };
}

/** Pair (or join) `id` with `withId` as one superset; labels follow order. */
export function supersetWith(p: Program, id: string, withId: string): Program {
  const a = p.items.find((i) => i.id === id);
  const b = p.items.find((i) => i.id === withId);
  if (!a || !b || a.day !== b.day) return p;
  const gid = b.groupId ?? a.groupId ?? crypto.randomUUID();
  const members = dayItems(p, a.day).filter(
    (i) => i.id === a.id || i.id === b.id || (i.groupId && i.groupId === gid),
  );
  return {
    ...p,
    items: p.items.map((i) => {
      const k = members.findIndex((m) => m.id === i.id);
      return k >= 0 ? { ...i, groupId: gid, groupOrder: k } : i;
    }),
  };
}

export function ungroup(p: Program, id: string): Program {
  const gid = p.items.find((i) => i.id === id)?.groupId;
  if (!gid) return p;
  return {
    ...p,
    items: p.items.map((i) => (i.groupId === gid ? { ...i, groupId: null, groupOrder: null } : i)),
  };
}

/** "A1", "B2"… per day, in order of first appearance. */
export function supersetLabels(items: ProgramItem[]): Map<string, string> {
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

/** Copy a day onto another weekday (replacing it): name, muscles, items. */
export function copyDay(p: Program, from: number, to: number): Program {
  if (from === to) return p;
  const src = dayItems(p, from);
  const groupMap = new Map<string, string>();
  const copied = src.map((it) => {
    let groupId = it.groupId ?? null;
    if (groupId) {
      if (!groupMap.has(groupId)) groupMap.set(groupId, crypto.randomUUID());
      groupId = groupMap.get(groupId)!;
    }
    return { ...it, id: crypto.randomUUID(), day: to, groupId };
  });
  const base = clearDay(p, to);
  const dayNames = { ...base.dayNames };
  const n = dayName(p, from);
  if (n) dayNames[String(to)] = n;
  const targetMuscles = { ...base.targetMuscles };
  const tm = p.targetMuscles[String(from)];
  if (tm?.length) targetMuscles[String(to)] = [...tm];
  return { ...base, dayNames, targetMuscles, items: normalizeItems([...base.items, ...copied]) };
}

export function duplicateOf(p: Program, name: string): Program {
  const groupMap = new Map<string, string>();
  return {
    ...p,
    id: crypto.randomUUID(),
    name,
    status: 'draft',
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
