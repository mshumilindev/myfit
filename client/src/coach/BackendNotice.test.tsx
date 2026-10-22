import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../i18n/coachSafe.en';
import { CoachApp } from './CoachApp';
import { NotConfigured } from './BackendNotice';
import { coachBackendIsAuto, coachBackendMode } from './data/backend';
import { coachTestHooks } from './data/testHooks';
import { setCoachBackendMode } from './__fixtures__/register';
import { setViewport } from './testViewport';

beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  setCoachBackendMode(null);
});

describe('coach backend mode: the real backend is the only one in an app build', () => {
  it('unset in `npm run dev` tries the REAL backend first (auto: a bounded probe decides)', () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_COACH_BACKEND', '');
    expect(coachBackendMode()).toBe('firestore');
    expect(coachBackendIsAuto()).toBe(true);
  });
  it('unset in a production build or preview is the REAL backend', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_COACH_BACKEND', '');
    expect(coachBackendMode()).toBe('firestore');
  });
  it('VITE_COACH_BACKEND=firestore is the real backend, without the probe', () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_COACH_BACKEND', 'firestore');
    expect(coachBackendMode()).toBe('firestore');
    expect(coachBackendIsAuto()).toBe(false);
  });
  it('there is no way to select sample data in an app build: not by variable, not by localStorage', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_COACH_BACKEND', 'fixtures');
    localStorage.setItem('spotter.coachBackend', 'fixtures');
    expect(coachTestHooks()).toBeUndefined();
    expect(coachBackendMode()).toBe('firestore');
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    expect(coachBackendMode()).toBe('firestore');
    localStorage.removeItem('spotter.coachBackend');
  });
  it('"off" renders no clients at all', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_COACH_BACKEND', 'off');
    expect(coachBackendMode()).toBe('unconfigured');
  });
  it('the unit-test runner runs the test doubles; the test hook pins a mode and resets with null', () => {
    expect(coachBackendMode()).toBe('fixtures');
    setCoachBackendMode('firestore');
    expect(coachBackendMode()).toBe('firestore');
    setCoachBackendMode(null);
    expect(coachBackendMode()).toBe('fixtures');
  });
});

describe('Coach app without a backend', () => {
  it('renders the calm FailedState and no client at all', () => {
    setCoachBackendMode('unconfigured');
    const onExit = vi.fn();
    render(
      <CoachApp
        role="trainer"
        name="Iryna Koval"
        onExitToWorkouts={onExit}
        onOpenShell={() => undefined}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(sf.offTitle);
    expect(screen.queryByText(/Oleh/)).toBeNull();
    screen.getByRole('button', { name: sf.offBack }).click();
    expect(onExit).toHaveBeenCalled();
  });
  it('the shell never shows a demo notice, with or without test doubles', async () => {
    render(
      <CoachApp
        role="trainer"
        name="Iryna Koval"
        onExitToWorkouts={() => undefined}
        onOpenShell={() => undefined}
      />,
    );
    await screen.findByRole('main');
    expect(screen.queryByTestId('coach-demo-notice')).toBeNull();
    expect(screen.queryByTestId('coach-not-configured')).toBeNull();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });
});

describe('NotConfigured', () => {
  it('has no button without a way back', () => {
    render(<NotConfigured />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
