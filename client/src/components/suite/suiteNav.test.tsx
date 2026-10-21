/**
 * The suite navigation contract: Gym, Apex, People, Nutrition and Learn render the same rail and
 * phone More behaviour as Coach (kit Rail / MoreMenu / AccountPopover). One table drives all five
 * apps, so a rule cannot hold for four of them and quietly break for the fifth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../../i18n';
import { coachEn } from '../../i18n/coach.en';
import { coachEntryHash } from '../../coach/routes';
import { setViewport } from '../../coach/testViewport';
import { installRailMeasure, setRailHeight, uninstallRailMeasure } from '../ui/railTestUtils';
import { setSuiteSession } from './suiteSession';
import { publishClientShared } from '../../coach/client/shared';
import { SuiteTabBar } from '../SuiteTabBar';
import { BrandAccount } from './BrandAccount';
import { GymRail } from '../../App';
import { CoachShell } from '../../coach/CoachApp';
import { ApexApp } from '../../views/ApexApp';
import { RosterApp } from '../../views/RosterApp';
import { NutritionRoot } from '../../nutrition/App';
import { LearnRoot } from '../../learn/App';
import type { StoreState } from '../../store';
import type { Shell } from '../../App';
import { currentHash } from '../../route';

const t = LOCALES.en;
const c = coachEn;

const session = vi.hoisted(() => ({
  role: 'member' as 'member' | 'trainer' | 'admin',
  conditions: 0,
}));
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  getRole: () => session.role,
  getUsername: () => 'Iryna Koval',
  currentUid: () => 'u-1',
}));
vi.mock('../Avatar', () => ({
  UserAvatar: (p: { userId?: string; name: string; size?: number }) => (
    <span data-testid="real-avatar" data-uid={p.userId ?? ''} data-size={p.size} />
  ),
}));
vi.mock('../../views/health/ConditionsShield', () => ({
  ConditionsShield: () => <button type="button">shield</button>,
  useActiveConditions: () => session.conditions,
}));
vi.mock('../../coach/unread', async (orig) => ({
  ...(await orig<typeof import('../../coach/unread')>()),
  useCoachUnread: () => 0,
}));
vi.mock('../../views/ApexHome', () => ({ ApexHome: () => null }));
vi.mock('../../views/ChallengesView', () => ({ ChallengesView: () => null }));
vi.mock('../StandardsView', () => ({ StandardsView: () => null }));
vi.mock('../FeatsView', () => ({ FeatsView: () => null }));
vi.mock('../StatShareSheet', () => ({ StatShareSheet: () => null }));
vi.mock('../../views/NotificationsView', () => ({ NotificationsView: () => null }));
vi.mock('../../views/AdminView', () => ({ AdminView: () => null }));
vi.mock('../../views/ProfileView', () => ({ ProfileView: () => null }));
vi.mock('../../nutrition/store', () => ({
  store: {},
  useStore: () => ({ authReady: true, uid: 'u-1', lang: 'en' }),
}));
vi.mock('../../nutrition/views', () => ({
  TodayView: () => null,
  HistoryView: () => null,
  GoalView: () => null,
}));
vi.mock('../../nutrition/addflow', () => ({ AddFlow: () => null }));

const noop = () => undefined;
/** The phone avatar that opens the user drawer. */
const avatarButton = () => document.querySelector('.uibrand-avatar') as HTMLElement;
const notifProps = {
  now: 0,
  notifs: [],
  notifState: { seen: [], seenAt: 0 } as never,
  notifUnread: 0,
  onNotifSeen: noop,
  onNotifMarkAll: noop,
};

interface Cb {
  onShell: () => void;
  onProfile: () => void;
}
interface Case {
  name: string;
  /** Foot extras in rail order (top to bottom) for a member. */
  extras: string[];
  /** Rail destinations in rail order. */
  nav: (role: typeof session.role) => string[];
  rail: (cb: Cb) => ReactElement;
  /** Phone: the app's tab labels (no More: the account is the avatar's drawer). */
  tabs: (role: typeof session.role) => string[];
  phone: (cb: Cb) => ReactElement;
}

