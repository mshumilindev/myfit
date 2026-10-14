import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../i18n/coachClient.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { setFlag } from '../../data/flags';
import { setCoachBackendMode } from '../__fixtures__/register';
import ClientRoutes from './ClientRoutes';

const gate = vi.hoisted(() => ({
  mode: 'pending' as 'pending' | 'fail',
  resolve: null as null | (() => void),
}));
vi.mock('../data/firestore/bootstrap', () => ({
  acquireBackend: vi.fn(
    () =>
      new Promise<() => void>((res, rej) => {
        if (gate.mode === 'fail') rej(new Error('install failed'));
        else gate.resolve = () => res(() => undefined);
      }),
  ),
}));

beforeEach(() => {
  setFlag('coach', true);
  setCoachBackendMode('firestore');
  window.localStorage.setItem('spotter.uid', 'u1');
});
afterEach(() => {
  cleanup();
  setCoachBackendMode(null);
  gate.mode = 'pending';
  gate.resolve = null;
});

describe('#/trainer with the REAL backend', () => {
  it('while the adapters install the page WAITS (skeleton); it never bounces to Today', async () => {
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    expect(await screen.findByRole('status', { name: cc.ccLoading })).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an install failure is an error with Retry, never the sample trainer', async () => {
    gate.mode = 'fail';
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    expect(await screen.findByText(sf.pbUnknownTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: sf.retry })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Iryna Melnyk')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });
});
