import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import { emptyState, freezeClock, NOW, seed, setDesktop } from './__fixtures__/viewKit';
import { SleepView } from './SleepView';
import { addonsPref } from '../addons/enabledSet';

beforeEach(() => {
  addonsPref.set(['sleep']); // the Sleep add-on is installed: without it no nights are read (SPO-500 I8)
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
});
afterEach(cleanup);

const open = () => render(<SleepView onClose={vi.fn()} />);
const startBtn = () => screen.getByText(en.sleepStart).closest('button') as HTMLButtonElement;

describe('Sleep screen: Start sleep (moved from the Health page, SPO-518)', () => {
  it('begins a live night and flips the screen to the night view', () => {
    seed(emptyState());
    open();
    fireEvent.click(startBtn());
    expect(__getStateForTests().sleeps.some((s) => s.wake === null)).toBe(true);
    expect(screen.queryByText(en.sleepStart)).toBeNull();
  });

  const liveWorkout = {
    startedAt: NOW - 3600_000,
    finishedAt: null,
    exercises: [],
    autoFinished: false,
  };

  it.each([
    ['workout', { workouts: [{ ...liveWorkout, id: 'w' }] }, en.slpBlockWorkout],
    [
      'home set',
      {
        workouts: [{ ...liveWorkout, id: 'h', kind: 'home' as const }],
      },
      en.slpBlockHomeSet,
    ],
  ])('cannot start during a live %s, and says why', (_n, over, hint) => {
    seed({ ...emptyState(), ...over });
    open();
    expect(screen.getByText(hint)).toBeTruthy();
    expect(startBtn().disabled).toBe(true);
    fireEvent.click(startBtn());
    expect(__getStateForTests().sleeps).toHaveLength(0);
  });
});
