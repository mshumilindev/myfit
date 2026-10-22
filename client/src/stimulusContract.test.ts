/**
 * Contract: the weekly-fatigue / "tired muscle" numbers of stimulus.ts are NOT touched by
 * the set bars (SPO-151, spec §5). Expected values were computed from stimulus.ts at HEAD
 * before the bars moved to setTank.ts; if one changes, weekly fatigue changed — stop and ask.
 */
import { describe, expect, it } from 'vitest';
import {
  fatigueSetCount,
  marginalStimulus,
  muscleTally,
  performanceDrops,
  setHardness,
  setStimuli,
  tiredVerdict,
} from './stimulus';
import type { SetEntry } from './types';

const mk = (
  id: string,
  reps: number,
  weight: number | null,
  o: Partial<SetEntry> = {},
): SetEntry => ({
  id,
  reps,
  weight,
  isWarmup: false,
  position: 0,
  ...o,
});
const sets: SetEntry[] = [
  mk('a', 8, 60, { isWarmup: true }),
  mk('b', 8, 100, { type: 'warmup' }),
  mk('c', 8, 130, { isWarmup: true }),
  mk('d', 5, 150, { rpe: 6 }),
  mk('e', 5, 150, { rpe: 7.5 }),
  mk('f', 4, 140, { failure: 'manual' }),
  mk('g', 6, 140, { rpeAuto: 5 }),
];
const close = (got: number[], want: number[]) =>
  want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 12));

describe('stimulus.ts numbers are frozen', () => {
  it('setHardness', () => {
    close(
      sets.map((s) => setHardness(s, 150)),
      [0.04, 0.1111111111111111, 0.1877777777777778, 0.5, 1, 1, 0.25],
    );
    close(
      sets.map((s) => setHardness(s, 0)),
      [0.05, 0.05, 0.05, 0.5, 1, 1, 0.25],
    );
  });
  it('fatigueSetCount', () => {
    expect(fatigueSetCount(sets)).toBeCloseTo(4.338888888888889, 12);
  });
  it('performanceDrops', () => {
    const d = performanceDrops(sets);
    expect([...d.keys()]).toEqual(['d', 'e', 'f', 'g']);
    close([...d.values()], [0, 0, 0.09333333333333338, 0.040000000000000036]);
  });
  it('tiredVerdict', () => {
    const a = tiredVerdict({ sets, muscleSets: 9, plannedLeft: 0 });
    expect(a.enough).toBe(false);
    expect(a.drop).toBeCloseTo(0.04, 12);
    expect(a.sets).toBe(9);
    expect(a.nextWorth).toBeCloseTo(0.3076923076923077, 12);
    const b = tiredVerdict({ sets, muscleSets: 12, plannedLeft: 2, plateau: 11, dropEnough: 0.08 });
    expect(b.enough).toBe(true);
    expect(b.nextWorth).toBeCloseTo(0.2, 12);
  });
  it('muscleTally, marginalStimulus and the (now bar-free) setStimuli', () => {
    const t = muscleTally([{ sets, primary: 'chest', secondary: ['triceps'] }]);
    expect(t.get('chest')).toBeCloseTo(3.088888888888889, 12);
    expect(t.get('triceps')).toBeCloseTo(1.5444444444444445, 12);
    expect(marginalStimulus(4.5)).toBeCloseTo(0.64, 12);
    const st = setStimuli(sets, 2);
    close(
      [...st.values()],
      [
        0.036000000000000004, 0.09959762559260588, 0.16639066568907546, 0.43404451040121583,
        0.8170807995118811, 0.709540410771826, 0.15147729321089784,
      ],
    );
  });
});
