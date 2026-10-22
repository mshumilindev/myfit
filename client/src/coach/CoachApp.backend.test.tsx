/**
 * The Coach shell never waits for the backend: rail, header and navigation are there at once (like every other app);
 * only the main area shows the install (skeleton) or the problem (with Retry). Nothing is unmounted by a retry.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../i18n/coachSafe.en';
import { coachEn as c } from '../i18n/coach.en';
import { CoachApp } from './CoachApp';
import { BACKEND_START_TIMEOUT_MS } from './data/backend';
import { setCoachBackendMode } from './__fixtures__/register';
import { setViewport } from './testViewport';

const boot = vi.hoisted(() => ({ calls: 0 }));
vi.mock('./data/firestore/bootstrap', () => ({
  acquireBackend: vi.fn(() => {
    boot.calls++;
    return new Promise<() => void>(() => undefined); // never answers
  }),
}));

const mount = (onOpenShell = vi.fn()) =>
  render(
    <CoachApp
      role="trainer"
      name="Iryna Koval"
      onExitToWorkouts={() => undefined}
      onOpenShell={onOpenShell}
    />,
  );

beforeEach(() => {
  vi.useFakeTimers();
  boot.calls = 0;
  setViewport(1440);
  window.history.replaceState(null, '', '/');
  setCoachBackendMode('firestore');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setCoachBackendMode(null);
});

describe('Coach shell while the real backend installs in the background', () => {
  it('the rail and navigation are there at once; the main area is a quiet skeleton', () => {
    mount();
    const rail = screen.getByRole('complementary');
    expect(within(rail).getByRole('button', { name: c.navApps })).toBeTruthy();
    expect(within(rail).getAllByRole('button').length).toBeGreaterThan(3);
    expect(document.querySelector('.co-main [aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId('coach-backend-failed')).toBeNull();
  });

  it('a slow start only changes the main area: Retry is there, the shell stays, Apps still opens the launcher', async () => {
    const onShell = vi.fn();
    mount(onShell);
    const rail = screen.getByRole('complementary');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKEND_START_TIMEOUT_MS + 50);
    });
    expect(screen.getByRole('alert').textContent).toContain(sf.pbTimeoutTitle);
    expect(screen.getByRole('complementary')).toBe(rail); // not remounted
    fireEvent.click(within(rail).getByRole('button', { name: c.navApps }));
    expect(onShell).toHaveBeenCalledTimes(1);
    // Retry goes back to the skeleton in the main area, the shell is the same element and asks the backend again.
    fireEvent.click(screen.getByRole('button', { name: sf.retry }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('complementary')).toBe(rail);
    expect(document.querySelector('.co-main [aria-busy="true"]')).not.toBeNull();
    expect(boot.calls).toBe(2);
  });
});
