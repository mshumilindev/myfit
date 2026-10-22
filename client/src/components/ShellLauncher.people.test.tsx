/** SPO-141: the People (Users) tile of the app switcher exists for an admin only. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import type { StoreState } from '../store';

const session = vi.hoisted(() => ({ role: 'member' as 'member' | 'trainer' | 'admin' }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => session.role,
}));

afterEach(cleanup);
beforeEach(() => {
  session.role = 'member';
  window.history.replaceState(null, '', '/');
});

const noop = () => undefined;
function open(current: 'gym' | 'roster' | 'me') {
  render(
    <ShellLauncher
      store={{ workouts: [], queue: [] } as unknown as StoreState}
      now={Date.now()}
      current={current}
      peopleLabel="Users"
      peopleDesc="Members & trainers."
      activeChallenges={0}
      notifUnread={0}
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
const usersTile = () => screen.queryByText('Users')?.closest('button') ?? null;

describe('ShellLauncher Users tile (SPO-141)', () => {
  for (const role of ['member', 'trainer'] as const) {
    it(`${role}: no Users tile, and Me is not a tile either`, () => {
      session.role = role;
      open('gym');
      expect(usersTile()).toBeNull();
      expect(screen.queryByText('Members & trainers.')).toBeNull();
    });
    it(`${role} on the Me screen: no tile is marked current`, () => {
      session.role = role;
      open('me');
      expect(usersTile()).toBeNull();
      expect(document.querySelectorAll('.shell-tile.current')).toHaveLength(0);
    });
  }

  it('admin: the Users tile is there and opens the app', () => {
    session.role = 'admin';
    open('gym');
    const tile = usersTile() as HTMLButtonElement;
    expect(tile).not.toBeNull();
    expect(tile.disabled).toBe(false);
    expect(tile.textContent).toContain('Members & trainers.');
  });

  it('admin inside Users: the tile is the current one', () => {
    session.role = 'admin';
    open('roster');
    expect((usersTile() as HTMLButtonElement).className).toContain('current');
  });

  it('admin on his own Me screen: Users is listed but NOT current', () => {
    session.role = 'admin';
    open('me');
    const tile = usersTile() as HTMLButtonElement;
    expect(tile.className).not.toContain('current');
    expect(document.querySelectorAll('.shell-tile.current')).toHaveLength(0);
  });
});