const gymNav = [t.today, t.overviewTab, t.gyms];
const gymItems = [
  { id: 'today', icon: 'house', label: t.today, active: true },
  { id: 'overview', icon: 'chart-line-up', label: t.overviewTab },
  { id: 'gyms', icon: 'map-pin', label: t.gyms },
];
const nutritionLabels = ['Today', 'History', 'Goal'];
const learnLabels = ['Home', 'Topics', 'Saved'];
// SPO-141: Users is admin-only and never shares a nav with Me; trainer and member get Me alone.
const rosterNav = (r: typeof session.role) => (r === 'admin' ? [t.adminPeople] : [t.navMe]);

const CASES: Case[] = [
  {
    name: 'Gym',
    extras: [t.masteryTitle, t.notifTitle, t.language],
    nav: () => gymNav,
    tabs: () => gymNav,
    rail: ({ onShell, onProfile }) => (
      <GymRail
        tab="today"
        overlayOpen={false}
        goTab={noop}
        onStart={noop}
        syncStatus="synced"
        notifUnread={0}
        onOpenShell={onShell}
        onOpenNotifications={noop}
        onOpenProfile={onProfile}
        onOpenSettings={noop}
        onOpenMastery={noop}
        onOpenHealth={noop}
      />
    ),
    // The bar and the avatar drawer, as the app composes them (the avatar owns the account).
    phone: ({ onProfile }) => (
      <>
        <BrandAccount app="gym" onOpenProfile={onProfile} />
        <SuiteTabBar
          app="gym"
          noMore
          noAccount
          items={gymItems}
          onSelect={noop}
          fab={{ ariaLabel: t.startNew, onClick: noop }}
        />
      </>
    ),
  },
  {
    name: 'Apex',
    extras: [t.notifTitle, t.language],
    nav: () => [t.apexHomeTab, t.challengesTab, t.apexRanksTab, t.apexAwardsTab],
    tabs: () => [t.apexHomeTab, t.challengesTab, t.apexRanksTab, t.apexAwardsTab],
    rail: (cb) => apex(cb),
    phone: (cb) => apex(cb),
  },
  {
    name: 'People',
    extras: [t.notifTitle, t.language],
    nav: rosterNav,
    tabs: rosterNav,
    rail: (cb) => roster(cb),
    phone: (cb) => roster(cb),
  },
  {
    name: 'Nutrition',
    extras: [t.notifTitle, t.language],
    nav: () => nutritionLabels,
    tabs: () => nutritionLabels,
    rail: (cb) => nutrition(cb),
    phone: (cb) => nutrition(cb),
  },
  {
    name: 'Learn',
    extras: [t.notifTitle, t.language],
    nav: () => learnLabels,
    tabs: () => learnLabels,
    rail: (cb) => learn(cb),
    phone: (cb) => learn(cb),
  },
];

function apex({ onShell, onProfile }: Cb) {
  return (
    <ApexApp
      store={{ workouts: [], bodyMetrics: { weights: [] } } as unknown as StoreState}
      tab="home"
      onTab={noop}
      onOpenShell={onShell}
      onOpenProfile={onProfile}
      {...notifProps}
    />
  );
}
function roster({ onShell, onProfile }: Cb) {
  return (
    <RosterApp
      role={session.role}
      tab={session.role === 'admin' ? 'users' : 'me'}
      // People's Profile row is its "me" tab.
      onTab={(next) => next === 'me' && onProfile()}
      shell={{} as unknown as Shell}
      onOpenShell={onShell}
      {...notifProps}
    />
  );
}
function nutrition({ onShell, onProfile }: Cb) {
  return <NutritionRoot onOpenShell={onShell} onOpenProfile={onProfile} {...notifProps} />;
}
function learn({ onShell, onProfile }: Cb) {
  return (
    <LearnRoot role="member" onOpenShell={onShell} onOpenProfile={onProfile} {...notifProps} />
  );
}

const rail = () => screen.getByRole('complementary', { name: c.navLandmark });
const navButtons = () => [...rail().querySelectorAll('.rail-nav > .rail-item')];
const navLabels = () => navButtons().map((b) => b.getAttribute('aria-label')?.split(',')[0]);
const footButtons = () => [
  ...rail().querySelectorAll('.rail-foot > .rail-item, .rail-foot .account-chip'),
];

beforeEach(() => {
  Element.prototype.scrollTo = noop;
  // Learn's progressive list reveal observes a sentinel; jsdom has no IntersectionObserver.
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  session.role = 'member';
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  installRailMeasure(900);
});
afterEach(() => {
  cleanup();
  uninstallRailMeasure();
});

