/**
 * How much each set still builds muscle, and when a muscle has had enough for
 * the day.
 *
 * Evidence it rests on (directions, not exact per-person limits):
 *  - Hypertrophy rises with hard sets per muscle but with diminishing returns;
 *    per session it flattens out around ~10 hard "fractional" sets
 *    (Pelland et al., Sports Med 2025 dose–response meta-regressions).
 *  - Sets count when they're reasonably close to failure (≤ ~3–4 reps in
 *    reserve); easy sets count for less.
 *  - A growing drop in performance within an exercise (the rep/velocity-loss
 *    literature, e.g. Pareja-Blanco 2017) marks accumulating fatigue: past
 *    ~10% the extra sets cost more recovery than they return.
 *
 * Fractional sets: a set counts 1 for the lift's main muscle and 0.5 for each
 * secondary muscle. Pure: no store, no React.
 */
import type { SetEntry, SetType } from './types';

const typeOf = (s: Pick<SetEntry, 'type' | 'isWarmup'>): SetType =>
  s.type ?? (s.isWarmup ? 'warmup' : 'working');

/** Per-session plateau (fractional hard sets per muscle). */
export const SESSION_PLATEAU = 10;
/** Performance drop within an exercise that says "enough" on its own. */
export const DROP_ENOUGH = 0.1;

/** How "hard" a set was, 0–1: RPE ≥ 7 (or failure) = 1, lighter counts less. */
export function setHardness(
  s: Pick<SetEntry, 'rpe' | 'rpeAuto' | 'failure' | 'type' | 'isWarmup'>,
): number {
  if (typeOf(s) === 'warmup') return 0;
  if (s.failure === 'manual' || s.failure === 'auto') return 1;
  const r = s.rpe ?? s.rpeAuto ?? null;
  if (r === null) return 1; // an unrated working set is assumed to be real work
  if (r >= 7) return 1;
  if (r >= 6) return 0.5;
  return 0.25;
}

/** Marginal growth stimulus of the next hard set given `prior` fractional hard
 *  sets on that muscle today: 1 for the first, ~½ at 6, ~¼ at 10. */
export function marginalStimulus(prior: number): number {
  return 1 / (1 + (Math.max(0, prior) / 6) ** 2);
}

/** Best e1RM-like strength of a set (Epley, capped to sensible reps). */
function e1(s: Pick<SetEntry, 'weight' | 'reps'>): number {
  const w = s.weight ?? 0;
  if (w <= 0 || s.reps < 1) return 0;
  return w * (1 + Math.min(s.reps, 12) / 30);
}

/** Drop of each working set vs the best working set before it (0 = no drop). */
export function performanceDrops(sets: SetEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  let best = 0;
  for (const s of sets) {
    if (typeOf(s) === 'warmup') continue;
    const v = e1(s);
    if (v <= 0) continue;
    out.set(s.id, best > 0 ? Math.max(0, 1 - v / best) : 0);
    best = Math.max(best, v);
  }
  return out;
}

export interface SessionLift {
  sets: SetEntry[];
  primary: string | null;
  secondary: string[];
}

/** Fractional hard sets per muscle for the session so far. */
export function muscleTally(lifts: SessionLift[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (k: string | null, v: number) => {
    if (!k || v <= 0) return;
    m.set(k, (m.get(k) ?? 0) + v);
  };
  for (const l of lifts)
    for (const s of l.sets) {
      const h = setHardness(s);
      add(l.primary, h);
      for (const x of l.secondary) add(x, h * 0.5);
    }
  return m;
}

/** Per-set growth stimulus (0–1) for one lift, in session order, accounting
 *  for what the main muscle had already done earlier in the session. */
export function setStimuli(sets: SetEntry[], priorBefore: number): Map<string, number> {
  const out = new Map<string, number>();
  let prior = priorBefore;
  for (const s of sets) {
    const h = setHardness(s);
    if (h <= 0) continue;
    out.set(s.id, marginalStimulus(prior) * h);
    prior += h;
  }
  return out;
}

export interface TiredVerdict {
  /** Main muscle is done for today: more sets mostly add fatigue. */
  enough: boolean;
  /** Last set's drop vs the best set of the lift (0..1). */
  drop: number;
  /** Fractional hard sets the main muscle has had today. */
  sets: number;
  /** Growth value of one more set vs the first set (0..1). */
  nextWorth: number;
}

/**
 * Is the lift's main muscle done for today? Enough when the session has given
 * it ~10 hard sets, or the lift has lost ≥10% vs its best set, or a smaller
 * drop (≥5%) comes on top of ≥8 hard sets. A plan with sets still to go only
 * yields to the hard stop (≥10% drop).
 */
export function tiredVerdict(p: {
  sets: SetEntry[];
  muscleSets: number;
  plannedLeft: number;
}): TiredVerdict {
  const drops = performanceDrops(p.sets);
  const working = p.sets.filter((s) => typeOf(s) !== 'warmup');
  const last = working[working.length - 1];
  const drop = last ? (drops.get(last.id) ?? 0) : 0;
  const nextWorth = marginalStimulus(p.muscleSets);
  const byVolume = p.muscleSets >= SESSION_PLATEAU;
  const byDrop = drop >= DROP_ENOUGH;
  const combined = drop >= 0.05 && p.muscleSets >= 8;
  const enough =
    working.length >= 2 && (p.plannedLeft > 0 ? byDrop : byVolume || byDrop || combined);
  return { enough, drop, sets: p.muscleSets, nextWorth };
}

/** Exercise that usually follows `name` in past sessions (most frequent). */
export function usualNext(
  sessions: { name: string; position: number }[][],
  name: string,
  exclude: Set<string>,
): string | null {
  const needle = name.trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const ex of sessions) {
    const sorted = [...ex].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((e) => e.name.trim().toLowerCase() === needle);
    const nx = i >= 0 ? sorted[i + 1] : undefined;
    if (!nx) continue;
    const k = nx.name.trim();
    if (exclude.has(k.toLowerCase())) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return best;
}
