import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { coachEn } from '../i18n/coach.en';
import type { Notif, NotifState } from '../notifications';
import {
  emptyState,
  freezeClock,
  installIntersectionObserver,
  makeShell,
  NOW,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

vi.mock('./AdminView', () => ({
  AdminView: ({ onOpenProfile }: { onOpenProfile: (id: string) => void }) => (
    <div data-testid="admin">
      <button onClick={() => onOpenProfile('user-9')}>open user</button>
    </div>
  ),
}));
vi.mock('./ProfileView', () => ({
  ProfileView: ({
    userId,
    embedded,
    onClose,
  }: {
    userId: string;
    embedded?: boolean;
    onClose: () => void;
  }) => (
    <div data-testid="profile" data-user={userId} data-embedded={String(!!embedded)}>
      <button onClick={onClose}>close profile</button>
    </div>
  ),
}));

import { RosterApp, type RosterTab } from './RosterApp';
import { rosterHomeTab } from './rosterAccess';

const notif: Notif = { id: 'n1', kind: 'pr', ts: NOW - 1000, title: 'New PR', subtitle: 'Bench' };
const nstate: NotifState = { seen: {}, readAllAt: 0 } as unknown as NotifState;

function app(
  role: 'trainer' | 'admin' | 'member',
  tab: RosterTab,
  over: Partial<Parameters<typeof RosterApp>[0]> = {},
) {
  const props = {
    role,
    now: NOW,
    tab,
    onTab: vi.fn(),
    shell: makeShell(),
    onOpenShell: vi.fn(),
    notifs: [notif],
    notifState: nstate,
    notifUnread: 3,
    onNotifSeen: vi.fn(),
    onNotifMarkAll: vi.fn(),
    ...over,
  };
  return { ...render(<RosterApp {...props} />), props };
}

beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  seed(emptyState());
  setDesktop(false);
  installIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('rosterHomeTab', () => {
  it('Users for an admin, Me for everyone else (SPO-141)', () => {
    expect(rosterHomeTab('trainer')).toBe('me');
    expect(rosterHomeTab('admin')).toBe('users');
    expect(rosterHomeTab('member')).toBe('me');
  });
});

describe('RosterApp on a phone', () => {
  it('a trainer has only Me: no Users, no Clients, the app is named Me', () => {
    const { container } = app('trainer', 'me');
    expect(screen.getByTestId('profile')).toBeTruthy();
    // One destination: no bottom bar at all; the app is named in the header chip.
    expect(container.querySelector('.tabbar')).toBeNull();
    expect(container.querySelector('.uibrand-chip-name')?.textContent).toBe(en.navMe);
    expect(screen.queryByText(en.adminPeople)).toBeNull();
    expect(screen.queryByText(en.trClientsTab)).toBeNull();
    expect(screen.queryByTestId('admin')).toBeNull();
  });

  it('an admin on Users has only Users (Me is a separate screen), so no bottom bar', () => {
    const { container } = app('admin', 'users');
    expect(screen.getByTestId('admin')).toBeTruthy();
    expect(container.querySelector('.tabbar')).toBeNull();
    expect(container.querySelector('.uibrand-chip-name')?.textContent).toBe(en.adminPeople);
    expect(screen.queryByText(en.navMe)).toBeNull();
    expect(screen.queryByText(en.trClientsTab)).toBeNull();
  });

  it('a member only has Me, shown as an embedded profile of themself', () => {
    app('member', 'me');
    const p = screen.getByTestId('profile');
    expect(p.getAttribute('data-user')).toBe('me');
    expect(p.getAttribute('data-embedded')).toBe('true');
    expect(screen.queryByTestId('admin')).toBeNull();
  });

  it('opening a user from the admin list shows their profile; closing it returns to the list', () => {
    app('admin', 'users');
    fireEvent.click(screen.getByText('open user'));
    const p = screen.getByTestId('profile');
    expect(p.getAttribute('data-user')).toBe('user-9');
    expect(p.getAttribute('data-embedded')).toBe('false');
    expect(screen.queryByTestId('admin')).toBeNull();
    fireEvent.click(screen.getByText('close profile'));
    expect(screen.getByTestId('admin')).toBeTruthy();
  });

  it('switching to Me while a profile is open clears it', () => {
    const { props, rerender, container } = app('admin', 'users');
    fireEvent.click(screen.getByText('open user'));
    fireEvent.click(container.querySelector('.uibrand-avatar') as HTMLElement);
    fireEvent.click(screen.getByText(coachEn.moreProfile));
    expect(props.onTab).toHaveBeenCalledWith('me');
    rerender(<RosterApp {...props} tab="me" />);
    expect(screen.getByTestId('profile').getAttribute('data-user')).toBe('me');
  });

  it("closing an admin's own profile goes back to the role home tab (Users)", () => {
    const { props } = app('admin', 'me');
    fireEvent.click(screen.getByText('close profile'));
    expect(props.onTab).toHaveBeenCalledWith('users');
  });

  it('People has no bell (client apps only); the feed, if routed, still lists notifications', () => {
    const { props, rerender } = app('admin', 'users');
    expect(screen.queryByRole('button', { name: new RegExp(en.feedTitle) })).toBeNull();
    rerender(<RosterApp {...props} tab="feed" />);
    expect(screen.getByText('New PR')).toBeTruthy();
    expect(screen.queryByTestId('admin')).toBeNull();
  });

  it('the app switcher in the header opens the suite shell', () => {
    const { props } = app('admin', 'users');
    fireEvent.click(screen.getByRole('button', { name: en.shellSwitch }));
    expect(props.onOpenShell).toHaveBeenCalled();
  });
});

describe('RosterApp: profile entry points', () => {
  it('phone: the avatar drawer -> Profile opens my profile', () => {
    const { props, container } = app('member', 'me');
    fireEvent.click(container.querySelector('.uibrand-avatar') as HTMLElement);
    fireEvent.click(screen.getByText(coachEn.moreProfile));
    expect(props.onTab).toHaveBeenCalledWith('me');
  });

  it('desktop: the rail avatar menu opens my profile; no rail bell, the unread rides on Apps', () => {
    setDesktop(true);
    const { props, container } = app('admin', 'users');
    const rail = container.querySelector('.rail, [class*="rail"]') as HTMLElement;
    fireEvent.click(within(rail).getByRole('button', { name: coachEn.railProfile }));
    fireEvent.click(screen.getByText(coachEn.moreProfile));
    expect(props.onTab).toHaveBeenCalledWith('me');
    expect(within(rail).queryByRole('button', { name: new RegExp(en.notifTitle) })).toBeNull();
    expect(
      within(rail).getByRole('button', { name: new RegExp(`^${coachEn.navApps}`) }).textContent,
    ).toContain('3');
  });
});

describe('RosterApp on desktop', () => {
  beforeEach(() => setDesktop(true));

  it('uses the side rail instead of the bottom bar', () => {
    const { container } = app('admin', 'users');
    expect(container.querySelector('.rail, [class*="rail"]')).toBeTruthy();
    expect(screen.getByTestId('admin')).toBeTruthy();
  });

  it('the rail has one destination per screen; the feed highlights no tab', () => {
    const { props, rerender, container } = app('admin', 'users');
    expect(screen.getAllByText(en.adminPeople).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.navMe)).toBeNull();
    rerender(<RosterApp {...props} tab="feed" />);
    expect(container.querySelector('[aria-current="page"]')).toBeNull();
  });
});
