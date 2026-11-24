/** The chunk's boot hands its screens to the core host and announces itself. */
import { describe, expect, it } from 'vitest';
import { fatigueHost } from '../fatigueApi';
import { isTrackerReady } from '../trackerRt';

describe('fatigue boot', () => {
  it('provides the screens of the add-on once imported', async () => {
    await import('./fatigueBoot');
    expect(isTrackerReady('fatigue')).toBe(true);
    expect(fatigueHost.MuscleStatePanel).toBeTypeOf('function');
  });
});
