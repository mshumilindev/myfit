import { describe, expect, it } from 'vitest';
import { classifyWeakPoint, strengthImbalance } from './weakpoints';

describe('classifyWeakPoint', () => {
  it('flags a muscle under MEV across most weeks', () => {
    const wp = classifyWeakPoint([2, 3, 1, 4, 2], 8); // all under mev 8
    expect(wp).not.toBeNull();
    expect(wp!.weeksUnder).toBe(5);
    expect(wp!.severity).toBeGreaterThan(0.5);
  });
  it('does not flag a well-trained muscle', () => {
    expect(classifyWeakPoint([10, 12, 9, 14], 8)).toBeNull();
  });
  it('needs at least three tracked weeks', () => {
    expect(classifyWeakPoint([1, 1], 8)).toBeNull();
  });
  it('borderline (under half the weeks) is not a weak point', () => {
    expect(classifyWeakPoint([2, 3, 10, 12], 8)).toBeNull(); // 2/4 under = 0.5 < 0.6
  });
  it('deeper deficit reads more severe', () => {
    const shallow = classifyWeakPoint([7, 7, 7, 7], 8)!; // just under
    const deep = classifyWeakPoint([0, 1, 0, 1], 8)!; // far under
    expect(deep.severity).toBeGreaterThan(shallow.severity);
  });
});

describe('strengthImbalance', () => {
  const R = (key: string, achievedIdx: number, trained = true) => ({ key, trained, achievedIdx });
  it('flags the lift a tier below the strongest', () => {
    const gap = strengthImbalance([R('squat', 3), R('bench', 1), R('deadlift', 3)]);
    expect(gap).not.toBeNull();
    expect(gap!.lift).toBe('bench');
    expect(gap!.behind).toBe(2);
  });
  it('balanced lifts → null', () => {
    expect(strengthImbalance([R('squat', 2), R('bench', 2), R('deadlift', 2)])).toBeNull();
  });
  it('needs all three trained', () => {
    expect(strengthImbalance([R('squat', 3), R('bench', 1, false), R('deadlift', 3)])).toBeNull();
  });
});
