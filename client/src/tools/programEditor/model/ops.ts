/**
 * Immutable operations on a `ProgramDoc`: document in, document out, never mutated. The editor builds every edit from
 * these (so does a host that changes a program without the UI), history and middleware sit on top (`history.ts`,
 * `pipeline.ts`). Operations that need catalog knowledge (an exercise's equipment, the muscles of a row) take the
 * `ExerciseCatalog` as an argument: this file imports nothing from the host.
 */
import type { ExerciseCatalog } from '../host';
import {
  ALL_MUSCLES,
  dayActivities,
  dayItems,
  dayName,
  isBare,
  normalizeItems,
  type ActivityEffort,
  type ActivityWhen,
  type MuscleGroup,
  type ProgramActivityDoc,
  type ProgramDoc,
  type ProgramItemDoc,
  type WarmupExerciseDoc,
} from './doc';

/* ---- ids ----------------------------------------------------------------------------------------------------- */

let genId: () => string = () => crypto.randomUUID();
/** Deterministic ids for tests and replays. Call with nothing to restore. */
export function setIdGenerator(fn?: () => string): void {
  genId = fn ?? (() => crypto.randomUUID());
}

/** Last used values when a bare row gets targets (never zeros). */
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;

export type WithMemory = ProgramItemDoc & {
  was?: { sets: number; reps: number; kg?: number; rpe?: number; rest?: number };
};

/* ---- days ---------------------------------------------------------------------------------------------------- */

export function setDayName<P extends ProgramDoc>(p: P, day: number, name: string): P {
  const dayNames = { ...p.dayNames };
  if (name.trim()) dayNames[String(day)] = name;
  else delete dayNames[String(day)];
  return { ...p, dayNames };
}

/** A weekday that trains nothing yet gets a name so it counts as a training day. */
export function startDay<P extends ProgramDoc>(p: P, day: number, name: string): P {
  return { ...p, dayNames: { ...p.dayNames, [String(day)]: name } };
}

/** Turn a weekday into rest: drops its name, muscles and items (planned activities are kept apart; see copyDay). */
export function clearDay<P extends ProgramDoc>(p: P, day: number): P {
  const key = String(day);
  const dayNames = { ...p.dayNames };
  delete dayNames[key];
  const targetMuscles = { ...p.targetMuscles };
  delete targetMuscles[key];
  return { ...p, dayNames, targetMuscles, items: p.items.filter((i) => i.day !== day) };
}

/**
 * Toggle one target muscle. "Full body" switches every muscle on (or all off); picking the last missing muscle turns
 * "Full body" on, dropping any one turns it off.
 */
export function toggleMuscle<P extends ProgramDoc>(p: P, day: number, muscle: MuscleGroup): P {
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

/** Muscles an exercises day works: primaries first, then secondaries. */
export function derivedMuscles(items: ProgramItemDoc[], catalog: ExerciseCatalog): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  const add = (m: MuscleGroup | null | undefined) => {
    if (m && m !== 'cardio' && !out.includes(m)) out.push(m);
  };
  const lifts = items.filter((it) => it.kind === 'strength');
  for (const it of lifts) add(catalog.facts(it.name).primary);
  for (const it of lifts) for (const s of catalog.facts(it.name).secondary) add(s);
  return out;
}

/** Switch a day to muscles: its items go (the caller confirms first). */
export function toMusclesMode<P extends ProgramDoc>(
  p: P,
  day: number,
  catalog: ExerciseCatalog,
): P {
  const muscles = derivedMuscles(dayItems(p, day), catalog).slice(0, 6);
  const targetMuscles = { ...p.targetMuscles };
  if (!targetMuscles[String(day)]?.length && muscles.length) targetMuscles[String(day)] = muscles;
  return { ...p, targetMuscles, items: p.items.filter((i) => i.day !== day) };
}

/** Copy a day onto another weekday (replacing it): name, muscles, items, activities. */
export function copyDay<P extends ProgramDoc>(p: P, from: number, to: number): P {
  if (from === to) return p;
  const src = dayItems(p, from);
  const groupMap = new Map<string, string>();
  const copied = src.map((it) => {
    let groupId = it.groupId ?? null;
    if (groupId) {
      if (!groupMap.has(groupId)) groupMap.set(groupId, genId());
      groupId = groupMap.get(groupId)!;
    }
    return { ...it, id: genId(), day: to, groupId };
  });
  const base = clearDay(p, to);
  const dayNames = { ...base.dayNames };
  const n = dayName(p, from);
  if (n) dayNames[String(to)] = n;
  const targetMuscles = { ...base.targetMuscles };
  const tm = p.targetMuscles[String(from)];
  if (tm?.length) targetMuscles[String(to)] = [...tm];
  const acts = (base.activities ?? []).filter((a) => a.day !== to);
  const copiedActs = dayActivities(p, from).map((a) => ({ ...a, id: genId(), day: to }));
  return {
    ...base,
    dayNames,
    targetMuscles,
    items: normalizeItems([...base.items, ...copied]),
    ...(acts.length + copiedActs.length ? { activities: [...acts, ...copiedActs] } : {}),
  };
}

