import { describe, expect, it } from 'vitest';
describe('conditions slow progression', () => {
  it('noAutoIncrease holds the weight; stepScale shrinks the step', async () => {
    const { applyConditionEffects, nextTarget } = await import('./progression');
    const hist = [{ ts: 2, weight: 100, reps: 10 }];
    const t = nextTarget(hist, { plannedReps: 10 });
    expect(t.state).toBe('progress');
    expect(applyConditionEffects(t, { noAutoIncrease: true }).weight).toBe(100);
    const half = applyConditionEffects(t, { stepScale: 0.5 });
    expect(half.weight).toBeLessThan(t.weight as number);
    expect(half.weight).toBeGreaterThan(100);
  });
});
