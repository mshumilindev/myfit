/**
 * "You've used this here, but it isn't on the gym's list."
 *
 * The best evidence a gym has some kit is that you trained on it there. This
 * reads your sessions at one gym and returns the equipment they used that the
 * gym's list doesn't have yet, with the proof: how many sessions, when last,
 * which lifts, and a dot per recent session here.
 *
 *  - Exact evidence: the fine items you picked on an exercise (equipmentItems).
 *  - Class evidence: a lift's coarse equipment (barbell, cable, EZ bar…) maps
 *    to that class's standard item. Bodyweight, "other" and the broad
 *    "machine" class are skipped — a machine lift doesn't say which machine.
 *  - Medium evidence (the default for suggesting and pre-ticking): seen in at
 *    least two sessions here within the window.
 *  - A gym with no list at all never nags; it gets "build it from your
 *    workouts" instead (same data, every item).
 *
 * Pure: callers pass gyms, workouts and the equipment lookups.
 */
import type { Exercise, Gym, Workout } from './types';

/** Standard catalog item for a coarse class (what "a barbell" means). */
export const CLASS_DEFAULT_ITEM: Record<string, string> = {
  barbell: 'barbell-olympic',
  ezBar: 'barbell-ez',
  dumbbell: 'dumbbell-fixed',
  kettlebell: 'kettlebell-cast',
  cable: 'cable-crossover',
  bands: 'band-loop-power',
  suspension: 'suspension-trx',
  medicineBall: 'cond-slam-ball',
  exerciseBall: 'rec-stability-ball',
  foamRoll: 'rec-foam-roller',
};

/** Sessions needed for "medium" evidence. */
export const MEDIUM_EVIDENCE = 2;
/** Look-back window. */
export const EVIDENCE_DAYS = 120;
/** Dots shown in the evidence strip (most recent sessions here). */
export const EVIDENCE_DOTS = 8;

export interface KitEvidence {
  /** Catalog item id to add. */
  itemId: string;
  /** Coarse class it satisfies (for the filter). */
  cls: string;
  /** Distinct sessions here that used it. */
  sessions: number;
  lastAt: number;
  /** Lift names that showed it, most recent first, unique. */
  lifts: string[];
  /** One flag per recent session here, oldest → newest (true = used). */
  used: boolean[];
  /** Seen in ≥ MEDIUM_EVIDENCE sessions. */
  medium: boolean;
}

export interface EvidenceDeps {
  /** Coarse classes an exercise needs (store.equipmentFor). */
  classesOf: (ex: Exercise) => string[];
  /** Coarse class of a catalog item (null = unknown item). */
  clsOfItem: (itemId: string) => string | null;
  /** Is this exercise a lift (not cardio / a marker)? */
  isLift: (ex: Exercise) => boolean;
}

/** Equipment items an exercise instance shows, with how they're known. */
function itemsOf(ex: Exercise, deps: EvidenceDeps): { id: string; cls: string }[] {
  const out: { id: string; cls: string }[] = [];
  const seen = new Set<string>();
  const push = (id: string, cls: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, cls });
  };
  for (const id of ex.equipmentItems ?? []) {
    const cls = deps.clsOfItem(id);
    if (cls) push(id, cls);
  }
  const fineClasses = new Set(out.map((x) => x.cls));
  for (const cls of deps.classesOf(ex)) {
    if (fineClasses.has(cls)) continue; // the exact item already covers it
    const def = CLASS_DEFAULT_ITEM[cls];
    if (def) push(def, cls);
  }
  return out;
}

/** Does the gym's list already cover this item? */
export function gymCovers(
  gym: Pick<Gym, 'inventory' | 'equipmentItems'>,
  id: string,
  cls: string,
): boolean {
  if ((gym.equipmentItems ?? []).includes(id)) return true;
  // A class default is covered by any item of that class already listed.
  const isDefault = CLASS_DEFAULT_ITEM[cls] === id;
  return isDefault && (gym.inventory ?? []).includes(cls);
}

/** A gym with no list yet ("never audited"). */
export function gymHasNoList(gym: Pick<Gym, 'inventory' | 'equipmentItems'>): boolean {
  return (gym.inventory ?? []).length === 0 && (gym.equipmentItems ?? []).length === 0;
}

/**
 * Kit used at `gym` that its list lacks (or, for a gym with no list, all kit
 * used there), strongest evidence first. `workouts` may include the live one.
 */
export function kitEvidence(
  gym: Gym,
  workouts: Workout[],
  now: number,
  deps: EvidenceDeps,
  notHere: string[] = gym.equipmentNotHere ?? [],
): KitEvidence[] {
  const since = now - EVIDENCE_DAYS * 86400000;
  const here = workouts
    .filter((w) => w.gymId === gym.id && w.startedAt >= since)
    .sort((a, b) => a.startedAt - b.startedAt);
  const recent = here.slice(-EVIDENCE_DOTS);
  const noList = gymHasNoList(gym);
  const acc = new Map<string, KitEvidence & { sessionIds: Set<string> }>();
  for (const w of here) {
    for (const ex of w.exercises) {
      if (!deps.isLift(ex) || ex.sets.length === 0) continue;
      for (const { id, cls } of itemsOf(ex, deps)) {
        if (notHere.includes(id)) continue;
        if (!noList && gymCovers(gym, id, cls)) continue;
        let e = acc.get(id);
        if (!e) {
          e = {
            itemId: id,
            cls,
            sessions: 0,
            lastAt: 0,
            lifts: [],
            used: [],
            medium: false,
            sessionIds: new Set(),
          };
          acc.set(id, e);
        }
        e.sessionIds.add(w.id);
        e.lastAt = Math.max(e.lastAt, w.startedAt);
        const name = ex.name.trim();
        e.lifts = [name, ...e.lifts.filter((l) => l !== name)];
      }
    }
  }
  return [...acc.values()]
    .map(({ sessionIds, ...e }) => ({
      ...e,
      sessions: sessionIds.size,
      used: recent.map((w) => sessionIds.has(w.id)),
      medium: sessionIds.size >= MEDIUM_EVIDENCE,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.lastAt - a.lastAt);
}
