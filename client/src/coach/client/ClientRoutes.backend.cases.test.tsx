/** The member's trainer overlay while the real backend starts: bounded loading, a calm failure with Retry, never the sample trainer. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../i18n/coachClient.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { HttpError, setRole } from '../../api';
import { BACKEND_START_TIMEOUT_MS } from '../data/backend';
import { setCoachBackendMode } from '../__fixtures__/register';
import { setViewport } from '../testViewport';
import ClientRoutes from './ClientRoutes';

const gate = vi.hoisted(() => ({ mode: 'hang' as 'hang' | 'deny', calls: 0 }));
vi.mock('../data/firestore/bootstrap', () => ({
  acquireBackend: vi.fn(
    () =>
      new Promise<() => void>((res, rej) => {
        gate.calls += 1;
        if (gate.mode === 'deny')
          rej(new HttpError(403, 'denied', { code: 'functions/permission-denied' }));
        else if (gate.mode === 'hang') return;
        else res(() => undefined);
      }),
  ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  setViewport(390);
  setRole('member');
  setCoachBackendMode('firestore');
  gate.mode = 'hang';
  gate.calls = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setCoachBackendMode(null);
});

describe('starting the real backend', () => {
  it('shows a labelled skeleton on the trainer page instead of bouncing to Today, then the timeout failure', async () => {
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    expect(screen.getByRole('status', { name: cc.ccLoading })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKEND_START_TIMEOUT_MS + 50);
    });
    expect(screen.queryByRole('status', { name: cc.ccLoading })).toBeNull();
    expect(screen.getByText(sf.pbTimeoutTitle)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a denied backend says so with Retry; Retry asks the backend again', async () => {
    gate.mode = 'deny';
    render(<ClientRoutes route="trainer" onClose={() => undefined} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText(sf.pbDeniedTitle)).toBeTruthy();
    expect(gate.calls).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: sf.retry }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(gate.calls).toBe(2);
  });

  it('an unknown route still closes once the backend is loading (nothing to show)', async () => {
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer/unknown" onClose={onClose} />);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('status', { name: cc.ccLoading })).toBeNull();
  });
});
