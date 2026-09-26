/**
 * How much each set still builds muscle, and when a muscle has had enough for
 * the day.
 *
 * Evidence it rests on (directions, not exact per-person limits):
 *  - Hypertrophy rises with hard sets per muscle but with diminishing returns;
 *    per session the benefit stops being detectable around ~11 fractional
 *    sets (Remmert et al. 2025 per-session meta-regressions; Pelland et al.,
 *    Sports Med 2025 for weekly volume). Strength plateaus far earlier.
 *  - People differ: trained lifters who add volume on top of what they already
 *    do tend to grow more (Scarpelli et al. 2020/2024), so the plateau and the
 *    drop tolerance are scaled to the athlete's own tolerated volume and habits.
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

/** Per-session plateau (fractional hard sets per muscle), population value. */
export const SESSION_PLATEAU = 11;

/** Personal per-session plateau: scaled by how much weekly volume this athlete
 *  tolerates vs the population (personal MRV / default MRV), bounded. */
export function sessionPlateau(personalMrv?: number | null, baseMrv?: number | null): number {
  if (!personalMrv || !baseMrv) return SESSION_PLATEAU;
  const k = Math.min(1.35, Math.max(0.8, personalMrv / baseMrv));
  return Math.round(SESSION_PLATEAU * k * 2) / 2;
}

/** Personal drop tolerance for a lift: how far the athlete usually lets it
 *  fall by the last set while still progressing. Needs ≥3 past sessions;
 *  a stalled lift keeps the default. */
export function dropTolerance(pastFinalDrops: number[], stalled: boolean): number {
  if (pastFinalDrops.length < 3 || stalled) return DROP_ENOUGH;
  const xs = [...pastFinalDrops].sort((a, b) => a - b);
  const med = xs[Math.floor(xs.length / 2)];
  return Math.min(0.18, Math.max(0.08, med + 0.02));
}

/** Final working set's drop vs the best set, per past session of a lift. */
export function finalDrop(sets: SetEntry[]): number | null {
  const d = performanceDrops(sets);
  const w = sets.filter((s) => typeOf(s) !== 'warmup' && d.has(s.id));
  if (w.length < 2) return null;
  return d.get(w[w.length - 1].id) ?? null;
}

/** Sub-region share of a lift: its primary regions split one set between them,
 *  secondary regions half a set. */
export function regionShares(
  regions: { primary: string[]; secondary?: string[] } | null,
): Map<string, number> {
  const m = new Map<string, number>();
  if (!regions || regions.primary.length === 0) return m;
  for (const r of regions.primary) m.set(r, (m.get(r) ?? 0) + 1 / regions.primary.length);
  const sec = regions.secondary ?? [];
  for (const r of sec) m.set(r, (m.get(r) ?? 0) + 0.5 / sec.length);
  return m;
}
/** Performance drop within an exercise that says "enough" on its own. */
export const DROP_ENOUGH = 0.1;

/**
 * How "hard" a set was, 0–1: RPE ≥ 7 (or failure) = 1, lighter counts less.
 * Warm-ups sit far from failure, so they add only a little — more as they
 * approach the working weight (`workKg`): a bar-only set ≈ 0, a last ramp set
 * at ~80% ≈ 0.15. (Sets many reps from failure recruit few of the fibres that
 * grow — the "effective reps" idea — so they're counted, but barely.)
 */
export function setHardness(
  s: Pick<SetEntry, 'rpe' | 'rpeAuto' | 'failure' | 'type' | 'isWarmup' | 'weight'>,
  workKg = 0,
): number {
  if (typeOf(s) === 'warmup') {
    const w = s.weight ?? 0;
    if (w <= 0 || workKg <= 0) return 0.05;
    return Math.min(0.25, 0.25 * (w / workKg) ** 2);
  }
  if (s.failure === 'manual' || s.failure === 'auto') return 1;
  const r = s.rpe ?? s.rpeAuto ?? null;
  if (r === null) return 1; // an unrated working set is assumed to be real work
  if (r >= 7) return 1;
  if (r >= 6) return 0.5;
  return 0.25;
}

/** Heaviest working weight of a lift (the reference for its warm-ups). */
export function workingKg(sets: SetEntry[]): number {
  return Math.max(0, ...sets.filter((s) => typeOf(s) !== 'warmup').map((s) => s.weight ?? 0));
}

/** How many sets a lift's sets add to a muscle's fatigue / recovery load:
 *  every working set counts 1, a warm-up only its (small) hardness — a near-
 *  working-weight warm-up still tires the muscle a little, an empty-bar one
 *  barely at all. */
export function fatigueSetCount(sets: SetEntry[]): number {
  const ref = workingKg(sets);
  return sets.reduce((n, s) => n + (typeOf(s) === 'warmup' ? setHardness(s, ref) : 1), 0);
}

/** Marginal growth stimulus of the next hard set given `prior` fractional hard
 *  sets on that muscle today: 1 for the first, ~½ at 6, ~¼ at 10. */
export function marginalStimulus(prior: number, plateau = SESSION_PLATEAU): number {
  // Half-value point scales with the plateau (6 of 11 by default).
  const half = (6 / SESSION_PLATEAU) * plateau;
  return 1 / (1 + (Math.max(0, prior) / half) ** 2);
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
  for (const l of lifts) {
    const ref = workingKg(l.sets);
    for (const s of l.sets) {
      const h = setHardness(s, ref);
      add(l.primary, h);
      for (const x of l.secondary) add(x, h * 0.5);
    }
  }
  return m;
}

/** Per-set growth stimulus (0–1) for one lift, in session order, accounting
 *  for what the main muscle had already done earlier in the session. */
export function setStimuli(
  sets: SetEntry[],
  priorBefore: number,
  plateau = SESSION_PLATEAU,
): Map<string, number> {
  const out = new Map<string, number>();
  let prior = priorBefore;
  const ref = workingKg(sets);
  for (const s of sets) {
    const h = setHardness(s, ref);
    if (h <= 0) continue;
    out.set(s.id, marginalStimulus(prior, plateau) * h);
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
  /** Personal per-session plateau (default 11). */
  plateau?: number;
  /** Personal drop tolerance for the lift (default 10%). */
  dropEnough?: number;
}): TiredVerdict {
  const plateau = p.plateau ?? SESSION_PLATEAU;
  const dropEnough = p.dropEnough ?? DROP_ENOUGH;
  const drops = performanceDrops(p.sets);
  const working = p.sets.filter((s) => typeOf(s) !== 'warmup');
  const last = working[working.length - 1];
  const drop = last ? (drops.get(last.id) ?? 0) : 0;
  const nextWorth = marginalStimulus(p.muscleSets, plateau);
  const byVolume = p.muscleSets >= plateau;
  const byDrop = drop >= dropEnough;
  const combined = drop >= dropEnough / 2 && p.muscleSets >= plateau * 0.75;
  // Enough volume for the muscle today shows even before this lift's first
  // set (a new chest exercise after 20 chest sets); the in-lift signals need
  // two working sets, and a plan with sets left only yields to a big drop.
  const enough =
    byVolume || (working.length >= 2 && (p.plannedLeft > 0 ? byDrop : byDrop || combined));
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
