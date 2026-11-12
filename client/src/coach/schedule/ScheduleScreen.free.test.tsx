import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureAvailability } from '../data/availability';
import { setCoachTimeZone } from '../format';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort } from './__fixtures__/fixtures';
import { ScheduleScreen } from './ScheduleScreen';

const EVERY_DAY = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [[420, 1260]]]));
const shared = { state: 'shared' as const, availability: { weekly: EVERY_DAY, unavailable: [] } };

beforeEach(() => {
  setViewport(1440);
  setCoachTimeZone('UTC');
});
afterEach(() => {
  cleanup();
  configureAvailability(null);
  window.history.replaceState(null, '', '/');
});

const open = (query: string, manager = false) => {
  window.history.replaceState(null, '', `/#/c/schedule${query}`);
  return render(
    <ScheduleScreen
      onNavigate={vi.fn()}
      manager={manager}
      port={createFixturesSchedulePort()}
      worldPort={createFixturesPort({ warm: true })}
    />,
  );
};

describe('Schedule: the free hours of the filtered client', () => {
  it('free=1 with a client: reads that client and shades the grid', async () => {
    const read = vi.fn(async () => shared);
    configureAvailability({ read });
    const { container } = open('?who=c1&free=1');
    await waitFor(() => expect(container.querySelectorAll('.sc-free').length).toBeGreaterThan(0));
    expect(read).toHaveBeenCalledWith('c1');
  });

  it('without free=1, or without a client, nothing is read and nothing is shaded', async () => {
    const read = vi.fn(async () => shared);
    configureAvailability({ read });
    const a = open('?who=c1');
    await waitFor(() => expect(a.container.querySelector('.sc-col')).toBeTruthy());
    expect(a.container.querySelectorAll('.sc-free')).toHaveLength(0);
    a.unmount();
    const b = open('?free=1');
    await waitFor(() => expect(b.container.querySelector('.sc-col')).toBeTruthy());
    expect(b.container.querySelectorAll('.sc-free')).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
  });

  it('not shared or a failed read: the grid is as before', async () => {
    configureAvailability({ read: async () => ({ state: 'not-shared' }) });
    const a = open('?who=c1&free=1');
    await waitFor(() => expect(a.container.querySelector('.sc-col')).toBeTruthy());
    expect(a.container.querySelectorAll('.sc-free')).toHaveLength(0);
    a.unmount();
    configureAvailability({
      read: async () => {
        throw new Error('x');
      },
    });
    const b = open('?who=c1&free=1');
    await waitFor(() => expect(b.container.querySelector('.sc-col')).toBeTruthy());
    expect(b.container.querySelectorAll('.sc-free')).toHaveLength(0);
  });

  it("a manager's schedule never reads a client's availability (only the coach of record does)", async () => {
    const read = vi.fn(async () => shared);
    configureAvailability({ read });
    const { container } = open('?who=c1&free=1', true);
    await waitFor(() => expect(container.querySelector('.sc-col, .uical')).toBeTruthy());
    expect(read).not.toHaveBeenCalled();
  });
});
