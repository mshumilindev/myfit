/* Pure set maths (types, drops, volume, top set, auto warm-up). Leaf module: store.ts re-exports it. */
import type { DropEntry, SetEntry, SetType } from './types';
import type { LoadType } from './loads';

export function setTypeOf(s: SetEntry): SetType {
  return s.type ?? (s.isWarmup ? 'warmup' : 'working');
}
export function setDrops(s: SetEntry): DropEntry[] {
  const t = setTypeOf(s);
  return t === 'drop' || t === 'reverse-drop' ? (s.drops ?? []) : [];
}
export function setRepsTotal(s: SetEntry): number {
  return s.reps + setDrops(s).reduce((n, d) => n + d.reps, 0);
}
export function setVolumeKg(s: SetEntry): number {
  // Warm-ups count toward tonnage too — it's still weight moved. (They stay out
  // of PRs / top-set and the working-set counts, which filter by type instead.)
  // Null/0 means bodyweight in the UI, but contributes no external load to total volume.
  const load = (w: number | null): number => w ?? 0;
  return load(s.weight) * s.reps + setDrops(s).reduce((v, d) => v + load(d.weight) * d.reps, 0);
}

export function setTopWeight(s: SetEntry): number {
  return Math.max(s.weight ?? 0, ...setDrops(s).map((d) => d.weight ?? 0));
}
export function topSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => setTypeOf(s) !== 'warmup')
    .sort((a, b) => setTopWeight(b) - setTopWeight(a) || b.reps - a.reps)[0];
}

/** Fraction of the exercise's heaviest set below which a *leading* set reads as
 *  a warm-up. Deload-safe: the reference is today's top set, so the bar scales
 *  with how heavy you actually went. */
export const WARMUP_FRAC = 0.85;

/**
 * Auto-classify the leading light sets of a weight exercise as warm-ups, meaning any set
 * before the first working set whose top weight is under WARMUP_FRAC of the
 * exercise's heaviest set. Manual choices (warmupManual) and special set types
 * (drop / static-dynamic) are never touched and anchor the working run. Pure and
 * idempotent — safe to re-run on every set change.
 */
export function autoWarmupSets(sets: SetEntry[], loadType: LoadType, histRef = 0): SetEntry[] {
  if (loadType !== 'weight') return sets;
  // Reference the known working weight from history, so a light opener is a
  // warm-up on the fly and a PR later in the session never turns the real
  // working sets before it into "warm-ups". Only without history does today's
  // top set serve as the reference.
  const ref = histRef > 0 ? histRef : Math.max(0, ...sets.map(setTopWeight));
  if (ref <= 0) return sets;
  const threshold = WARMUP_FRAC * ref;
  const ordered = [...sets].sort((a, b) => a.position - b.position);
  let working = false; // reached the first working set yet?
  const byId = new Map<string, SetEntry>();
  for (const s of ordered) {
    const t = setTypeOf(s);
    if (s.warmupManual || (t !== 'working' && t !== 'warmup')) {
      if (t !== 'warmup') working = true; // a manual/special working set anchors
      byId.set(s.id, s);
      continue;
    }
    if (!working && setTopWeight(s) > 0 && setTopWeight(s) < threshold) {
      byId.set(s.id, t === 'warmup' ? s : { ...s, type: 'warmup', isWarmup: true });
    } else {
      working = true;
      byId.set(s.id, t === 'working' ? s : { ...s, type: 'working', isWarmup: false });
    }
  }
  return sets.map((s) => byId.get(s.id) ?? s);
}
