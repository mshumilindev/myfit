import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from '../i18n/coachSafe.en';
import { clientEn as cc } from '../i18n/coachClient.en';
import { CoachProblemState, problemWords } from './BackendNotice';
import { SAFE_LOCALES } from '../i18n/coachSafe';
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
  it('in dev the developer hint goes to the console, never into the screen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<CoachProblemState problem="not-deployed" onRetry={() => undefined} />);
    expect(screen.queryByTestId('coach-dev-hint')).toBeNull();
    expect(
      screen.queryByText(/dev:|COACH-BACKEND|callables|deployed to this Firebase/i),
    ).toBeNull();
    expect(screen.queryByText(/demo/i)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('COACH-BACKEND.md');
    warn.mockRestore();
  });
  it('offline stays quiet in the console; a production build neither shows nor logs a hint', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(<CoachProblemState problem="offline" onRetry={() => undefined} />);
    expect(warn).not.toHaveBeenCalled();
    unmount();
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false);
    render(<CoachProblemState problem="unknown" onRetry={() => undefined} />);
    expect(screen.queryByTestId('coach-dev-hint')).toBeNull();
    expect(screen.queryByTestId('coach-use-demo')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  // SPO-365: no developer text in any language, whatever the problem, in the production build
  for (const locale of Object.keys(SAFE_LOCALES) as (keyof typeof SAFE_LOCALES)[])
    it(`production build, ${locale}: no developer text in any problem state or dictionary entry`, () => {
      vi.stubEnv('MODE', 'production');
      vi.stubEnv('DEV', false);
      const dict = SAFE_LOCALES[locale];
      for (const [k, v] of Object.entries(dict))
        if (typeof v === 'string')
          expect(v, `${locale}.${k}`).not.toMatch(/^dev\b|COACH-BACKEND|callable|docs\//i);
      for (const p of ['offline', 'not-deployed', 'denied', 'timeout', 'unknown'] as const) {
        const [title, body] = problemWords(dict, p);
        expect(`${title} ${body}`).not.toMatch(/^dev\b|COACH-BACKEND|callable|docs\//i);
      }
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
