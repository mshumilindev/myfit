import { describe, expect, it } from 'vitest';
import { liveSleep } from './store';
import type { SleepNight } from './types';

const night = (p: Partial<SleepNight>): SleepNight =>
  ({ id: 'n', date: '2026-10-14', bedtime: 1, wake: null, ...p }) as SleepNight;

// SPO-43: the night palette / SleepHero follow the OPEN night, whoever opened it (the server job writes it while the app is closed).
describe('liveSleep (drives the night palette and SleepHero)', () => {
  it('an open night opened by the server job is live', () => {
    const live = liveSleep([night({ source: 'auto', autoWakeAt: 99 })]);
    expect(live?.source).toBe('auto');
  });
  it('a closed night (server closed it at the wake time) is not live', () => {
    expect(liveSleep([night({ wake: 50, source: 'auto' })])).toBeNull();
  });
  it('no nights, no live night', () => {
    expect(liveSleep([])).toBeNull();
    expect(liveSleep(undefined)).toBeNull();
  });
});
