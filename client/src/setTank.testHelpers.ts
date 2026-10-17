/** Test-only builders for setTank tests (synthetic data, no store). */
import { TANK_PARAMS, type TankExercise, type TankSetInput } from './setTank';

export const T0 = 1_000_000_000_000;

export type Spec = Partial<Omit<TankSetInput, 'id' | 'position' | 'loggedAt'>> & {
  reps: number;
  weight: number | null;
  /** Rest before the set in seconds (ignored for the first set). */
  rest?: number;
};

const work = (s: Spec): number => {
  const total =
    (Number.isFinite(s.reps) ? s.reps : 0) + (s.drops ?? []).reduce((n, d) => n + d.reps, 0);
  return (s.durationMin ?? 0) > 0
    ? (s.durationMin as number) * 60
    : Math.max(TANK_PARAMS.minWorkSec, total * TANK_PARAMS.secPerRep);
};

/** Sets of ONE lift in a row: loggedAt = previous + rest + work. */
export function chain(prefix: string, specs: Spec[], start = T0): TankSetInput[] {
  let at = start;
  return specs.map((sp, i) => {
    const { rest = 0, ...rest2 } = sp;
    at = i === 0 ? start : at + (rest + work(sp)) * 1000;
    return { ...rest2, id: `${prefix}${i + 1}`, position: i, loggedAt: at };
  });
}

export function lift(
  id: string,
  primary: string | null,
  sets: TankSetInput[],
  o: Partial<TankExercise> = {},
): TankExercise {
  return { id, primary, secondary: [], weighted: true, e1rmRef: 0, sets, ...o };
}

export const W = (reps: number, weight: number, rest?: number, o: Partial<Spec> = {}): Spec => ({
  reps,
  weight,
  rest,
  type: 'working',
  ...o,
});
export const WU = (reps: number, weight: number, rest?: number, o: Partial<Spec> = {}): Spec => ({
  reps,
  weight,
  rest,
  type: 'warmup',
  isWarmup: true,
  ...o,
});

/** Mulberry32: tiny seeded PRNG for the property tests. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
