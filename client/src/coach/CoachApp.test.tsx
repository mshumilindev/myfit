import { todayEn } from '../i18n/coachToday.en';
import { rosterEn } from '../i18n/coachRoster.en';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  configure,
  fireEvent,
  waitFor,
  render,
  screen,
  within,
} from '@testing-library/react';

// the screens are lazy chunks: a slow machine needs more than the default 1 s to show them
configure({ asyncUtilTimeout: 5000 });
import { useState } from 'react';
import { coachEn } from '../i18n/coach.en';
import { CoachApp, CoachShell } from './CoachApp';
import { coachEntryHash, type CoachRoute } from './routes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setViewport } from './testViewport';
import {
  installRailMeasure,
  setRailHeight,
  uninstallRailMeasure,
} from '../components/ui/railTestUtils';
import { currentHash } from '../route';

const unreadMock = vi.hoisted(() => ({ value: 0 }));
vi.mock('./unread', async (orig) => ({
  ...(await orig<typeof import('./unread')>()),
  useCoachUnread: () => unreadMock.value,
}));

const c = coachEn;

function Harness({
  onExit = () => undefined,
  initial = { screen: 'agenda' } as CoachRoute,
  onProfile,
  onShell = () => undefined,
}: {
  onExit?: () => void;
  initial?: CoachRoute;
  onProfile?: () => void;
  onShell?: () => void;
}) {
  const [route, setRoute] = useState<CoachRoute>(initial);
  return (
    <CoachShell
      role="trainer"
      name="Iryna Koval"
      route={route}
      onNavigate={setRoute}
      onExitToWorkouts={onExit}
      onOpenProfile={onProfile}
      onOpenShell={onShell}
    />
  );
}

