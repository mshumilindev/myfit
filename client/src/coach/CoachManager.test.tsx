import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { coachEn } from '../i18n/coach.en';
import { CoachShell } from './CoachApp';
import { MANAGER_HOME_ROUTE, managerMayOpen } from './routes';
import { canUseCoach, isManagerRole } from './access';
import { setViewport } from './testViewport';

vi.mock('./unread', async (orig) => ({
  ...(await orig<typeof import('./unread')>()),
  useCoachUnread: () => 0,
}));
vi.mock('../components/Avatar', async (orig) => ({
  ...(await orig<typeof import('../components/Avatar')>()),
  Avatar: () => <span />,
  UserAvatar: () => <span />,
}));

const c = coachEn;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function Shell({ role = 'manager' as 'manager' | 'trainer' }) {
  return (
    <CoachShell
      role={role}
      name="Max Manager"
      route={MANAGER_HOME_ROUTE}
      onNavigate={() => undefined}
      onExitToWorkouts={() => undefined}
      onOpenShell={() => undefined}
    />
  );
}

describe('manager shell (SPO-196)', () => {
  it('a manager may open the dashboard; the routes outside schedule, clients, team are closed', () => {
    expect(isManagerRole('manager')).toBe(true);
    expect(canUseCoach('manager')).toBe(true);
    expect(managerMayOpen({ screen: 'schedule' })).toBe(true);
    expect(managerMayOpen({ screen: 'clients' })).toBe(true);
    expect(managerMayOpen({ screen: 'team' })).toBe(true);
    expect(managerMayOpen({ screen: 'client', cid: 'c1' })).toBe(true);
    expect(managerMayOpen({ screen: 'client', cid: 'c1', tab: 'live' })).toBe(false);
    for (const screen of [
      'agenda',
      'chat',
      'programs',
      'decisions',
      'week',
      'signals',
      'live',
    ] as const)
      expect(managerMayOpen({ screen })).toBe(false);
    expect(managerMayOpen({ screen: 'chat', with: 'c1' })).toBe(false);
  });

  it('desktop rail: Schedule, Clients, Team only; no chat', () => {
    setViewport(1440);
    const { container } = render(<Shell />);
    const rail = container.querySelector('aside.rail') as HTMLElement;
    const names = within(rail)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(expect.arrayContaining([c.navSchedule, c.navClients, c.navTeam]));
    for (const gone of [c.navChat, c.navAgenda, c.navPrograms, c.navDecisions])
      expect(names).not.toContain(gone);
  });

  it('phone: three tabs, no More; the header names the app "Manager" instead of "Coach"', () => {
    setViewport(390);
    const { container, queryByText } = render(<Shell />);
    const tabbar = container.querySelector('.tabbar') as HTMLElement;
    expect(
      within(tabbar)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([c.navClients, c.navSchedule, c.navTeam]);
    expect(queryByText(c.navMore)).toBeNull();
    expect(container.textContent).toContain(c.modeManager);
  });

  it('a trainer still sees "Coach"', () => {
    setViewport(390);
    const { container } = render(<Shell role="trainer" />);
    expect(container.textContent).toContain(c.modeCoach);
    expect(container.textContent).not.toContain(c.modeManager);
  });
});
