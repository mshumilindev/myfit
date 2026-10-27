import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs script without type declarations
import * as times from '../scripts/ci-stage-times.mjs';

const T0 = Date.parse('2026-10-27T10:00:00Z');
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
const job = (name: string, created: number, start: number, end: number | null) => ({
  name,
  created_at: iso(created),
  started_at: iso(start),
  completed_at: end === null ? null : iso(end),
});

describe('CI stage times (SPO-370)', () => {
  it('keeps finished jobs only, latest finisher first, relative to the first created job', () => {
    const out = times.stages({
      jobs: [job('a', 0, 2, 100), job('b', 5, 70, 300), job('c', 0, 3, null)],
    }) as { name: string; queued: number; start: number; end: number; seconds: number }[];
    expect(out.map((s) => s.name)).toEqual(['b', 'a']);
    expect(out[0]).toEqual({ name: 'b', queued: 65, start: 70, end: 300, seconds: 230 });
  });

  it('is empty for a response with no finished jobs', () => {
    expect(times.stages({ jobs: [] })).toEqual([]);
    expect(times.stages(undefined)).toEqual([]);
    expect(times.render({ jobs: [] })).toContain('No finished jobs');
  });

  it('names the last job, the runner waits, and warns only over the budget', () => {
    const slow = times.render({ jobs: [job('x', 0, 60, 500), job('y', 0, 1, 50)] }) as string;
    expect(slow).toContain('**x**');
    expect(slow).toContain('Waited 30 s or more for a runner: 1 job(s)');
    expect(slow).toContain('::warning');
    const fast = times.render({ jobs: [job('x', 0, 1, 300), job('y', 0, 1, 50)] }) as string;
    expect(fast).toContain('No job waited');
    expect(fast).not.toContain('::warning');
  });
});
