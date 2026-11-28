import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { ShellLauncher } from './ShellLauncher';
import type { StoreState } from '../store';
import { en } from '../i18n/en';

let role = 'admin';
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => role,
}));

const stubWidth = (desktop: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: desktop,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

beforeEach(() => {
  role = 'admin';
  addonsPref.set(['gym', 'coach', 'apex']);
});
afterEach(() => {
  addonsPref.reset();
  vi.unstubAllGlobals();
  cleanup();
});

function mount(onClose = () => undefined) {
  const noop = () => undefined;
  render(
    <ShellLauncher
      store={{ workouts: [], queue: [] } as unknown as StoreState}
      now={Date.now()}
      current="gym"
      peopleLabel="Users"
      peopleDesc=""
      activeChallenges={0}
      notifUnread={0}
      onGym={noop}
      onApex={noop}
      onRoster={noop}
      onLearn={noop}
      onClose={onClose}
    />,
  );
}

describe('ShellLauncher: Dev Console tile (SPO-639)', () => {
  it('opens the console in a new tab for an admin on desktop in dev on localhost', () => {
    stubWidth(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const onClose = vi.fn();
    mount(onClose);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminDevConsole) }));
    expect(open).toHaveBeenCalledWith('http://127.0.0.1:5174', '_blank', 'noreferrer');
    expect(onClose).toHaveBeenCalled();
  });

  it('is absent on the mobile layout', () => {
    stubWidth(false);
    mount();
    expect(screen.queryByText(en.adminDevConsole)).toBeNull();
  });

  it('is absent for a non-admin', () => {
    stubWidth(true);
    role = 'member';
    mount();
    expect(screen.queryByText(en.adminDevConsole)).toBeNull();
  });
});
