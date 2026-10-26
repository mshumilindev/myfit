import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Workout } from '../types';
import { SessionView } from './SessionView';

// SPO-358: the blank-session start cards (Warm-up hero, lift tiles) were an empty dark box when the
// picture failed to load: a broken <img alt=""> paints nothing. They must fall back to a type glyph.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();

const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});
const blank = (): Workout => ({
  id: 'open',
  startedAt: NOW - 60000,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
});
function mount() {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [blank()],
    activities: [],
    sleeps: [],
    gyms: [],
    queue: [],
    coach: { ...COACH_DEFAULT },
    cycle: emptyCycleState(),
  });
  return render(<SessionView workoutId="open" shell={shell()} onClose={vi.fn()} />);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('SessionView · start cards never stay blank (SPO-358)', () => {
  it('the Warm-up hero shows the marker photo', () => {
    const { container } = mount();
    const img = container.querySelector('.es-hero.warm > img');
    expect(img?.getAttribute('src')).toBe('/markers/warmup.jpg');
  });

  it('a Warm-up photo that fails to load is replaced by the warm-up glyph, not an empty card', () => {
    const { container } = mount();
    fireEvent.error(container.querySelector('.es-hero.warm > img')!);
    expect(container.querySelector('.es-hero.warm > img')).toBeNull();
    const fb = container.querySelector('.es-hero.warm > .pickphoto-fallback');
    expect(fb).toBeTruthy();
    expect(fb!.querySelector('svg')).toBeTruthy();
  });

  it('a lift tile whose photo fails to load falls back to the glyph tile', () => {
    const { container } = mount();
    const tile = container.querySelector('.es-tile')!;
    fireEvent.error(tile.querySelector('img')!);
    expect(tile.querySelector('img')).toBeNull();
    expect(tile.querySelector('.pickphoto-fallback svg')).toBeTruthy();
  });
});
