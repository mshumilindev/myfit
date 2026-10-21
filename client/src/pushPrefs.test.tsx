import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from './i18n/coachSafe.en';
import { DEFAULT_PREFS, loadPrefs, parsePrefs, resetPrefsForTests } from './pushPrefs';
import { NotificationRows } from './views/NotificationRows';

vi.mock('./push', () => ({ syncPrefsToServer: vi.fn(async () => undefined) }));

beforeEach(() => {
  localStorage.clear();
  resetPrefsForTests();
});
afterEach(cleanup);

describe('notification switches', () => {
  it('default to all on; only a literal false switches a kind off', () => {
    expect(DEFAULT_PREFS).toEqual({ requests: true, reminders: true, team: true });
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ requests: 'no', team: 0 })).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ reminders: false })).toEqual({
      requests: true,
      reminders: false,
      team: true,
    });
  });
  it('the Profile rows switch a kind, persist it and tell the server', async () => {
    const { syncPrefsToServer } = await import('./push');
    render(<NotificationRows />);
    for (const n of [sf.pnRequests, sf.pnReminders, sf.pnTeam])
      expect(screen.getByRole('switch', { name: n }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: sf.pnReminders }));
    expect(loadPrefs()).toEqual({ requests: true, reminders: false, team: true });
    expect(JSON.parse(localStorage.getItem('spotter.pushPrefs') as string).reminders).toBe(false);
    await act(async () => undefined);
    expect(syncPrefsToServer).toHaveBeenCalledWith({
      requests: true,
      reminders: false,
      team: true,
    });
    expect(screen.getByRole('switch', { name: sf.pnReminders }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByText(sf.pnSub)).toBeTruthy();
  });
});
