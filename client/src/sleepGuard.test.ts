import { describe, expect, it } from 'vitest';
import { sleepBlockedBy } from './sleepGuard';

describe('sleepBlockedBy', () => {
  it('is free when nothing is live', () => {
    expect(sleepBlockedBy({ workouts: [], activities: [] })).toBeNull();
    expect(sleepBlockedBy({})).toBeNull();
    expect(
      sleepBlockedBy({ workouts: [{ finishedAt: 5 }], activities: [{ finishedAt: 9 }] }),
    ).toBeNull();
  });
  it('blocks on an unfinished workout', () => {
    expect(sleepBlockedBy({ workouts: [{ finishedAt: null }] })).toBe('workout');
  });
  it('blocks on a live activity', () => {
    expect(sleepBlockedBy({ workouts: [], activities: [{ finishedAt: null }] })).toBe('activity');
  });
  it('reports an unfinished home set as homeSet', () => {
    expect(sleepBlockedBy({ workouts: [{ finishedAt: null, kind: 'home' }] })).toBe('homeSet');
  });
  it('ignores finished home sets', () => {
    expect(sleepBlockedBy({ workouts: [{ finishedAt: 3, kind: 'home' }] })).toBeNull();
  });
});