beforeEach(() => {
  unreadMock.value = 0;
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

vi.mock('../components/Avatar', () => ({
  UserAvatar: (p: { userId?: string; name: string; size?: number; hasPhoto?: boolean }) => (
    <span
      data-testid="real-avatar"
      data-uid={p.userId ?? ''}
      data-size={p.size}
      data-photo={String(!!p.hasPhoto)}
      data-name={p.name}
    />
  ),
}));

const EIGHT = [
  c.navAgenda,
  c.navClients,
  c.navSchedule,
  c.navWeek,
  c.navDecisions,
  c.navPrograms,
  c.navChat,
  c.navTeam,
];
const navLabels = () =>
  [...screen.getByRole('complementary').querySelectorAll('.rail-nav > .rail-item')].map(
    (b) => b.getAttribute('aria-label')?.split(',')[0],
  );
const footLabels = () =>
  [...screen.getByRole('complementary').querySelectorAll('.rail-foot button')].map((b) =>
    b.getAttribute('aria-label'),
  );

describe('rail: exactly the eight design items (seven + Team); Apps pinned in the foot; More only on overflow', () => {
  beforeEach(() => installRailMeasure(900));
  afterEach(uninstallRailMeasure);

  it('1440, tall: eight nav items (no Live / Signals / Apps among them), foot = Apps, avatar; no More', () => {
    setViewport(1440);
    const onShell = vi.fn();
    render(<Harness onShell={onShell} />);
    expect(navLabels()).toEqual(EIGHT);
    expect(footLabels()).toEqual([c.navApps, c.railProfile]);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    for (const l of [c.navLive, c.navSignals])
      expect(screen.queryByRole('complementary')?.textContent).not.toContain(l);
    const apps = within(screen.getByRole('complementary')).getByRole('button', { name: c.navApps });
    expect(apps.querySelector('.rail-label')?.textContent).toBe(c.navApps);
    expect(apps.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(apps);
    expect(onShell).toHaveBeenCalledTimes(1);
  });

  it('exact fit (8 x 69.6 - 5.6 = 551.2) shows no More; one px less moves the trailing two into More', () => {
    setViewport(1440);
    setRailHeight(552);
    render(<Harness />);
    expect(navLabels()).toEqual(EIGHT);
    expect(footLabels()).toEqual([c.navApps, c.railProfile]);
    setRailHeight(551);
    expect(navLabels()).toEqual(EIGHT.slice(0, 6));
    // More sits in the nav column, right below the last visible nav item; the foot is only Apps + avatar.
    expect(footLabels()).toEqual([c.navApps, c.railProfile]);
    const kids = [...document.querySelectorAll('.rail-nav > *')];
    expect(kids).toHaveLength(7);
    expect(kids[6].classList.contains('rail-more')).toBe(true);
    expect(kids[5].textContent).toContain(c.navPrograms);
  });

  it('300: More (right below the last visible nav item) lists only the overflowed nav items, in order, no Apps, no account', () => {
    setViewport(1440);
    setRailHeight(300);
    render(<Harness />);
    expect(navLabels()).toEqual(EIGHT.slice(0, 3));
    fireEvent.click(screen.getByRole('button', { name: c.navMore }));
    const dlg = screen.getByRole('dialog', { name: c.navMore });
    expect([...dlg.querySelectorAll('button.uirow')].map((b) => b.textContent)).toEqual(
      EIGHT.slice(3),
    );
    expect(within(dlg).queryByRole('button', { name: c.navApps })).toBeNull();
    expect(within(dlg).queryByText('Iryna Koval')).toBeNull();
    expect(within(dlg).queryByText(c.modeNote)).toBeNull();
  });

  it('Apps stays visible and pinned however short the rail is', () => {
    setViewport(1440);
    setRailHeight(60);
    const onShell = vi.fn();
    render(<Harness onShell={onShell} />);
    expect(navLabels()).toEqual([]);
    expect(footLabels()).toEqual([c.navApps, c.railProfile]);
    expect(document.querySelectorAll('.rail-nav > .rail-more')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: c.navApps }));
    expect(onShell).toHaveBeenCalledTimes(1);
  });

  it('follows the height live (ResizeObserver): 900 -> 300 -> 900, no oscillation', () => {
    setViewport(1440);
    render(<Harness />);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    setRailHeight(300);
    expect(screen.getByRole('button', { name: c.navMore })).toBeTruthy();
    setRailHeight(300);
    expect(navLabels()).toEqual(EIGHT.slice(0, 3));
    setRailHeight(900);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
    expect(navLabels()).toEqual(EIGHT);
  });

  it('More has a menu name, aria-haspopup, aria-expanded; a destination navigates, closes it and lights More', async () => {
    setViewport(1440);
    setRailHeight(300);
    render(<Harness />);
    const more = screen.getByRole('button', { name: c.navMore });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(
      within(screen.getByRole('dialog', { name: c.navMore })).getByRole('button', {
        name: c.navPrograms,
      }),
    );
    // Programs is a lazy screen: its heading arrives after the chunk loads
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(c.navPrograms);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: c.navMore }).className).toContain('active');
  });

  it('the avatar holds ONLY the account (no navigation, no Apps)', () => {
    setViewport(1440);
    setRailHeight(300);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    const acct = screen.getByRole('dialog', { name: c.railProfile });
    expect(within(acct).getByText('Iryna Koval')).toBeTruthy();
    expect(within(acct).getByText(c.roleTrainer)).toBeTruthy();
    expect(within(acct).getByText(c.modeNote)).toBeTruthy();
    expect(within(acct).getByRole('button', { name: c.modeMyWorkouts })).toBeTruthy();
    for (const l of [c.navApps, c.navLive, c.navSignals, c.navPrograms])
      expect(within(acct).queryByRole('button', { name: l })).toBeNull();
  });

  it('1024: the same rule on the 60px rail; More is icon + tooltip, Apps icon + tooltip', () => {
    setViewport(1024);
    setRailHeight(300);
    render(<Harness />);
    // compact tile 44, pitch 49.6: 8 fit in 392; at 300 five stay.
    expect(navLabels()).toEqual(EIGHT.slice(0, 5));
    const rail = screen.getByRole('complementary');
    expect(
      within(rail).getByRole('button', { name: c.navMore }).querySelector('.rail-tip')?.textContent,
    ).toBe(c.navMore);
    expect(
      within(rail).getByRole('button', { name: c.navApps }).querySelector('.rail-tip')?.textContent,
    ).toBe(c.navApps);
    setRailHeight(392);
    expect(screen.queryByRole('button', { name: c.navMore })).toBeNull();
  });

  it('tile heights never change with viewport height: same fixed 72x64 tiles at 1000/720/600/500', () => {
    setViewport(1440);
    const seen: number[] = [];
    render(<Harness />);
    for (const h of [1000, 720, 600, 500]) {
      setRailHeight(h);
      const tiles = [
        ...screen.getByRole('complementary').querySelectorAll('.rail-nav > .rail-item'),
      ];
      // No inline sizing on any tile (nothing computes or squeezes a height in JS)...
      for (const t of tiles) expect(t.getAttribute('style')).toBeNull();
      seen.push(tiles.length);
    }
    // ...the count is the only thing that follows the height (600 still fits 8: 551.2; 500 keeps 6 and More).
    expect(seen).toEqual([8, 8, 8, 6]);
    setRailHeight(200);
    expect(navLabels()).toHaveLength(1);
    // ...and CSS pins the original tiles: labelled 72x64, compact 44, flex none, top aligned, 5.6 gap.
    const css = readFileSync(join(__dirname, '..', 'components', 'ui', 'Rail.css'), 'utf8');
    expect(css).toMatch(/\.rail--overflow \.rail-item \{[^}]*flex: none;/);
    expect(css).toMatch(/\.rail--labelled \.rail-item \{[^}]*width: 72px;[^}]*height: 64px;/);
    expect(css).toMatch(/\.rail--compact \.rail-item \{[^}]*height: 44px;/);
    expect(css).toMatch(
      /\.rail-nav \{[^}]*justify-content: flex-start;[^}]*gap: var\(--space-2\);/,
    );
  });

  it('avatar is the real avatar (34px, user id) in the foot; account block 40px', () => {
    setViewport(1440);
    render(
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        userId="u-1"
        route={{ screen: 'agenda' }}
        onNavigate={() => undefined}
        onExitToWorkouts={() => undefined}
        onOpenShell={() => undefined}
      />,
    );
    const rail = screen.getByRole('complementary');
    const inRail = within(rail).getByTestId('real-avatar');
    expect(inRail.dataset.uid).toBe('u-1');
    expect(inRail.dataset.size).toBe('34');
    expect(inRail.dataset.photo).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    expect(within(screen.getByRole('dialog')).getByTestId('real-avatar').dataset.size).toBe('40');
  });
});

