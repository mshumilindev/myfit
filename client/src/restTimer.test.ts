import { describe, expect, it } from 'vitest';
import { planRest, type RestInputs } from './restTimer';

const base: RestInputs = {
  compound: true,
  equipment: ['machine'],
  primary: 'chest',
  lastType: 'working',
  intensity: 0.8,
  reps: 8,
  failure: false,
  rpe: 8,
  muscleFatigue: 0,
  illness: false,
  shortSleep: false,
  midRound: false,
};

describe('planRest restScale', () => {
  it('leaves rest alone without a scale or at 1', () => {
    const a = planRest(base).sec;
    expect(planRest({ ...base, restScale: 1 }).sec).toBe(a);
    expect(planRest({ ...base, restScale: 1 }).reasons.some((r) => r.key === 'condition')).toBe(
      false,
    );
  });
  it('lengthens rest and explains why', () => {
    const a = planRest(base).sec;
    const p = planRest({ ...base, restScale: 1.5 });
    expect(p.sec).toBeGreaterThan(a);
    expect(p.reasons.some((r) => r.key === 'condition')).toBe(true);
  });
  it('never touches superset hand-offs or warm-ups', () => {
    expect(planRest({ ...base, midRound: true, restScale: 1.5 }).sec).toBe(0);
    expect(planRest({ ...base, lastType: 'warmup', restScale: 1.5 }).sec).toBe(60);
  });
  it('stays within the 5 minute cap', () => {
    expect(planRest({ ...base, intensity: 0.95, failure: true, restScale: 2 }).sec).toBe(300);
  });
});
