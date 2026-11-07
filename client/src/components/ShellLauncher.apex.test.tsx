import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import { addonsPref } from '../addons/enabledSet';
import type { StoreState } from '../store';

vi.mock('../coach/useCoachAccess', () => ({ useCoachAccess: () => false }));
const role = vi.hoisted(() => ({ value: 'member' as string }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => role.value,
}));
afterEach(cleanup);
beforeEach(() => {
  addonsPref.reset();
  role.value = 'member';
});

const noop = () => undefined;
function open(current: 'gym' | 'apex' = 'gym') {
  render(
    <ShellLauncher
      store={{ workouts: [], queue: [] } as unknown as StoreState}
      now={Date.now()}
      current={current}
      peopleLabel="Users"
      peopleDesc=""
      activeChallenges={0}
      notifUnread={0}
      onGym={noop}
      onApex={noop}
      onRoster={noop}
      onLearn={noop}
      onClose={noop}
    />,
  );
}
const apexTile = () => screen.queryByText(/apex/i);

describe('ShellLauncher: the Apex tile follows the Mastery add-on (SPO-518)', () => {
  it('a member without the add-on has no Apex tile', () => {
    open();
    expect(apexTile()).toBeNull();
  });
  it('a member with the add-on installed sees it', () => {
    addonsPref.set(['apex']);
    open();
    expect(apexTile()).not.toBeNull();
  });
  it('the app they are standing in is never hidden', () => {
    open('apex');
    expect(apexTile()).not.toBeNull();
  });
  it('a trainer is offered Mastery too: no Apex tile until it is installed', () => {
    role.value = 'trainer';
    open();
    expect(apexTile()).toBeNull();
    cleanup();
    addonsPref.set(['apex']);
    open();
    expect(apexTile()).not.toBeNull();
  });
});
