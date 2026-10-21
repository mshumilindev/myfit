import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import { coachEn } from '../i18n/coach.en';
import type { StoreState } from '../store';
import { currentHash } from '../route';

const access = vi.hoisted(() => ({ value: false }));
vi.mock('../coach/useCoachAccess', () => ({ useCoachAccess: () => access.value }));

afterEach(cleanup);
beforeEach(() => {
  access.value = false;
  window.history.replaceState(null, '', '/');
});

const noop = () => undefined;
function open(current: 'gym' | 'coach', onClose: () => void = noop) {
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
      onNutrition={noop}
      nutritionEnabled
      onLearn={noop}
      onClose={onClose}
    />,
  );
}
const coachTile = () => screen.queryByText(coachEn.modeCoach)?.closest('button') ?? null;

describe('ShellLauncher Coach tile', () => {
  it('inside Coach: the tile is the CURRENT one, disabled, with its own tourmaline tone', () => {
    access.value = true;
    open('coach');
    const tile = coachTile() as HTMLButtonElement;
    expect(tile).not.toBeNull();
    expect(tile.className).toContain('current');
    expect(tile.disabled).toBe(true);
    expect(tile.querySelector('.uitile')?.className).toContain('uit--coach');
    expect(tile.textContent).toContain('Current');
    expect(tile.textContent).toContain(coachEn.shellDesc);
    // No other app is current.
    expect(document.querySelectorAll('.shell-tile.current')).toHaveLength(1);
  });

  it('is still listed inside Coach if access is lost under it (never an empty current slot)', () => {
    access.value = false;
    open('coach');
    expect(coachTile()).not.toBeNull();
  });

  it('role gate unchanged: outside Coach the tile is hidden without access', () => {
    access.value = false;
    open('gym');
    expect(coachTile()).toBeNull();
  });

  it('outside Coach with access: an enabled tile that opens the dashboard and closes the sheet', () => {
    access.value = true;
    const onClose = vi.fn();
    open('gym', onClose);
    const tile = coachTile() as HTMLButtonElement;
    expect(tile.disabled).toBe(false);
    expect(tile.className).not.toContain('current');
    fireEvent.click(tile);
    expect(currentHash()).toMatch(/^#\/c\//);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
