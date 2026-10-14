import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppCrashBoundary } from './appCrash';
import { updateNow } from './pwaUpdate';

function Boom(): never {
  throw new Error('boom');
}

describe('updateNow', () => {
  it('is "failed" with no service worker', async () => {
    expect(await updateNow(undefined, vi.fn())).toBe('failed');
  });

  it('is "current" when the check finds nothing newer', async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: null, installing: null };
    const container = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
    };
    const reload = vi.fn();
    expect(await updateNow(container, reload)).toBe('current');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when a newer worker takes control', async () => {
    const listeners: Array<() => void> = [];
    const reg = {
      update: vi.fn().mockResolvedValue(undefined),
      waiting: { state: 'installed', postMessage: vi.fn() },
      installing: null,
    };
    const container = {
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn((_: string, l: () => void) => listeners.push(l)),
    };
    const reload = vi.fn();
    const p = updateNow(container, reload);
    await Promise.resolve();
    await Promise.resolve();
    listeners.forEach((l) => l());
    expect(await p).toBe('updated');
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('AppCrashBoundary', () => {
  it('shows its own screen with the buttons when the app throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppCrashBoundary>
        <Boom />
      </AppCrashBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear cache and update' })).toBeTruthy();
  });

  it('renders the app when nothing throws', () => {
    render(
      <AppCrashBoundary>
        <p>fine</p>
      </AppCrashBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });
});