describe.each(CASES)('$name: desktop rail', (k) => {
  const cb = () => ({ onShell: vi.fn(), onProfile: vi.fn() });

  it('>= 1280: labelled 88px rail, every destination visible, no More while everything fits', () => {
    setViewport(1440);
    const handlers = cb();
    const { container } = render(k.rail(handlers));
    expect(rail().className).toContain('rail--labelled');
    expect(rail().className).not.toContain('rail--compact');
    expect(navLabels()).toEqual(k.nav(session.role));
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    expect(container.querySelector('.tabbar')).toBeNull();
    // Labelled rail: the visible label under each nav icon and under Apps.
    expect(rail().querySelector('.rail-nav .rail-label')).not.toBeNull();
    expect(
      within(rail()).getByRole('button', { name: c.navApps }).querySelector('.rail-label')
        ?.textContent,
    ).toBe(c.navApps);
  });

  it('720..1279: 60px icon-only rail, every nav item and Apps carry a tooltip', () => {
    setViewport(1024);
    render(k.rail(cb()));
    expect(rail().className).toContain('rail--compact');
    for (const b of navButtons()) expect(b.querySelector('.rail-tip')?.textContent).toBeTruthy();
    expect(
      within(rail()).getByRole('button', { name: c.navApps }).querySelector('.rail-tip')
        ?.textContent,
    ).toBe(c.navApps);
  });

  it('foot: Apps sits directly above the avatar, always, and opens the launcher', () => {
    setViewport(1440);
    const h = cb();
    render(k.rail(h));
    const foot = footButtons();
    const names = foot.map((b) => b.getAttribute('aria-label'));
    expect(names.slice(-2)).toEqual([c.navApps, c.railProfile]);
    fireEvent.click(within(rail()).getByRole('button', { name: c.navApps }));
    expect(h.onShell).toHaveBeenCalledTimes(1);
    // Short window: Apps and the avatar are still there, in the same order.
    setRailHeight(60);
    expect(
      footButtons()
        .map((b) => b.getAttribute('aria-label'))
        .slice(-2),
    ).toEqual([c.navApps, c.railProfile]);
  });

  it('More appears only when the destinations do not fit, and lists only the overflow', () => {
    setViewport(1440);
    render(k.rail(cb()));
    setRailHeight(60);
    const more = within(rail()).getByRole('button', { name: c.navMore });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    // The More item is not part of the nav column; the nav shows what still fits (nothing at 60).
    expect(navButtons()).toHaveLength(0);
    fireEvent.click(more);
    const menu = screen.getByRole('dialog', { name: c.navMore });
    const rows = [...menu.querySelectorAll('button.uirow')].map((b) => b.textContent);
    // Nav entries first, then the collapsed foot extras as their own group.
    expect(rows).toEqual([...k.nav(session.role), ...k.extras]);
    // Overflow list only: no Apps, no account block, no Profile.
    expect(within(menu).queryByRole('button', { name: c.navApps })).toBeNull();
    expect(within(menu).queryByText('Iryna Koval')).toBeNull();
    expect(within(menu).queryByRole('button', { name: c.moreProfile })).toBeNull();
    setRailHeight(900);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
  });

  it('the avatar opens ONLY the account popover (real avatar 40, name, role, Profile)', () => {
    setViewport(1440);
    const h = cb();
    render(k.rail(h));
    setRailHeight(60);
    expect(within(rail()).getByTestId('real-avatar').dataset.size).toBe('34');
    expect(within(rail()).getByTestId('real-avatar').dataset.uid).toBe('u-1');
    fireEvent.click(within(rail()).getByRole('button', { name: c.railProfile }));
    const acct = screen.getByRole('dialog', { name: c.railProfile });
    expect(within(acct).getByText('Iryna Koval')).toBeTruthy();
    expect(within(acct).getByText(t.roleMember)).toBeTruthy();
    expect(within(acct).getByTestId('real-avatar').dataset.size).toBe('40');
    // No navigation, no Apps, no mode switch for a member.
    for (const l of [...k.nav(session.role), c.navApps, c.navMore])
      expect(within(acct).queryByRole('button', { name: l })).toBeNull();
    expect(within(acct).queryByRole('button', { name: c.modeMyWorkouts })).toBeNull();
    expect(within(acct).queryByText(c.modeNote)).toBeNull();
    fireEvent.click(within(acct).getByRole('button', { name: c.moreProfile }));
    expect(h.onProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mode switch by role: trainer / admin, nobody else', () => {
    setViewport(1440);
    const open = () => {
      cleanup();
      render(k.rail(cb()));
      fireEvent.click(within(rail()).getByRole('button', { name: c.railProfile }));
      return screen.getByRole('dialog', { name: c.railProfile });
    };
    // trainer: switch with the current side "My workouts", the privacy note, role label.
    session.role = 'trainer';
    let acct = open();
    expect(within(acct).getByRole('button', { name: c.modeCoach })).toBeTruthy();
    const pressed = (name: string) =>
      within(acct).getByRole('button', { name }).getAttribute('aria-pressed');
    // Only Gym is the "My workouts" side; in every other app NEITHER segment is selected.
    expect([pressed(c.modeCoach), pressed(c.modeMyWorkouts)]).toEqual(
      k.name === 'Gym' ? ['false', 'true'] : ['false', 'false'],
    );
    expect(within(acct).getByText(c.modeNote)).toBeTruthy();
    expect(within(acct).getByText(t.roleTrainer)).toBeTruthy();
    // choosing Coach opens the dashboard and closes the popover
    fireEvent.click(within(acct).getByRole('button', { name: c.modeCoach }));
    expect(currentHash()).toBe(coachEntryHash());
    expect(screen.queryByRole('dialog')).toBeNull();
    // selecting "My workouts" (where it is not already selected) goes to the Gym home
    if (k.name !== 'Gym') {
      acct = open();
      fireEvent.click(within(acct).getByRole('button', { name: c.modeMyWorkouts }));
      expect(currentHash()).toBe('#/today');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
    // admin
    window.history.replaceState(null, '', '/');
    session.role = 'admin';
    acct = open();
    expect(within(acct).getByRole('button', { name: c.modeCoach })).toBeTruthy();
    expect(within(acct).getByText(t.roleAdmin)).toBeTruthy();
    // member: nothing to switch to
    session.role = 'member';
    acct = open();
    expect(within(acct).queryByRole('button', { name: c.modeCoach })).toBeNull();
  });

  it('tiles never change size with the window height (no inline sizing, same tiles at 900/700/500)', () => {
    setViewport(1440);
    render(k.rail(cb()));
    const sizes = new Set<string>();
    for (const h of [900, 700, 500]) {
      setRailHeight(h);
      for (const b of navButtons()) expect(b.getAttribute('style')).toBeNull();
      sizes.add(String(navButtons().length));
    }
    expect(sizes.size).toBe(1);
  });
});

describe.each(CASES)('$name: phone (< 720)', (k) => {
  it('keeps its tabs, no rail, no More tab (the account is the avatar drawer)', () => {
    setViewport(390);
    const { container } = render(k.phone({ onShell: vi.fn(), onProfile: vi.fn() }));
    expect(screen.queryByRole('complementary')).toBeNull();
    const bar = container.querySelector('.tabbar') as HTMLElement;
    // One destination (People for a member): no bar at all.
    if (k.tabs(session.role).length <= 1) return expect(bar).toBeNull();
    expect(bar).not.toBeNull();
    const labels = [...bar.querySelectorAll('button:not(.tabbar-fab)')].map((b) => b.textContent);
    expect(labels).toEqual(k.tabs(session.role));
    expect(within(bar).queryByRole('button', { name: c.navMore })).toBeNull();
    expect(within(bar).queryByRole('button', { name: c.navApps })).toBeNull();
    expect(within(bar).queryByRole('button', { name: t.shellSwitch })).toBeNull();
  });

  it('avatar drawer: the account block (avatar 40, Profile); no Apps row, the BrandBar chip switches apps', () => {
    setViewport(390);
    session.role = 'trainer';
    const h = { onShell: vi.fn(), onProfile: vi.fn() };
    render(k.phone(h));
    fireEvent.click(avatarButton());
    expect(screen.getByRole('heading', { name: c.railProfile })).toBeTruthy();
    // colour-coded to the current app, like the launcher sheet
    const fam = { Gym: 'gym', Apex: 'apex', People: 'people', Nutrition: 'kcal', Learn: 'learn' }[
      k.name as 'Gym'
    ];
    const sheet = document.querySelector('.sheet.uimore') as HTMLElement;
    expect(sheet.classList.contains('sheet--toned')).toBe(true);
    expect(sheet.classList.contains(`uit--${fam}`)).toBe(true);
    const body = document.querySelector('.uimore-body') as HTMLElement;
    const rows = [...body.querySelectorAll('.uigl-rows button.uirow')].map((b) => b.textContent);
    expect(rows).not.toContain(c.navApps);
    expect(within(body).queryByRole('button', { name: c.navApps })).toBeNull();
    expect([...body.querySelectorAll('.uiacct-action')].map((b) => b.textContent)).toEqual([
      c.moreProfile,
    ]);
    expect(within(body).getByTestId('real-avatar').dataset.size).toBe('40');
    // trainer: the mode switch and its note are in the account block
    expect(
      within(body).getByRole('button', { name: c.modeMyWorkouts }).getAttribute('aria-pressed'),
    ).toBe(k.name === 'Gym' ? 'true' : 'false');
    expect(
      within(body).getByRole('button', { name: c.modeCoach }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(within(body).getByText(c.modeNote)).toBeTruthy();
  });

  it('a member sees no mode switch on the phone either', () => {
    setViewport(390);
    render(k.phone({ onShell: vi.fn(), onProfile: vi.fn() }));
    fireEvent.click(avatarButton());
    const body = document.querySelector('.uimore-body') as HTMLElement;
    expect(within(body).queryByRole('button', { name: c.modeCoach })).toBeNull();
    expect(within(body).queryByText(c.modeNote)).toBeNull();
    expect(within(body).getByText(t.roleMember)).toBeTruthy();
  });
});

describe('Gym specifics', () => {
  it('R-KIT-21: the trainer chat unread sits on Today in the real rail, with a spoken label, and only with a trainer', () => {
    setViewport(1440);
    session.role = 'member';
    publishClientShared({ hasTrainer: true, unread: 3, unreadLabel: '3 unread messages' });
    const { rerender } = render(
      <GymRail
        tab="today"
        overlayOpen={false}
        goTab={noop}
        onStart={noop}
        syncStatus="synced"
        notifUnread={0}
        onOpenShell={noop}
        onOpenNotifications={noop}
        onOpenProfile={noop}
        onOpenSettings={noop}
        onOpenMastery={noop}
        onOpenHealth={noop}
      />,
    );
    const today = navButtons()[0] as HTMLElement;
    expect(today.textContent).toContain('3');
    expect(today.getAttribute('aria-label') ?? today.textContent).toContain('3 unread messages');
    act(() => publishClientShared(null));
    expect(navButtons()[0].textContent).not.toMatch(/3/);
    rerender(<span />);
  });

  it('Today carries the live dot while a workout is open; admin gets Settings in the foot', () => {
    setViewport(1440);
    session.role = 'admin';
    const { rerender } = render(
      <GymRail
        tab="today"
        overlayOpen={false}
        goTab={noop}
        onStart={noop}
        openWorkoutStartedAt={1}
        syncStatus="offline"
        notifUnread={3}
        onOpenShell={noop}
        onOpenNotifications={noop}
        onOpenProfile={noop}
        onOpenSettings={noop}
        onOpenMastery={noop}
        onOpenHealth={noop}
      />,
    );
    expect(navButtons()[0].querySelector('.rail-live-dot')).not.toBeNull();
    expect(within(rail()).getByRole('button', { name: t.settingsTitle })).toBeTruthy();
    // notifications badge keeps its text, avatar its sync dot
    expect(within(rail()).getByRole('button', { name: t.notifTitle }).textContent).toContain('3');
    expect(rail().querySelector('.account-avatar .dot')).not.toBeNull();
    rerender(<span />);
  });

  it('an open overlay lights no destination', () => {
    setViewport(1440);
    render(
      <GymRail
        tab="today"
        overlayOpen
        goTab={noop}
        onStart={noop}
        syncStatus="synced"
        notifUnread={0}
        onOpenShell={noop}
        onOpenNotifications={noop}
        onOpenProfile={noop}
        onOpenSettings={noop}
        onOpenMastery={noop}
        onOpenHealth={noop}
      />,
    );
    expect(rail().querySelector('.rail-nav > .rail-item.active')).toBeNull();
  });
});

describe('Apex: partial overflow keeps the leading destinations', () => {
  it('270px: two destinations stay, the other two move into More in order', () => {
    setViewport(1440);
    render(apex({ onShell: noop, onProfile: noop }));
    setRailHeight(270);
    expect(navLabels()).toEqual([t.apexHomeTab, t.challengesTab]);
    fireEvent.click(within(rail()).getByRole('button', { name: c.navMore }));
    const rows = [
      ...screen.getByRole('dialog', { name: c.navMore }).querySelectorAll('button.uirow'),
    ];
    expect(rows.map((b) => b.textContent)).toEqual([
      t.apexRanksTab,
      t.apexAwardsTab,
      t.notifTitle,
      t.language,
    ]);
    // A hidden destination selected from More navigates (and the menu closes).
  });
});

describe('real-app CSS does not fight the shared rail geometry', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'nutrition', 'nutrition.css'), 'utf8');
  it('Nutrition keeps no rail width / tile size of its own', () => {
    const rule = (sel: string) => {
      const at = css.indexOf(sel + ' {');
      return css.slice(at, css.indexOf('}', at));
    };
    expect(rule('.app-nutrition .rail-item')).not.toMatch(/\b(width|height|display)\s*:/);
    expect(css).not.toMatch(/\.app-nutrition \.rail \{[^}]*width:\s*74px/);
  });
});

describe('Overflow order: foot extras collapse before the nav (Gym, tall foot)', () => {
  // Labelled rail: nav tile 64 (pitch 69.6, 3 entries = 203.2), foot extra 44 (pitch 49.6).
  // Admin with an active condition: shield, mastery, bell, gear, language (SPO-164) = 5 extras = 248.
  const gym = (unread = 0) => (
    <GymRail
      tab="today"
      overlayOpen={false}
      goTab={noop}
      onStart={noop}
      syncStatus="synced"
      notifUnread={unread}
      onOpenShell={noop}
      onOpenNotifications={noop}
      onOpenProfile={noop}
      onOpenSettings={noop}
      onOpenMastery={noop}
      onOpenHealth={noop}
    />
  );
  const extraCount = () => rail().querySelectorAll('.rail-extra').length;
  const moreBtn = () => within(rail()).getByRole('button', { name: new RegExp(`^${c.navMore}`) });
  const menuRows = () => {
    fireEvent.click(moreBtn());
    const rows = [
      ...screen.getByRole('dialog', { name: c.navMore }).querySelectorAll('button.uirow'),
    ].map((b) => b.textContent);
    fireEvent.click(moreBtn());
    return rows;
  };
  beforeEach(() => {
    setViewport(1440);
    session.role = 'admin';
    session.conditions = 1;
  });

  it('everything fits: no More, all five extras', () => {
    render(gym());
    setRailHeight(460);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    expect(navLabels()).toEqual(gymNav);
    expect(extraCount()).toBe(5);
  });

  it('too short for even one extra: ALL five go into More at once, the nav stays whole', () => {
    render(gym());
    // 5 extras = 248 on top of the 203.2 nav: 451.2 fits; 1px less hides every extra.
    for (const h of [451, 430, 380, 330, 290]) {
      setRailHeight(h);
      expect(extraCount(), String(h)).toBe(0);
      expect(navLabels(), String(h)).toEqual(gymNav);
    }
    // in the order of the rail: conditions shield, mastery, bell, settings, language
    expect(menuRows()).toEqual([
      t.cndTodayTitle(1),
      t.masteryTitle,
      t.notifTitle,
      t.settingsTitle,
      t.language,
    ]);
  });

  it('More sits in the nav column right below the last visible nav item, not in the foot', () => {
    render(gym());
    setRailHeight(250);
    const kids = [...rail().querySelectorAll('.rail-nav > *')];
    expect(kids.map((k) => k.className.includes('rail-more'))).toEqual([false, false, true]);
    expect(rail().querySelector('.rail-foot .rail-more')).toBeNull();
    // the foot is only Apps + avatar (extras are all in More)
    expect(footButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
      c.navApps,
      c.railProfile,
    ]);
  });

  it('only when every extra is hidden do nav entries collapse, from the end', () => {
    render(gym());
    setRailHeight(290);
    expect(extraCount()).toBe(0);
    expect(navLabels()).toEqual(gymNav);
    setRailHeight(250);
    expect(extraCount()).toBe(0);
    expect(navLabels()).toEqual([t.today, t.overviewTab]);
    const rows = menuRows();
    expect(rows[0]).toBe(t.gyms);
    expect(rows.slice(1)).toHaveLength(5);
    // Apps and the avatar are pinned all the way down
    setRailHeight(40);
    expect(
      footButtons()
        .map((b) => b.getAttribute('aria-label'))
        .slice(-2),
    ).toEqual([c.navApps, c.railProfile]);
  });

  it('a hidden bell with unread lights More (badge + spoken count); the row keeps its badge', () => {
    render(gym(3));
    setRailHeight(380);
    const more = within(rail()).getByRole('button', { name: `${c.navMore}, ${c.unread(3)}` });
    expect(more.querySelector('.uibadge')?.textContent).toBe('3');
    fireEvent.click(more);
    const menu = screen.getByRole('dialog', { name: c.navMore });
    expect(within(menu).getByRole('button', { name: t.notifTitle }).textContent).toContain('3');
    fireEvent.click(more);
    // everything fits again: the badge leaves More and shows on the bell
    setRailHeight(460);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    expect(within(rail()).getByRole('button', { name: /Notifications/ }).textContent).toContain(
      '3',
    );
  });

  it('the conditions shield only takes a slot while a condition is active', () => {
    session.conditions = 0;
    render(gym());
    setRailHeight(900);
    expect(extraCount()).toBe(4);
  });
});

