import { cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { SetEntry, Workout } from '../types';
import { SessionStartCoach, hasSessionStartCoach } from './SessionStartCoach';

const DAY = 86400000;
// Wednesday 14 Oct 2026, 18:00 local.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();

const s = (id: string, weight: number, reps = 8): SetEntry => ({
  id,
  reps,
  weight,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
function done(
  id: string,
  daysAgo: number,
  name: string,
  sets: SetEntry[],
  dayName?: string,
): Workout {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id,
    startedAt,
    finishedAt: startedAt + 3600000,
    autoFinished: false,
    ...(dayName ? { dayName } : {}),
    exercises: [{ id: id + 'e', name, kind: 'strength', position: 0, sets }],
  };
}
function seed(workouts: Workout[], conditions: unknown[] = []) {
  __replaceStateForTests({ ...__getStateForTests(), workouts, conditions: conditions as never });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('hasSessionStartCoach', () => {
  it('needs two finished sessions and a same-weekday one with logged sets', () => {
    const w1 = done('a', 7, 'Bench press', [s('x', 80)]); // Wed 7 Oct
    const w2 = done('b', 1, 'Squat', [s('y', 100)]); // Tue
    expect(hasSessionStartCoach([w1], NOW)).toBe(false);
    expect(hasSessionStartCoach([w1, w2], NOW)).toBe(true);
    // two sessions but none on a Wednesday
    expect(hasSessionStartCoach([w2, done('c', 2, 'Row', [s('z', 50)])], NOW)).toBe(false);
    // the newest Wednesday session has nothing logged
    const empty = done('d', 7, 'Bench press', []);
    expect(hasSessionStartCoach([empty, w2], NOW)).toBe(false);
  });
});

describe('SessionStartCoach', () => {
  it('renders nothing with fewer than two finished sessions or no same-weekday history', () => {
    seed([]);
    const a = render(
      <SessionStartCoach finished={[done('a', 7, 'Bench press', [s('x', 80)])]} now={NOW} />,
    );
    expect(a.container.innerHTML).toBe('');
    cleanup();
    seed([]);
    const b = render(
      <SessionStartCoach
        finished={[done('a', 1, 'Bench press', [s('x', 80)]), done('b', 2, 'Squat', [s('y', 80)])]}
        now={NOW}
      />,
    );
    expect(b.container.innerHTML).toBe('');
  });

  it('renders nothing when the last Wednesday session had no logged exercise', () => {
    const finished = [done('a', 7, 'Bench press', []), done('b', 1, 'Squat', [s('y', 80)])];
    seed(finished);
    const { container } = render(<SessionStartCoach finished={finished} now={NOW} />);
    expect(container.innerHTML).toBe('');
  });

  it('reads the day from the program name and previews the usual lift with its target', () => {
    const finished = [
      done('a', 7, 'Bench press', [s('x', 80)], 'Push day'),
      done('b', 14, 'Bench press', [s('y', 80)], 'Push day'),
      done('c', 1, 'Squat', [s('z', 100)]),
    ];
    seed(finished);
    const { container } = render(<SessionStartCoach finished={finished} now={NOW} />);
    expect(container.querySelector('.ssc-plan-head')!.textContent).toContain('Push day');
    const rows = container.querySelectorAll('.ssc-ex');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.ssc-ex-name')!.textContent).toBe('Bench press');
    expect(rows[0].querySelector('.ssc-ex-target')!.textContent).toMatch(/^\d+\.\d × \d+$/);
    // the readiness banner lists the chest as a target muscle with a percentage
    expect(container.querySelector('.ssc-m-name')!.textContent).toBe('Chest');
    expect(container.querySelector('.ssc-m-pct')!.textContent).toMatch(/^\d+%$/);
  });

  it('shows a fresh, green banner when the target muscle has had a week off', () => {
    const finished = [
      done('a', 7, 'Bench press', [s('x', 80)]),
      done('b', 10, 'Squat', [s('y', 100)]),
    ];
    seed(finished);
    const { container } = render(<SessionStartCoach finished={finished} now={NOW} />);
    expect(container.querySelector('.ssc-read')!.className).toContain('tone-suggest');
    expect(container.querySelector('.ssc-why')).toBeNull();
  });

  it('turns red and names the cooking muscle when it was hammered yesterday', () => {
    const hammered = Array.from({ length: 12 }, (_, i) => ({
      ...s('h' + i, 100, 10),
      loggedAt: NOW - DAY + i * 1000,
    }));
    const finished = [
      done('a', 7, 'Bench press', [s('x', 80)]),
      { ...done('b', 1, 'Bench press', hammered), finishedAt: NOW - 20 * 3600000 },
    ];
    seed(finished);
    const { container } = render(<SessionStartCoach finished={finished} now={NOW} />);
    expect(container.querySelector('.ssc-read')!.className).toContain('tone-analysis');
    expect(container.querySelector('.ssc-why')!.textContent).toContain('Chest');
  });

  it('adds the condition reminder above the readout when a condition is active', () => {
    const finished = [
      done('a', 7, 'Bench press', [s('x', 80)]),
      done('b', 10, 'Squat', [s('y', 100)]),
    ];
    seed(finished, [
      { id: 'c', key: 'pain_upper_back', severity: 2, share: 'effects', createdAt: 0 },
    ]);
    const { container } = render(<SessionStartCoach finished={finished} now={NOW} />);
    expect(container.textContent).toContain('Remember');
    expect(container.querySelector('.ssc')).toBeTruthy();
  });

  it('with a condition but no history shows only the reminder', () => {
    seed([], [{ id: 'c', key: 'pain_upper_back', severity: 2, share: 'effects', createdAt: 0 }]);
    const { container } = render(<SessionStartCoach finished={[]} now={NOW} />);
    expect(container.textContent).toContain('Remember');
    expect(container.querySelector('.ssc')).toBeNull();
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