/** Replace one weekday with a day of another program (templates, other clients): new ids, supersets kept together. */
export function importDay<P extends ProgramDoc>(
  p: P,
  day: number,
  src: ProgramDoc,
  srcDay: number,
): P {
  const base = clearDay(p, day);
  const groups = new Map<string, string>();
  const items = dayItems(src, srcDay).map((it) => {
    let groupId = it.groupId ?? null;
    if (groupId) {
      if (!groups.has(groupId)) groups.set(groupId, genId());
      groupId = groups.get(groupId)!;
    }
    return { ...it, id: genId(), day, groupId };
  });
  const dayNames = { ...base.dayNames };
  const n = dayName(src, srcDay);
  if (n) dayNames[String(day)] = n;
  const targetMuscles = { ...base.targetMuscles };
  const tm = src.targetMuscles[String(srcDay)];
  if (tm?.length) targetMuscles[String(day)] = [...tm];
  const copiedActs = (src.activities ?? [])
    .filter((a) => a.day === srcDay)
    .map((a) => ({ ...a, id: genId(), day }));
  const acts = [...(base.activities ?? []).filter((a) => a.day !== day), ...copiedActs];
  return {
    ...base,
    dayNames,
    targetMuscles,
    items: normalizeItems([...base.items, ...items]),
    ...(acts.length ? { activities: acts } : {}),
  };
}

/* ---- rows ---------------------------------------------------------------------------------------------------- */

