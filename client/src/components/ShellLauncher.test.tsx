import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import type { StoreState } from '../store';

afterEach(cleanup);
// SPO-141: the Users tile is admin-only; these contracts are about every tile, so they run as an admin.
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => 'admin',
}));

type Current = 'gym' | 'apex' | 'roster' | 'nutrition' | 'learn';
const CURRENTS: Current[] = ['gym', 'apex', 'roster', 'nutrition', 'learn'];
/** Fixed identity tone of each app's row, whatever app is active (an admin sees Users and Coach). */
const ROW_TONES = ['gym', 'apex', 'kcal', 'people', 'coach', 'learn'];

function tileClasses(current: Current): string[] {
  const noop = () => undefined;
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
      onClose={noop}
    />,
  );
  const tiles = Array.from(document.body.querySelectorAll('.shell-tile .uitile'));
  cleanup();
  return tiles.map((el) => Array.from(el.classList).find((c) => c.startsWith('uit--')) ?? '');
}

describe('ShellLauncher app rows', () => {
  it('gives each app row its own fixed tone', () => {
    expect(tileClasses('gym')).toEqual(ROW_TONES.map((t) => `uit--${t}`));
  });
  it.each(CURRENTS)('keeps every row tone unchanged when %s is the active app', (current) => {
    expect(tileClasses(current)).toEqual(tileClasses('gym'));
  });
});
