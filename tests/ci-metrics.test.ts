import { describe, expect, it } from 'vitest';
import { percentile, slowestJobs, summarizeRuns } from '../scripts/lib/ci-metrics.mjs';

const run = (start: string, end: string, conclusion = 'success') => ({
  status: 'completed',
  conclusion,
  run_started_at: start,
  updated_at: end,
  event: 'push',
});

describe('ci metrics', () => {
  it('percentile of empty is 0 and picks the nearest rank', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });
  it('summarizes median, p90 and red share, ignoring cancelled runs', () => {
    const s = summarizeRuns([
      run('2026-11-27T10:00:00Z', '2026-11-27T10:06:00Z'),
      run('2026-11-27T10:00:00Z', '2026-11-27T10:12:00Z', 'failure'),
      run('2026-11-27T10:00:00Z', '2026-11-27T10:09:00Z', 'cancelled'),
    ]);
    expect(s.runs).toBe(2);
    expect(s.redPct).toBe(50);
    expect(s.medianMin).toBe(6);
  });
  it('lists the slowest jobs by median duration', () => {
    const j = slowestJobs([
      { name: 'a', started_at: '2026-11-27T10:00:00Z', completed_at: '2026-11-27T10:01:00Z' },
      { name: 'b', started_at: '2026-11-27T10:00:00Z', completed_at: '2026-11-27T10:05:00Z' },
      { name: 'c', started_at: null, completed_at: null },
    ]);
    expect(j[0]).toEqual({ name: 'b', medianSec: 300 });
    expect(j).toHaveLength(2);
  });
});