describe('phone More sheet', () => {
  it('390: destinations, then Apps LAST, then the account block (avatar 40)', () => {
    setViewport(390);
    const onShell = vi.fn();
    render(
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        userId="u-1"
        route={{ screen: 'agenda' }}
        onNavigate={() => undefined}
        onExitToWorkouts={() => undefined}
        onOpenProfile={() => undefined}
        onOpenShell={onShell}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: c.navMore }));
    expect(screen.getByRole('heading', { name: c.navMore })).toBeTruthy();
    const sheet = document.querySelector('.uimore-body') as HTMLElement;
    const rows = [...sheet.querySelectorAll('.uigl-rows button.uirow')].map((b) => b.textContent);
    expect(rows).toEqual([
      c.navWeek,
      c.navDecisions,
      c.navPrograms,
      c.navLive,
      c.navSignals,
      c.navTeam,
      c.navApps,
    ]);
    // the account block follows: Profile pill (no Sign out without a registered session)
    expect([...sheet.querySelectorAll('.uiacct-action')].map((b) => b.textContent)).toEqual([
      c.moreProfile,
    ]);
    const idx = (el: Element) => [...sheet.querySelectorAll('*')].indexOf(el);
    expect(idx(screen.getByText('Iryna Koval'))).toBeGreaterThan(
      idx(screen.getByRole('button', { name: c.navApps })),
    );
    expect(within(sheet).getByTestId('real-avatar').dataset.size).toBe('40');
    fireEvent.click(screen.getByRole('button', { name: c.navApps }));
    expect(onShell).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(c.modeNote)).toBeNull();
  });
});

describe('theme', () => {
  it('puts the tourmaline accent on the document root while Coach is open', () => {
    setViewport(1440);
    const { unmount } = render(<Harness />);
    expect(document.documentElement.classList.contains('theme-coach')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('theme-coach')).toBe(false);
  });
});

