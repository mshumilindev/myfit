import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { addonsPref } from '../addons/enabledSet';
import { coachEn } from '../i18n/coach.en';
import { CoachShell } from './CoachApp';
import { setViewport } from './testViewport';
import { configureTeam } from './team/teamConfig';
import { createFixturesTeamPort } from './team/__fixtures__/fixtures';

const role = vi.hoisted(() => ({ value: 'trainer' as string }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => role.value,
}));
vi.mock('./unread', async (orig) => ({
  ...(await orig<typeof import('./unread')>()),
  useCoachUnread: () => 0,
}));

const shell = () =>
  render(
    <CoachShell
      role="trainer"
      name="Iryna Koval"
      route={{ screen: 'agenda' }}
      onNavigate={() => undefined}
      onExitToWorkouts={() => undefined}
      onOpenShell={() => undefined}
    />,
  );
const hasNav = (label: string) =>
  screen.queryAllByRole('button', { name: label }).length +
    screen.queryAllByRole('link', { name: label }).length >
  0;

beforeEach(() => {
  configureTeam(createFixturesTeamPort());
  setViewport(1440);
  role.value = 'trainer';
  addonsPref.reset();
});
afterEach(() => {
  cleanup();
  addonsPref.reset();
});

// Owner 08.11: Live, Signals, Notes and Team are Coach add-ons; the rest of the Coach is base.
describe('the trainer shell follows the Coach add-ons', () => {
  it('Team is not in the rail until its add-on is installed', () => {
    shell();
    expect(hasNav(coachEn.navTeam)).toBe(false);
    expect(hasNav(coachEn.navClients)).toBe(true);
    cleanup();
    addonsPref.set(['coach-team']);
    shell();
    expect(hasNav(coachEn.navTeam)).toBe(true);
  });
});
