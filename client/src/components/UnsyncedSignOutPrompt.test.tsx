import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { askUnsynced } from '../unsynced';
import { UnsyncedSignOutPrompt } from './UnsyncedSignOutPrompt';

// SPO-384: the question sign-out asks when changes are still unsent.
afterEach(cleanup);

describe('UnsyncedSignOutPrompt', () => {
  it('shows nothing until sign-out asks', () => {
    setLocale('en');
    render(<UnsyncedSignOutPrompt />);
    expect(screen.queryByText(en.signOutTitle)).toBeNull();
  });
  it('asks with the real count; Cancel removes nothing', () => {
    setLocale('en');
    const proceed = vi.fn();
    render(<UnsyncedSignOutPrompt />);
    act(() => void askUnsynced(3, proceed));
    expect(screen.getByText(en.signOutQueueBody(3))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.queryByText(en.signOutTitle)).toBeNull();
  });
  it('Sign out anyway runs the continuation once', () => {
    setLocale('en');
    const proceed = vi.fn();
    render(<UnsyncedSignOutPrompt />);
    act(() => void askUnsynced(1, proceed));
    fireEvent.click(screen.getByRole('button', { name: en.signOut }));
    expect(proceed).toHaveBeenCalledTimes(1);
  });
  it('without the prompt mounted nothing can ask (so nothing would be wiped)', () => {
    expect(askUnsynced(1, vi.fn())).toBe(false);
  });
});