describe('no online / presence dot on navigation avatars', () => {
  it('rail avatar, popover and phone sheet avatars carry no status dot while synced', () => {
    setViewport(1440);
    const { unmount } = render(
      <GymRail
        tab="today"
        overlayOpen={false}
        goTab={noop}
        onStart={noop}
        syncStatus="synced"
        notifUnread={0}
        onOpenShell={noop}
        onOpenNotifications={noop}
        onOpenProfile={noop}
        onOpenSettings={noop}
        onOpenMastery={noop}
        onOpenHealth={noop}
      />,
    );
    expect(rail().querySelector('.account-avatar .dot')).toBeNull();
    fireEvent.click(within(rail()).getByRole('button', { name: c.railProfile }));
    expect(screen.getByRole('dialog').querySelector('.dot')).toBeNull();
    unmount();
    cleanup();
    setViewport(390);
    render(CASES[0].phone({ onShell: noop, onProfile: noop }));
    fireEvent.click(avatarButton());
    expect(document.querySelector('.uimore-body .dot')).toBeNull();
  });
});

describe('same rail geometry in all six apps (no layout shift when switching apps)', () => {
  const coach = () => (
    <CoachShell
      role="trainer"
      name="Iryna Koval"
      route={{ screen: 'agenda' }}
      onNavigate={noop}
      onExitToWorkouts={noop}
      onOpenShell={noop}
    />
  );
  /** Everything that decides where a button sits: classes, brand block, tile classes, order. */
  const signature = () => {
    const aside = rail();
    const tile = (el: Element | null) =>
      (el?.className ?? '')
        .replace(/\b(active|is-tip-off)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const first = aside.querySelector('.rail-nav > .rail-item');
    const apps = [...aside.querySelectorAll('.rail-foot .rail-item')].find(
      (b) => b.getAttribute('aria-label') === c.navApps,
    );
    return {
      aside: tile(aside)
        .replace(/\brail--(coach|overflow)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
      brand: aside.querySelector('.rail-brand')?.outerHTML,
      children: [...aside.children].map((e) => e.className.split(' ')[0]),
      navClass: tile(first),
      navInline: first?.getAttribute('style') ?? null,
      navHasLabel: !!first?.querySelector('.rail-label'),
      appsClass: tile(apps ?? null),
      accountClass: aside.querySelector('.rail-foot .account-chip')?.className,
      // The pinned foot (Apps + avatar slot): same elements, classes and avatar size, so the
      // avatar and Apps sit at the same offset from the bottom (sizes are fixed in Rail.css).
      footTail: [...aside.querySelectorAll('.rail-foot > *')]
        .slice(-2)
        .map((e) => `${e.tagName}.${tile(e)}`),
      footOutline: [
        ...(aside.querySelector('.rail-foot .rail-account')?.querySelectorAll('*') ?? []),
      ].map((e) => `${e.tagName}.${tile(e)}`),
      avatarSize: aside
        .querySelector('.rail-foot [data-testid="real-avatar"]')
        ?.getAttribute('data-size'),
    };
  };

  it.each([1440, 1024])(
    'at %ipx every app produces the identical rail frame and tile classes',
    (w) => {
      setViewport(w);
      const sigs: Record<string, ReturnType<typeof signature>> = {};
      for (const k of CASES) {
        cleanup();
        render(k.rail({ onShell: noop, onProfile: noop }));
        setRailHeight(900);
        sigs[k.name] = signature();
      }
      cleanup();
      render(coach());
      setRailHeight(900);
      sigs.Coach = signature();
      const ref = sigs.Gym;
      expect(ref.navClass).toContain('rail-item');
      expect(ref.avatarSize).toBe('34');
      expect(ref.footTail).toHaveLength(2);
      for (const [name, sig] of Object.entries(sigs))
        expect({ name, ...sig }).toEqual({ name, ...ref });
    },
  );
});

describe.each([
  ...CASES.map((k) => ({
    name: k.name,
    desktop: (cbk: Cb) => k.rail(cbk),
    phone: (cbk: Cb) => k.phone(cbk),
  })),
  {
    name: 'Coach',
    desktop: (cbk: Cb) => (
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        route={{ screen: 'agenda' }}
        onNavigate={noop}
        onExitToWorkouts={noop}
        onOpenProfile={cbk.onProfile}
        onOpenShell={cbk.onShell}
      />
    ),
    phone: (cbk: Cb) => (
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        route={{ screen: 'agenda' }}
        onNavigate={noop}
        onExitToWorkouts={noop}
        onOpenProfile={cbk.onProfile}
        onOpenShell={cbk.onShell}
      />
    ),
  },
])('$name: Sign out lives in the account block, under Profile', (k) => {
  const signOut = vi.fn();
  let unregister: () => void;
  beforeEach(() => {
    signOut.mockClear();
    unregister = setSuiteSession({ signOut, queueLength: 0 });
  });
  afterEach(() => unregister());
  const cbk = () => ({ onShell: vi.fn(), onProfile: vi.fn() });
  const flow = (acct: HTMLElement) => {
    const labels = [...acct.querySelectorAll('.uiacct-action')].map((b) => b.textContent);
    expect(labels).toEqual([c.moreProfile, t.signOut]); // Profile -> Sign out
    fireEvent.click(within(acct).getByRole('button', { name: t.signOut }));
    // The menu closed; the existing confirm dialog is up. Cancel does nothing ...
    const dlg = screen.getByRole('alertdialog');
    expect(within(dlg).getByText(t.signOutTitle)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: t.cancel }));
    expect(signOut).not.toHaveBeenCalled();
  };
  const confirm = () => {
    const dlg = screen.getByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: t.signOut }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  };

  it('desktop avatar popover', () => {
    setViewport(1440);
    render(k.desktop(cbk()));
    setRailHeight(60);
    const open = () => fireEvent.click(within(rail()).getByRole('button', { name: c.railProfile }));
    open();
    flow(screen.getByRole('dialog', { name: c.railProfile }));
    open();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: c.railProfile })).getByRole('button', {
        name: t.signOut,
      }),
    );
    confirm();
  });

  it('phone avatar drawer: the account block, Profile then Sign out', () => {
    setViewport(390);
    render(k.phone(cbk()));
    const open = () => fireEvent.click(avatarButton());
    open();
    const body = document.querySelector('.uimore-body') as HTMLElement;
    const idx = (el: Element) => [...body.querySelectorAll('*')].indexOf(el);
    expect(idx(within(body).getByRole('button', { name: t.signOut }))).toBeGreaterThan(
      idx(body.querySelector('.uiacct-action') as HTMLElement),
    );
    flow(body.querySelector('.uiacct') as HTMLElement);
    open();
    fireEvent.click(within(document.body).getByRole('button', { name: t.signOut }));
    confirm();
  });

  it('the launcher no longer has a Sign out', () => {
    expect(readFileSync(join(__dirname, '..', 'ShellLauncher.tsx'), 'utf8')).not.toMatch(
      /signOut|shell-signout/,
    );
  });
});

describe('no registered session: no Sign out row', () => {
  it('desktop popover without a session', () => {
    setViewport(1440);
    render(CASES[0].rail({ onShell: noop, onProfile: noop }));
    fireEvent.click(within(rail()).getByRole('button', { name: c.railProfile }));
    expect(screen.queryByRole('button', { name: t.signOut })).toBeNull();
  });
});
