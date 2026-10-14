import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../i18n/coachSafe.en';
import { clientEn as cc } from '../i18n/coachClient.en';
import { CoachProblemState } from './BackendNotice';
import { setCoachBackendMode } from './__fixtures__/register';
import { TrainerUnavailable } from './client/screens/TrainerUnavailable';

vi.mock('../today/myTrainer', () => ({
  useMyTrainer: vi.fn(() => ({ id: 't1', name: 'Iryna Melnyk', avatar: false })),
}));

beforeEach(() => {
  vi.stubEnv('MODE', 'development');
  vi.stubEnv('DEV', true);
  vi.stubEnv('VITE_COACH_BACKEND', 'firestore');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  setCoachBackendMode(null);
});

describe('CoachProblemState: plain words per failure class', () => {
  const cases = [
    ['offline', sf.pbOfflineTitle],
    ['not-deployed', sf.pbNotDeployedTitle],
    ['denied', sf.pbDeniedTitle],
    ['timeout', sf.pbTimeoutTitle],
    ['unknown', sf.pbUnknownTitle],
  ] as const;
  for (const [problem, title] of cases)
    it(`${problem}: title, Retry`, () => {
      const retry = vi.fn();
      render(<CoachProblemState problem={problem} onRetry={retry} />);
      expect(screen.getByText(title)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: sf.retry }));
      expect(retry).toHaveBeenCalled();
    });
  it('in dev: a hint line (not for offline) and never a demo action', () => {
    render(<CoachProblemState problem="not-deployed" onRetry={() => undefined} />);
    expect(screen.getByTestId('coach-dev-hint')).toBeTruthy();
    expect(screen.queryByTestId('coach-use-demo')).toBeNull();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });
  it('offline has no dev hint; a production build has no hint', () => {
    const { unmount } = render(<CoachProblemState problem="offline" onRetry={() => undefined} />);
    expect(screen.queryByTestId('coach-dev-hint')).toBeNull();
    unmount();
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false);
    render(<CoachProblemState problem="unknown" onRetry={() => undefined} />);
    expect(screen.queryByTestId('coach-dev-hint')).toBeNull();
    expect(screen.queryByTestId('coach-use-demo')).toBeNull();
  });
});

describe('My trainer without the Coach backend', () => {
  it('a member with the legacy trainer card still sees the trainer, a calm note and working actions, not a skeleton', () => {
    const retry = vi.fn();
    const sharing = vi.fn();
    render(<TrainerUnavailable problem="not-deployed" onRetry={retry} onSharing={sharing} />);
    expect(screen.getByTestId('legacy-trainer-card')).toBeTruthy();
    expect(screen.getByText('Iryna Melnyk')).toBeTruthy();
    expect(screen.getByText(sf.pbNotDeployedTitle)).toBeTruthy();
    expect(screen.queryByRole('status', { name: cc.ccLoading })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: cc.mtSharing }));
    expect(sharing).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: sf.retry }));
    expect(retry).toHaveBeenCalled();
  });
});
