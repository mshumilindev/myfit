/**
 * SPO-141: the People screen is the admin-only Users app. A non-admin who is handed the `users` tab (typed URL,
 * saved route) never gets the admin view: it is not rendered and the router is told to go to Me. The nav never
 * mixes Users and Me.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { RosterApp } from './RosterApp';

const session = vi.hoisted(() => ({ role: 'member' as 'member' | 'trainer' | 'admin' }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => session.role,
  getUsername: () => 'Iryna Koval',
  currentUid: () => 'u-1',
}));
vi.mock('../components/Avatar', () => ({
  UserAvatar: () => <span />,
  Avatar: () => <span />,
}));
vi.mock('./AdminView', () => ({ AdminView: () => <div data-testid="admin-view" /> }));
vi.mock('./ProfileView', () => ({ ProfileView: () => <div data-testid="me-view" /> }));
vi.mock('./NotificationsView', () => ({
  NotificationsView: () => <div data-testid="feed-view" />,
}));

const noop = () => undefined;
function mount(role: typeof session.role, tab: 'users' | 'me' | 'feed', onTab = vi.fn()) {
  session.role = role;
  render(
    <RosterApp
      role={role}
      now={0}
      tab={tab}
      onTab={onTab}
      shell={{} as unknown as Shell}
      onOpenShell={noop}
      notifs={[]}
      notifState={{ seen: [], seenAt: 0 } as never}
      notifUnread={0}
      onNotifSeen={noop}
      onNotifMarkAll={noop}
    />,
  );
  return onTab;
}

beforeEach(() => {
  Element.prototype.scrollTo = noop;
});
afterEach(cleanup);

describe('RosterApp access (SPO-141)', () => {
  for (const role of ['member', 'trainer'] as const) {
    it(`${role} on the users tab: admin view is never rendered and the route moves to Me`, () => {
      const onTab = mount(role, 'users');
      expect(screen.queryByTestId('admin-view')).toBeNull();
      expect(screen.getByTestId('me-view')).toBeTruthy();
      expect(onTab).toHaveBeenCalledWith('me');
    });

    it(`${role} on Me: no redirect, no admin view`, () => {
      const onTab = mount(role, 'me');
      expect(screen.getByTestId('me-view')).toBeTruthy();
      expect(screen.queryByTestId('admin-view')).toBeNull();
      expect(onTab).not.toHaveBeenCalled();
    });
  }

  it('admin on users: the admin view, no redirect', () => {
    const onTab = mount('admin', 'users');
    expect(screen.getByTestId('admin-view')).toBeTruthy();
    expect(onTab).not.toHaveBeenCalled();
  });

  it('admin on Me: own account only, Users is a different screen', () => {
    mount('admin', 'me');
    expect(screen.getByTestId('me-view')).toBeTruthy();
    expect(screen.queryByTestId('admin-view')).toBeNull();
  });
});