export function addItem<P extends ProgramDoc>(
  p: P,
  item: Omit<ProgramItemDoc, 'id' | 'position'>,
): P {
  const existing = dayItems(p, item.day);
  // Warm-up opens a day; cool-down closes it; cardio sits before the cool-down; lifts go after the last lift.
  const rank = (k: ProgramItemDoc['kind']) =>
    k === 'warmup' ? 0 : k === 'strength' ? 1 : k === 'cardio' ? 2 : 3;
  const insertAt = existing.findIndex((x) => rank(x.kind) > rank(item.kind));
  const next = [...existing];
  const created: ProgramItemDoc = { ...item, id: genId(), position: 0 };
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

export function patchItem<P extends ProgramDoc>(
  p: P,
  id: string,
  patch: Partial<ProgramItemDoc>,
): P {
  return { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function removeItem<P extends ProgramDoc>(p: P, id: string): P {
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

export function moveItem<P extends ProgramDoc>(p: P, id: string, dir: -1 | 1): P {
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
export function supersetWith<P extends ProgramDoc>(p: P, id: string, withId: string): P {
  const a = p.items.find((i) => i.id === id);
  const b = p.items.find((i) => i.id === withId);
  if (!a || !b || a.day !== b.day) return p;
  const gid = b.groupId ?? a.groupId ?? genId();
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

export function ungroup<P extends ProgramDoc>(p: P, id: string): P {
  const gid = p.items.find((i) => i.id === id)?.groupId;
  if (!gid) return p;
  return {
    ...p,
    items: p.items.map((i) => (i.groupId === gid ? { ...i, groupId: null, groupOrder: null } : i)),
  };
}

/** Added from the library: just the exercise. The new row's id is returned for selection. */
export function addBareExercise<P extends ProgramDoc>(
  p: P,
  day: number,
  name: string,
  catalog: ExerciseCatalog,
): { program: P; id: string } {
  const eq = catalog.facts(name).equipment;
  const next = addItem(p, {
    day,
    name,
    kind: 'strength',
    sets: 0,
    reps: 0,
    durationMin: null,
    equipment: eq ? [eq] : [],
    bare: true,
  });
  const created = dayItems(next, day).find((i) => !p.items.some((x) => x.id === i.id));
  return { program: next, id: created?.id ?? '' };
}

export function addMarker<P extends ProgramDoc>(
  p: P,
  day: number,
  kind: 'warmup' | 'cooldown',
  names: { warmup: string; cooldown: string } = { warmup: 'Warm-up', cooldown: 'Cool-down' },
): P {
  return addItem(p, {
    day,
    name: kind === 'warmup' ? names.warmup : names.cooldown,
    kind,
    sets: 0,
    reps: 0,
    durationMin: kind === 'warmup' ? 8 : 5,
    equipment: [],
  });
}

/** "Just the exercise" <-> "With targets". Going back to bare keeps the numbers for undo; going to targets restores them. */
export function setRowMode<P extends ProgramDoc>(p: P, id: string, bare: boolean): P {
  const it = p.items.find((i) => i.id === id) as WithMemory | undefined;
  if (!it || it.kind !== 'strength') return p;
  if (bare) {
    if (isBare(it)) return p;
    return patchItem(p, id, {
      bare: true,
      sets: 0,
      reps: 0,
      targetWeight: undefined,
      targetRpe: undefined,
      restSec: undefined,
      was: {
        sets: it.sets,
        reps: it.reps,
        kg: it.targetWeight,
        rpe: it.targetRpe,
        rest: it.restSec,
      },
    } as Partial<ProgramItemDoc>);
  }
  // already with targets: nothing to restore (this used to reset sets and reps to the defaults)
  if (!isBare(it)) return p;
  const was = it.was;
  return patchItem(p, id, {
    bare: false,
    sets: was?.sets || DEFAULT_SETS,
    reps: was?.reps || DEFAULT_REPS,
    ...(was?.kg ? { targetWeight: was.kg } : {}),
    ...(was?.rpe ? { targetRpe: was.rpe } : {}),
    ...(was?.rest ? { restSec: was.rest } : {}),
  } as Partial<ProgramItemDoc>);
}

/** Swap the exercise keeping sets and targets; the equipment follows the new exercise. */
export function swapExercise<P extends ProgramDoc>(
  p: P,
  id: string,
  name: string,
  catalog: ExerciseCatalog,
): P {
  const eq = catalog.facts(name).equipment;
  return patchItem(p, id, { name, equipment: eq ? [eq] : [] });
}

export function setEquipment<P extends ProgramDoc>(p: P, id: string, equipment: string[]): P {
  return patchItem(p, id, { equipment });
}

/** Strip draft-only memory (`was`) before a version document is written. */
export function forWrite<T extends ProgramDoc>(p: T): T {
  return {
    ...p,
    items: p.items.map((i) => {
      const rest: WithMemory = { ...(i as WithMemory) };
      delete rest.was;
      return rest;
    }),
  };
}

/* ---- planned activities ----------------------------------------------------------------------------------- */

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];
const WHENS: ActivityWhen[] = ['any', 'before', 'after'];
const MAX_ACTIVITIES = 28;

/** Coerce a list of activities to the allowed shapes (numbers, enums, a cap). Keys are the host's business. */
export function sanitizeActivities(raw: readonly ProgramActivityDoc[]): ProgramActivityDoc[] {
  const out: ProgramActivityDoc[] = [];
  for (const r of raw) {
    const minutes = Math.round(Number(r.minutes));
    if (!r.type || !Number.isInteger(r.day) || r.day < 1 || r.day > 7 || !(minutes > 0)) continue;
    out.push({
      id: r.id || genId(),
      day: r.day,
      type: r.type,
      minutes: Math.min(600, minutes),
      effort: EFFORTS.includes(r.effort) ? r.effort : 'moderate',
      when: WHENS.includes(r.when) ? r.when : 'any',
    });
    if (out.length >= MAX_ACTIVITIES) break;
  }
  return out;
}

export function addActivity<P extends ProgramDoc>(p: P, a: Omit<ProgramActivityDoc, 'id'>): P {
  return { ...p, activities: sanitizeActivities([...(p.activities ?? []), { ...a, id: genId() }]) };
}

export function patchActivity<P extends ProgramDoc>(
  p: P,
  id: string,
  patch: Partial<ProgramActivityDoc>,
): P {
  return {
    ...p,
    activities: sanitizeActivities(
      (p.activities ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    ),
  };
}

/** What a new activity of this type starts as (light types are short and easy). */
export function activityDefaults(
  type: string,
): Pick<ProgramActivityDoc, 'minutes' | 'effort' | 'when'> {
  const light = type === 'mobility' || type === 'yoga';
  return { minutes: light ? 15 : 30, effort: light ? 'light' : 'moderate', when: 'any' };
}

/** True when the person changed the activity from its starting values (so removing it throws something away). */
export function activityHasContent(a: ProgramActivityDoc): boolean {
  const d = activityDefaults(a.type);
  return a.minutes !== d.minutes || a.effort !== d.effort || a.when !== d.when;
}

/** A typed exercise name as the document keeps it: spaces collapsed, at most 120 characters, '' when nothing is left. */
export function cleanExerciseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function removeActivity<P extends ProgramDoc>(p: P, id: string): P {
  return { ...p, activities: (p.activities ?? []).filter((a) => a.id !== id) };
}

/* ---- warm-up exercises (references held by a warm-up marker) ------------------------------------------------- */

export const MAX_WARMUP_ITEMS = 12;
const positive = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;

/** Coerce a stored (or absent / malformed) warm-up list: catalog name + id + ONE target (seconds win), capped. */
export function sanitizeWarmupItems(raw: unknown): WarmupExerciseDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: WarmupExerciseDoc[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 120) : '';
    if (!name) continue;
    const reps = positive(r.reps);
    const durationSec = positive(r.durationSec);
    const weight =
      typeof r.weight === 'number' && Number.isFinite(r.weight) && r.weight > 0
        ? Math.round(r.weight * 100) / 100
        : undefined;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : genId(),
      name,
      ...(typeof r.exerciseId === 'string' && r.exerciseId ? { exerciseId: r.exerciseId } : {}),
      ...(durationSec ? { durationSec } : reps ? { reps } : {}),
      ...(weight && !durationSec ? { weight } : {}),
    });
    if (out.length >= MAX_WARMUP_ITEMS) break;
  }
  return out;
}

/** Add an exercise (a catalog reference) to a warm-up marker. Other kinds are left alone. */
export function addWarmupExercise<P extends ProgramDoc>(
  p: P,
  itemId: string,
  ex: Omit<WarmupExerciseDoc, 'id'>,
): P {
  return {
    ...p,
    items: p.items.map((i) => {
      if (i.id !== itemId || i.kind !== 'warmup') return i;
      const cur = sanitizeWarmupItems(i.warmupItems);
      if (cur.length >= MAX_WARMUP_ITEMS) return i;
      const [added] = sanitizeWarmupItems([{ ...ex, id: genId() }]);
      return added ? { ...i, warmupItems: [...cur, added] } : i;
    }),
  };
}

/** Set the target of a warm-up exercise: reps (+ weight) OR seconds; the other one is dropped. */
export function patchWarmupExercise<P extends ProgramDoc>(
  p: P,
  itemId: string,
  exId: string,
  patch: { reps?: number; durationSec?: number; weight?: number },
): P {
  return {
    ...p,
    items: p.items.map((i) => {
      if (i.id !== itemId || i.kind !== 'warmup') return i;
      return {
        ...i,
        warmupItems: sanitizeWarmupItems(
          (i.warmupItems ?? []).map((w) => {
            if (w.id !== exId) return w;
            const next: WarmupExerciseDoc = { ...w, ...patch };
            if (patch.reps !== undefined) delete next.durationSec;
            if (patch.durationSec !== undefined) delete next.reps;
            return next;
          }),
        ),
      };
    }),
  };
}

export function removeWarmupExercise<P extends ProgramDoc>(p: P, itemId: string, exId: string): P {
  return {
    ...p,
    items: p.items.map((i) => {
      if (i.id !== itemId || i.kind !== 'warmup') return i;
      const { warmupItems, ...rest } = i;
      const next = (warmupItems ?? []).filter((w) => w.id !== exId);
      return next.length ? { ...rest, warmupItems: next } : rest;
    }),
  };
}

/** A cardio row (machine name + minutes). It sits before the cool-down. */
export function addCardio<P extends ProgramDoc>(p: P, day: number, name: string, minutes = 10): P {
  return addItem(p, {
    day,
    name,
    kind: 'cardio',
    sets: 1,
    reps: 0,
    durationMin: minutes,
    equipment: [],
  });
}

/** An exercise with its numbers (the athlete's own program default: 3 x 10). */
export function addExerciseWithTargets<P extends ProgramDoc>(
  p: P,
  day: number,
  name: string,
  catalog: ExerciseCatalog,
): { program: P; id: string } {
  const eq = catalog.facts(name).equipment;
  const next = addItem(p, {
    day,
    name,
    kind: 'strength',
    sets: DEFAULT_SETS,
    reps: DEFAULT_REPS,
    durationMin: null,
    equipment: eq ? [eq] : [],
  });
  const created = dayItems(next, day).find((i) => !p.items.some((x) => x.id === i.id));
  return { program: next, id: created?.id ?? '' };
}
