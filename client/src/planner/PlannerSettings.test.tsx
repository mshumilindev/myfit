import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlannerPrefs } from './types';
import type { NativePrefs, PlannerNative } from './desktopBridge';

const state = vi.hoisted(() => ({
  prefs: {
    updatedAt: 0,
    availability: {
      0: [[1080, 1260]],
      1: [[1080, 1260]],
      2: [[1080, 1260]],
      3: [[1080, 1260]],
      4: [[1080, 1260]],
      5: [[540, 780]],
      6: [[540, 780]],
    },
    shareAvailability: false,
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  } as unknown as PlannerPrefs,
  saved: [] as PlannerPrefs[],
  quiet: { on: true, from: 1320, to: 420 },
  quietSaved: [] as unknown[],
  native: null as PlannerNative | null,
}));
vi.mock('./sync', () => ({
  usePrefs: () => state.prefs,
  savePrefs: (p: PlannerPrefs) => {
    state.saved.push(p);
    state.prefs = p;
    return Promise.resolve();
  },
}));
vi.mock('../quietHours', async (orig) => ({
  ...(await orig<typeof import('../quietHours')>()),
  useQuietHours: () => state.quiet,
  saveQuiet: (q: unknown) => {
    state.quietSaved.push(q);
  },
}));
vi.mock('./desktopBridge', async (orig) => ({
  ...(await orig<typeof import('./desktopBridge')>()),
  nativeBridge: () => state.native,
}));

import { PlannerSettings } from './PlannerSettings';

const last = () => state.saved[state.saved.length - 1];
const shell = (over: Partial<NativePrefs> = {}): NativePrefs => ({
  trayIcon: true,
  openAtLogin: false,
  autostartHintShown: false,
  ...over,
});

beforeEach(() => {
  state.saved = [];
  state.quietSaved = [];
  state.native = null;
  state.quiet = { on: true, from: 1320, to: 420 };
  state.prefs = {
    ...state.prefs,
    shareAvailability: false,
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  };
});
afterEach(cleanup);

describe('PlannerSettings', () => {
  it('shows the defaults', () => {
    render(<PlannerSettings onBack={() => {}} />);
    expect(screen.getByText('Planner settings')).toBeTruthy();
  });

  it('saves the reminder style as the default for new plans', () => {
    render(<PlannerSettings onBack={() => {}} />);
    fireEvent.click(screen.getByText('Persistent'));
    expect(last().defaults.mode).toBe('ring');
  });

  it('turns quiet hours off through the app-wide setting', () => {
    render(<PlannerSettings onBack={() => {}} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Quiet hours' }));
    expect(state.quietSaved).toEqual([{ on: false, from: 1320, to: 420 }]);
  });

  it('disables From / To while quiet hours are off', () => {
    state.quiet = { on: false, from: 1320, to: 420 };
    render(<PlannerSettings onBack={() => {}} />);
    expect(
      (screen.getByText('From').closest('button') as HTMLButtonElement | null)?.disabled ?? true,
    ).toBe(true);
  });

  it('does not repeat the availability: weekly hours and sharing live on their own page', () => {
    render(<PlannerSettings onBack={() => {}} />);
    expect(screen.queryByText('Weekly hours')).toBeNull();
    expect(screen.queryByRole('switch', { name: /free hours/i })).toBeNull();
  });

  it('has no "This computer" group in the browser', () => {
    render(<PlannerSettings onBack={() => {}} />);
    expect(screen.queryByText('This computer')).toBeNull();
  });

  it('writes the desktop shell options', async () => {
    const setPrefs = vi.fn((p: Partial<NativePrefs>) => Promise.resolve(shell(p)));
    state.native = { getPrefs: () => Promise.resolve(shell()), setPrefs };
    render(<PlannerSettings onBack={() => {}} />);
    const sw = await screen.findByRole('switch', { name: 'Start Spotter with my computer' });
    await act(async () => {
      fireEvent.click(sw);
    });
    expect(setPrefs).toHaveBeenCalledWith({ openAtLogin: true });
  });
});