describe('rail (>= 768)', () => {
  it('1440: labelled 88px rail, eight items with visible labels, no tab bar', () => {
    setViewport(1440);
    const { container } = render(<Harness />);
    const rail = screen.getByRole('complementary', { name: c.navLandmark });
    expect(rail.className).toContain('rail--labelled');
    expect(rail.className).not.toContain('rail--compact');
    expect(rail.className).toContain('rail--coach');
    const labels = [...rail.querySelectorAll('.rail-label')].map((e) => e.textContent);
    expect(labels).toEqual([
      c.navAgenda,
      c.navClients,
      c.navSchedule,
      c.navWeek,
      c.navDecisions,
      c.navPrograms,
      c.navChat,
      c.navTeam,
      c.navApps,
    ]);
    expect(container.querySelector('.tabbar')).toBeNull();
  });

  it('1024: compact 60px rail, icons only; every item has an aria-label and a tooltip', () => {
    setViewport(1024);
    render(<Harness />);
    const rail = screen.getByRole('complementary', { name: c.navLandmark });
    expect(rail.className).toContain('rail--compact');
    for (const name of [
      c.navAgenda,
      c.navClients,
      c.navSchedule,
      c.navWeek,
      c.navDecisions,
      c.navPrograms,
      c.navChat,
      c.navTeam,
    ]) {
      const btn = within(rail).getByRole('button', { name });
      expect(btn.getAttribute('title')).toBeNull();
      expect(btn.querySelector('.rail-tip')?.textContent).toBe(name);
      expect(btn.querySelector('svg')).not.toBeNull();
    }
  });

  it('marks the active item and navigates', async () => {
    setViewport(1440);
    render(<Harness />);
    const rail = screen.getByRole('complementary');
    expect(within(rail).getByRole('button', { name: c.navAgenda }).className).toContain('active');
    fireEvent.click(within(rail).getByRole('button', { name: c.navSchedule }));
    expect(within(rail).getByRole('button', { name: c.navSchedule }).className).toContain('active');
    /* Schedule is a lazy screen now (M6): its heading arrives after the placeholder skeleton. */
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(c.navSchedule),
    );
  });

  it('a client page keeps Clients lit and offers a Back button', async () => {
    setViewport(1440);
    render(<Harness initial={{ screen: 'client', cid: 'abc' }} />);
    const rail = screen.getByRole('complementary');
    expect(within(rail).getByRole('button', { name: c.navClients }).className).toContain('active');
    /* Client 360 is a lazy screen now: unknown id -> "not on your list" state with a Back button. */
    await waitFor(() =>
      expect(
        document.querySelector('#co-main .c3-sub, #co-main [role="status"], #co-main button'),
      ).not.toBeNull(),
    );
    const main = document.getElementById('co-main') as HTMLElement;
    fireEvent.click(
      await within(main).findByRole('button', { name: rosterEn.roBack }, { timeout: 5000 }),
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(c.navClients);
  });

  it('chat badge: nothing at 0, "9+" glyph and a spoken count above 9', () => {
    setViewport(1440);
    const { rerender, container } = render(<Harness />);
    expect(container.querySelector('.uibadge')).toBeNull();
    unreadMock.value = 23;
    rerender(<Harness />);
    expect(container.querySelector('.rail .uibadge')?.textContent).toBe('9+');
    expect(screen.getByRole('button', { name: `${c.navChat}, ${c.unread(23)}` })).toBeTruthy();
  });
});

describe('tab bar (< 768)', () => {
  it('390: five tabs Agenda, Clients, Schedule, Chat, More; no rail', () => {
    setViewport(390);
    const { container } = render(<Harness />);
    expect(container.querySelector('aside.rail')).toBeNull();
    const tabbar = container.querySelector('.tabbar') as HTMLElement;
    expect(tabbar.className).toContain('tabbar--coach');
    const buttons = within(tabbar).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      c.navAgenda,
      c.navClients,
      c.navSchedule,
      c.navChat,
      c.navMore,
    ]);
    expect(buttons[0].className).toContain('active');
  });

  it('767 is still a phone layout (the swap is 768)', () => {
    setViewport(767);
    const { container } = render(<Harness />);
    expect(container.querySelector('aside.rail')).toBeNull();
    expect(container.querySelector('.tabbar')).not.toBeNull();
  });

  it('chat tab carries the same total as the rail, spoken in its name', () => {
    setViewport(390);
    unreadMock.value = 4;
    const { container } = render(<Harness />);
    expect(container.querySelector('.tabbar .uibadge')?.textContent).toBe('4');
    expect(screen.getByRole('button', { name: `${c.navChat}, ${c.unread(4)}` })).toBeTruthy();
  });

  it('More opens a sheet with Week, Decisions, Programs, Live, Signals, mode switch and profile', () => {
    setViewport(390);
    const onProfile = vi.fn();
    render(<Harness onProfile={onProfile} />);
    fireEvent.click(screen.getByRole('button', { name: c.navMore }));
    for (const label of [c.navWeek, c.navDecisions, c.navPrograms, c.navLive, c.navSignals]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: c.modeCoach }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: c.modeMyWorkouts })).toBeTruthy();
    expect(screen.getByText(c.modeNote)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: c.moreProfile }));
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it('a More entry navigates, closes the sheet and lights More', async () => {
    setViewport(390);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: c.navMore }));
    fireEvent.click(screen.getByRole('button', { name: c.navDecisions }));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(c.navDecisions);
    expect(screen.queryByText(c.modeNote)).toBeNull();
    const more = within(container.querySelector('.tabbar') as HTMLElement).getByRole('button', {
      name: c.navMore,
    });
    expect(more.className).toContain('active');
  });
});

