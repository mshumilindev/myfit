/**
 * Estimated effort (RPE) for a set nobody rated.
 *
 * RPE 10 = nothing left, 9 = one rep left, 8 = two… so RPE = 10 − reps in
 * reserve (RIR). Given how strong the athlete is TODAY on a lift (an expected
 * e1RM), the max reps possible at a weight follow from the same Epley model
 * the app uses for e1RM (`e1 = w·(1 + reps/30)` ⇒ `maxReps = 30·(e1/w − 1)`),
 * and RIR = maxReps − reps.
 *
 * "Today" is the recent best e1RM scaled by what we know about the athlete's
 * state: time away from the lift (detraining), a recent or ongoing illness,
 * accumulated muscle fatigue, a short night, and the sets already done on the
 * lift this session. Each effect is small and capped; together they stay
 * within ~25%.
 *
 * Pure: no store, no React. Weights are kg.
 */

export interface RpeContext {
  /** Best e1RM on the lift over recent weeks (0 = unknown → no estimate). */
  refE1: number;
  /** Days since the lift was last trained (null = unknown). */
  daysSinceLift: number | null;
  /** 0 = ill right now, n = an illness ended n days ago, null = none recent. */
  illnessDaysAgo: number | null;
  /** 0..1 fatigue score of the lift's main muscle (fatigue.ts). */
  muscleFatigue: number;
  /** Hours short of 7 h last night (0 when slept enough / unknown). */
  sleepShortH: number;
  /** Working sets of this lift already done this session. */
  priorSets: number;
}

export interface ReadinessPart {
  key: 'detraining' | 'illness' | 'fatigue' | 'sleep' | 'session';
  /** Fraction taken off the expected e1RM (0.04 = −4%). */
  cut: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** How much of the recent best is available today, and why. */
export function readinessFactor(ctx: RpeContext): { factor: number; parts: ReadinessPart[] } {
  const parts: ReadinessPart[] = [];
  const d = ctx.daysSinceLift;
  if (d != null && d > 14)
    parts.push({ key: 'detraining', cut: Math.min(0.12, ((d - 14) / 7) * 0.015) });
  const ill = ctx.illnessDaysAgo;
  if (ill != null) {
    const cut = ill <= 0 ? 0.06 : ill < 7 ? ((7 - ill) / 7) * 0.05 : 0;
    if (cut > 0) parts.push({ key: 'illness', cut });
  }
  if (ctx.muscleFatigue > 0)
    parts.push({ key: 'fatigue', cut: 0.05 * clamp(ctx.muscleFatigue, 0, 1) });
  if (ctx.sleepShortH > 0)
    parts.push({ key: 'sleep', cut: Math.min(0.04, 0.012 * ctx.sleepShortH) });
  // Set-to-set fatigue on the same lift: ~2.5% per hard set, capped.
  if (ctx.priorSets > 0) parts.push({ key: 'session', cut: Math.min(0.1, 0.025 * ctx.priorSets) });
  const factor = clamp(1 - parts.reduce((n, p) => n + p.cut, 0), 0.75, 1);
  return { factor, parts };
}

/**
 * Estimated RPE (6–10, half steps) for `reps` at `weight`, or null when there
 * isn't enough to go on: no recent e1RM, bodyweight, very high reps (the model
 * is poor past ~15) or a load so light the set says nothing.
 */
export function estimateRpe(weight: number, reps: number, ctx: RpeContext): number | null {
  if (weight <= 0 || reps < 1 || reps > 15 || ctx.refE1 <= 0) return null;
  const e1 = ctx.refE1 * readinessFactor(ctx).factor;
  if (weight < e1 * 0.45) return null;
  const maxReps = 30 * (e1 / weight - 1);
  // Well past the model's max: the athlete is stronger than it thinks — no call.
  if (maxReps < reps - 1) return null;
  const rir = clamp(maxReps - reps, 0, 4);
  return clamp(Math.round((10 - rir) * 2) / 2, 6, 10);
}
