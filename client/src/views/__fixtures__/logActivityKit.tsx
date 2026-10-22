/**
 * Shared setup for the Log activity page behaviour tests: a Saturday-evening clock, a history with a dance/sauna
 * habit, live-state builders and a view renderer on the spying shell. Synthetic data only.
 */
import { vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { LogActivityView } from '../LogActivityView';
import { __getStateForTests } from '../../store';
import type { Activity, Workout } from '../../types';
import { emptyState, makeShell, seed } from './viewKit';

export const MIN = 60_000;
export const NOW = new Date(2025, 8, 27, 18, 40).getTime(); // Saturday evening
let seq = 0;
export const resetSeq = (): void => {
  seq = 0;
};
export const at = (
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  type: string,
  min: number,
  over: Partial<Activity> = {},
): Activity => {
  const start = new Date(y, m - 1, d, hh, mm).getTime();
  seq += 1;
  return {
    id: `t${seq}`,
    type,
    category: type === 'sauna' ? 'recovery' : 'conditioning',
    startedAt: start,
    finishedAt: start + min * MIN,
    durationMin: min,
    effort: 'moderate',
    ...over,
  } as Activity;
};
export const history = (): Activity[] =>
  [
    at(2025, 8, 30, 18, 30, 'dance', 110),
    at(2025, 8, 30, 20, 50, 'sauna', 20),
    at(2025, 9, 6, 18, 30, 'dance', 130),
    at(2025, 9, 13, 18, 30, 'dance', 115),
    at(2025, 9, 13, 20, 50, 'sauna', 20),
    at(2025, 9, 20, 18, 30, 'dance', 125),
    at(2025, 9, 20, 20, 50, 'sauna', 20),
    at(2025, 9, 17, 18, 0, 'tennis', 60, { distanceKm: null }),
    at(2025, 9, 25, 7, 30, 'run', 30, { distanceKm: 5 }),
  ].sort((a, b) => b.startedAt - a.startedAt);
export const live = (type = 'dance', over: Partial<Activity> = {}): Activity =>
  ({
    id: 'live',
    type,
    category: 'conditioning',
    startedAt: NOW - 42 * MIN,
    finishedAt: null,
    durationMin: 0,
    runningSince: NOW - 42 * MIN,
    accumulatedMs: 0,
    ...over,
  }) as Activity;
export const lifted = (id = 'lw'): Workout =>
  ({
    id,
    startedAt: NOW - 3 * 3600_000,
    finishedAt: NOW - 2 * 3600_000,
    autoFinished: false,
    dayName: 'Push',
    exercises: [],
  }) as unknown as Workout;

export function put(activities: Activity[], extra: Record<string, unknown> = {}) {
  seed({ ...emptyState(), activities, ...extra });
}
export function view(props: { cat?: 'conditioning' | 'sport' | 'recovery' } = {}) {
  const shell = makeShell();
  const onClose = vi.fn();
  const r = render(<LogActivityView shell={shell} onClose={onClose} {...props} />);
  return { shell, onClose, ...r };
}
export const acts = () => __getStateForTests().activities;
export const click = (el: Element | null) => act(() => void fireEvent.click(el as Element));
export const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