describe('mode switch "Coach | My workouts"', () => {
  it('desktop: the avatar opens the account popover (identity, note and the two modes)', () => {
    setViewport(1440);
    render(<Harness />);
    expect(screen.queryByText(c.modeNote)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    const dialog = screen.getByRole('dialog', { name: c.railProfile });
    expect(within(dialog).getByText('Iryna Koval')).toBeTruthy();
    expect(within(dialog).getByText(c.roleTrainer)).toBeTruthy();
    expect(within(dialog).getByText(c.modeNote)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: c.modeCoach })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: c.modeMyWorkouts })).toBeTruthy();
  });

  it('"My workouts" leaves the dashboard; choosing "Coach" does nothing (already there)', () => {
    setViewport(1440);
    const onExit = vi.fn();
    render(<Harness onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    fireEvent.click(screen.getByRole('button', { name: c.modeCoach }));
    expect(onExit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: c.modeMyWorkouts }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: c.railProfile })).toBeNull();
  });

  it('an admin sees the Admin label', () => {
    setViewport(1440);
    render(
      <CoachShell
        role="admin"
        name="Root"
        route={{ screen: 'agenda' }}
        onNavigate={() => undefined}
        onExitToWorkouts={() => undefined}
        onOpenShell={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    expect(screen.getByText(c.roleAdmin)).toBeTruthy();
  });

  it('round trip: leave from a screen, come back to the same screen', async () => {
    setViewport(1440);
    window.location.hash = '#/c/decisions';
    const exit = vi.fn();
    const { unmount } = render(
      <CoachApp
        role="trainer"
        name="Iryna"
        onExitToWorkouts={exit}
        onOpenShell={() => undefined}
      />,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(c.navDecisions);
    fireEvent.click(screen.getByRole('button', { name: c.railProfile }));
    fireEvent.click(screen.getByRole('button', { name: c.modeMyWorkouts }));
    expect(exit).toHaveBeenCalledTimes(1);
    unmount();
    // Back from the athlete app: the entry hash is the last Coach screen.
    expect(coachEntryHash()).toBe('#/c/decisions');
    window.location.hash = coachEntryHash();
    render(
      <CoachApp
        role="trainer"
        name="Iryna"
        onExitToWorkouts={exit}
        onOpenShell={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(c.navDecisions);
  });
});

describe('shell basics', () => {
  it('skip link moves focus to the main region', () => {
    setViewport(1440);
    render(<Harness />);
    const skip = screen.getByRole('link', { name: c.skipToContent });
    fireEvent.click(skip);
    expect(document.activeElement).toBe(document.getElementById('co-main'));
    expect(document.getElementById('co-main')?.tagName).toBe('MAIN');
  });

  it('wraps in .app-coach (compact density scope) and renders the real Agenda screen (fixtures, lazy)', async () => {
    setViewport(1440);
    const { container } = render(<Harness />);
    expect(container.querySelector('.app-coach')).not.toBeNull();
    // Lazy screen + fixtures port: a skeleton first, then the queue.
    expect((await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).textContent).toBe(
      todayEn.queueTitle,
    );
    expect(await screen.findByText(/need a decision/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(c.emptyTitle)).toBeNull();
  });

  it('every route has a real screen now (the M0 placeholder is gone): Live opens its page', async () => {
    setViewport(1440);
    const { container } = render(<Harness initial={{ screen: 'live' }} />);
    expect(container.querySelector('.app-coach')).not.toBeNull();
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Training now');
    expect(screen.queryByText(c.emptyTitle)).toBeNull();
  });

  it('CoachApp follows the hash: #/c/clients opens Clients', async () => {
    setViewport(1440);
    window.location.hash = '#/c/clients';
    render(
      <CoachApp
        role="admin"
        name="Root"
        onExitToWorkouts={() => undefined}
        onOpenShell={() => undefined}
      />,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(c.navClients);
    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: c.navWeek }),
    );
    expect(currentHash()).toBe('#/c/week');
  });
});
