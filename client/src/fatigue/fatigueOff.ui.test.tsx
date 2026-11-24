/**
 * SPO-558 (F2): without Fatigue / Readiness / Muscle map nothing of them is drawn, and what stays reads as it always did.
 * The test world has the add-on installed (addons/testSetup.ts); each test here takes it away or puts it back.
 */
import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { SessionStartCoach } from '../components/SessionStartCoach';
import { useWidgetAvailable, widgetById } from '../today/registry';
import { FATIGUE_ADDONS } from './testAddons';
import type { Workout } from '../types';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => 'member',
}));

const DAY = 86400000;
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const done = (id: string, daysAgo: number, name: string): Workout => {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id,
    startedAt,
    finishedAt: startedAt + 3600000,
    autoFinished: false,
    exercises: [
      {
        id: id + 'e',
        name,
        kind: 'strength',
        position: 0,
        sets: [{ id: id + 's', reps: 8, weight: 80, isWarmup: false, position: 0, loggedAt: NOW }],
      },
    ],
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  addonsPref.set([
    ...addonsPref.snapshot().list.filter((i) => !FATIGUE_ADDONS.includes(i)),
    ...FATIGUE_ADDONS,
  ]);
});

describe('Session start coach', () => {
  const finished = [
    done('a', 7, 'Bench press'),
    done('b', 1, 'Squat'),
    done('c', 14, 'Bench press'),
  ];
  const draw = () => {
    __replaceStateForTests({ ...__getStateForTests(), workouts: finished });
    return render(<SessionStartCoach finished={finished} now={NOW} />).container;
  };
  it('shows the readiness block with Readiness installed', () => {
    expect(draw().querySelector('.ssc-read')).not.toBeNull();
  });
  it('leaves the readiness block out without it, and keeps the rest of the plan', () => {
    addonsPref.set(addonsPref.snapshot().list.filter((i) => !FATIGUE_ADDONS.includes(i)));
    const c = draw();
    expect(c.querySelector('.ssc-read')).toBeNull();
    expect(c.querySelector('.ssc-plan')).not.toBeNull();
  });
});

describe('Today widgets', () => {
  const avail = (id: string) =>
    renderHook(() => useWidgetAvailable()).result.current(widgetById(id)!);
  it('the fatigue and readiness widgets follow their modules', () => {
    expect(avail('fatigue-deload')).toBe(true);
    expect(avail('readiness')).toBe(true);
    addonsPref.set(addonsPref.snapshot().list.filter((i) => !FATIGUE_ADDONS.includes(i)));
    expect(avail('fatigue-deload')).toBe(false);
    expect(avail('readiness')).toBe(false);
    expect(avail('streak')).toBe(true);
  });
  it('the volume map widget is load accounting and stays', () => {
    addonsPref.set(addonsPref.snapshot().list.filter((i) => !FATIGUE_ADDONS.includes(i)));
    expect(avail('muscle-map')).toBe(true);
  });
});
