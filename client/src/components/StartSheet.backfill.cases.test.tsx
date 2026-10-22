import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import type { ProgramAssignment } from '../data/programMine';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Gym, Workout } from '../types';
import { BackfillSheet, StartSheet } from './StartSheet';

// The assigned program comes from the network layer: replace only that hook, keep the real day helpers.
const programState: { assignment: ProgramAssignment | null; active: boolean } = {
  assignment: null,
  active: true,
};
vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => programState,
}));
// Nearby-gym search is a network call.
vi.mock('../data/gymProviders', async (orig) => ({
  ...(await orig<typeof import('../data/gymProviders')>()),
  searchNearbyGyms: async () => [],
}));

// Wednesday 14 Oct 2026, 18:00 local.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const gym: Gym = { id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 };

const shell = () =>
  ({
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    goPlaybook: vi.fn(),
    openStart: vi.fn(),
    toast: vi.fn(),
    snack: vi.fn(),
    signOut: vi.fn(),
    queueLength: 0,
  }) as unknown as Shell &
    Record<
      | 'openOverlay'
      | 'replaceOverlay'
      | 'goTab'
      | 'goPlaybook'
      | 'openStart'
      | 'toast'
      | 'snack'
      | 'signOut',
      ReturnType<typeof vi.fn>
    >;

function seed(workouts: Workout[], extra: Record<string, unknown> = {}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts,
    activities: [],
    sleeps: [],
    restPeriods: [],
    gyms: [],
    ...extra,
  });
}
/** A GPS fix: standing at (lat, lng) with the given accuracy, or no fix at all. */
function gps(fix: { lat: number; lng: number; accuracy: number } | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void, err: (e: unknown) => void) =>
        fix
          ? ok({ coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy } })
          : err({ code: 1, PERMISSION_DENIED: 1 }),
    },
  });
}
beforeEach(() => {
  localStorage.clear();
  programState.assignment = null;
  programState.active = true;
  gps(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  seed([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BackfillSheet', () => {
  it('accepts a session of up to 8 hours and blocks anything longer', () => {
    render(
      <BackfillSheet gyms={[]} onClose={vi.fn()} onCreate={vi.fn()} initialDate="2026-10-13" />,
    );
    const cont = screen.getByRole('button', { name: 'Continue to exercises' }) as HTMLButtonElement;
    const hours = screen.getByLabelText('h');
    const mins = screen.getByLabelText('min');
    const at = (h: string, m: string) => {
      fireEvent.change(hours, { target: { value: h } });
      fireEvent.change(mins, { target: { value: m } });
      return cont.disabled;
    };
    expect([at('8', '0'), at('8', '1'), at('9', '0'), at('0', '1'), at('0', '0')]).toEqual([
      false,
      true,
      true,
      false,
      true,
    ]);
  });

  it('prefills a given date and blocks a start in the future', async () => {
    const onCreate = vi.fn();
    render(
      <BackfillSheet gyms={[]} onClose={vi.fn()} onCreate={onCreate} initialDate="2026-10-14" />,
    );
    // 18:00 on the same day is not in the future yet (now = 18:00 exactly), so continue works
    const cont = screen.getByRole('button', { name: 'Continue to exercises' }) as HTMLButtonElement;
    expect(cont.disabled).toBe(false);
    cleanup();
    render(
      <BackfillSheet gyms={[]} onClose={vi.fn()} onCreate={onCreate} initialDate="2026-10-15" />,
    );
    expect(
      (screen.getByRole('button', { name: 'Continue to exercises' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('That time is in the future')).toBeTruthy();
  });

  it('picks a gym inline and passes it with start and duration', async () => {
    const onCreate = vi.fn();
    render(<BackfillSheet gyms={[gym]} onClose={vi.fn()} onCreate={onCreate} />);
    await userEvent.click(screen.getByText('Choose a gym'));
    await userEvent.click(await screen.findByText('Smartfit'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to exercises' }));
    expect(onCreate).toHaveBeenCalledWith(new Date(2026, 9, 13, 18, 0).getTime(), 3600000, 'g1');
  });

  it('switches to a home set: 15-minute default, chosen set is passed, Empty passes null', async () => {
    seed([], {
      home: {
        sets: [{ id: 'hs1', name: 'Morning', moves: [], createdAt: 1, updatedAt: 1 }],
        moves: [],
      },
    });
    const onCreateHome = vi.fn();
    render(
      <BackfillSheet
        gyms={[gym]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onCreateHome={onCreateHome}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Home set' }));
    expect(screen.getByText('Which home set')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to exercises' }));
    expect(onCreateHome).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ id: 'hs1' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Empty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to exercises' }));
    expect(onCreateHome).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), null);
    // going back to gym restores the 60 min default
    await userEvent.click(screen.getByRole('tab', { name: 'Gym session' }));
    expect(
      within(document.querySelector('.backfill-grid') as HTMLElement).getAllByRole('textbox')
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('StartSheet · Log past → Home set', () => {
  it("creates a finished home session carrying the chosen set's name", async () => {
    seed([], {
      home: {
        sets: [{ id: 'hs1', name: 'Morning', moves: [], createdAt: 1, updatedAt: 1 }],
        moves: [],
      },
    });
    const sh = shell();
    render(<StartSheet shell={sh} onClose={vi.fn()} />);
    await userEvent.click(screen.getByText('Log past').closest('button') as HTMLElement);
    await userEvent.click(screen.getByRole('tab', { name: 'Home set' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue to exercises' }));
    const call = sh.openOverlay.mock.calls.at(-1)![0] as { workoutId: string; startAdd: boolean };
    expect(call.startAdd).toBe(false);
    const w = __getStateForTests().workouts.find((x) => x.id === call.workoutId)!;
    expect(w).toMatchObject({ kind: 'home', homeSetId: 'hs1', dayName: 'Morning' });
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
