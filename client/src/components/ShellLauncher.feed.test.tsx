/** SPO-234/235: apps without a bell (People, Coach) flag the shared feed's unread on the Gym tile. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import { LOCALES } from '../i18n';
import type { StoreState } from '../store';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => 'member',
}));
afterEach(cleanup);

const noop = () => undefined;
function open(current: 'gym' | 'roster' | 'me' | 'coach', notifUnread: number) {
  render(
    <ShellLauncher
      store={{ workouts: [], queue: [] } as unknown as StoreState}
      now={Date.now()}
      current={current}
      peopleLabel="Users"
      peopleDesc="Members & trainers."
      activeChallenges={0}
      notifUnread={notifUnread}
      onGym={noop}
      onApex={noop}
      onRoster={noop}
      onNutrition={noop}
      nutritionEnabled
      onLearn={noop}
      onClose={noop}
    />,
  );
}
const gymBadge = () =>
  screen.getByText(LOCALES.en.shellGym).closest('button')?.querySelector('.shell-badge') ?? null;

describe('Gym tile unread badge', () => {
  it.each(['roster', 'me', 'coach'] as const)(
    '%s: the feed unread shows on the Gym tile',
    (cur) => {
      open(cur, 4);
      expect(gymBadge()?.textContent).toBe('4');
    },
  );
  it('9+ above nine', () => {
    open('coach', 12);
    expect(gymBadge()?.textContent).toBe('9+');
  });
  it('nothing unread, or inside the client apps (they have the bell): no badge', () => {
    open('coach', 0);
    expect(gymBadge()).toBeNull();
    cleanup();
    open('gym', 4);
    expect(gymBadge()).toBeNull();
  });
});
