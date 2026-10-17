/**
 * Session dose helpers split out of sessionBuilder.ts (file-size ratchet): how
 * many working sets a muscle gets today, and the warm-up ramp to a working
 * weight. Both take an optional break length (SPO-149) so a muscle that was
 * not trained for weeks starts with a smaller, better-prepared dose. Without a
 * gap they behave exactly as before. Re-exported from sessionBuilder.ts.
 */
import type { Landmark } from './volume';
import type { LoadType } from './loads';
import { breakRow, returnSets } from './detraining';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const roundToStep = (n: number, step: number): number => Math.round(n / step) * step;

/**
 * Today's working-set dose for one muscle: aim to reach the (goal-adjusted,
 * personalised) weekly MAV, credit what's already been done this week, and
 * split the remainder over the sessions left -- bounded to a sane per-session
 * dose that never pushes the muscle over half its weekly MRV in one day.
 * `gapDays` (calendar days since the muscle was last trained) shrinks the dose
 * after a long break (docs/research/detraining.md R2..R5); absent/short = as before.
 */
export function sessionSetsForMuscle(
  lm: Landmark,
  weekToDate: number,
  sessionsLeft = 2,
  gapDays?: number | null,
): number {
  const target = Math.max(lm.mev, lm.mav);
  const remaining = Math.max(lm.mev, target - Math.max(0, weekToDate));
  const per = sessionsLeft > 0 ? remaining / sessionsLeft : remaining;
  const hi = Math.max(3, Math.round(lm.mrv / 2));
  return returnSets(clamp(Math.round(per), 3, hi), gapDays);
}

export interface PlannedSet {
  reps: number;
  weight: number | null;
  type: 'warmup' | 'working';
}

/**
 * A ramp of three warm-up sets up to the first working weight. Only for loaded
 * compound work heavy enough to warrant it; light isolation and non-weight
 * load types get none. Each rung is rounded to a loadable step. After a real
 * break (`gapDays` >= 29, R2..R5) one extra light rung (40% x 8) is added
 * when it fits between the empty bar and the next rung.
 */
export function warmupRamp(
  workingKg: number | null,
  opts: {
    loadType?: LoadType;
    compound?: boolean;
    barKg?: number;
    step?: number;
    gapDays?: number | null;
  } = {},
): PlannedSet[] {
  const { loadType = 'weight', compound = true, barKg = 20, step = 2.5 } = opts;
  if (loadType !== 'weight' || !compound || !workingKg || workingKg <= 0) return [];
  if (workingKg < barKg * 1.5) return [];
  const out: PlannedSet[] = [{ reps: 10, weight: barKg, type: 'warmup' }];
  // Three sets: the empty bar, then ~60% × 5 and ~80% × 2 — enough to groove
  // the pattern and prime the load without eating into the working sets.
  const rungs: [number, number][] = [
    [0.6, 5],
    [0.8, 2],
  ];
  if (breakRow(opts.gapDays)?.extraWarmup) rungs.unshift([0.4, 8]);
  for (const [f, reps] of rungs) {
    const w = roundToStep(workingKg * f, step);
    if (w > out[out.length - 1].weight! && w < workingKg)
      out.push({ reps, weight: w, type: 'warmup' });
  }
  return out;
}
