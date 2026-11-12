import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { buildFixtureWorld, createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureAvailability, type AvailabilityPort } from '../data/availability';
import { dayKeyOf, type ClientAvailability } from '../domain/availability';
import { currentHash } from '../../route';
import { setViewport } from '../testViewport';
import { Client360Screen } from './Client360Screen';
import { idOf } from './storyPorts';

const W = buildFixtureWorld();
const OLEH = idOf(W, 'Oleh Bondar');

beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/clients/x');
});
afterEach(() => {
  cleanup();
  configureAvailability(null);
});

const AV: ClientAvailability = {
  weekly: { 0: [[360, 480]] },
  unavailable: [{ fromDay: dayKeyOf(Date.now()) + 1, toDay: dayKeyOf(Date.now()) + 2 }],
};
const mount = (port: AvailabilityPort | null) => {
  configureAvailability(port);
  return render(
    <Client360Screen
      cid={OLEH}
      onNavigate={vi.fn()}
      port={createFixturesPort()}
      unreadByClient={{}}
    />,
  );
};
const row = (label: string) => screen.getByText(label).closest('.uiinfo-row') as HTMLElement;

describe('Client 360: availability (SPO-552 I10)', () => {
  it('shared: the sharing list says Free or busy, the free-hours card is there, the read asked for this client', async () => {
    const read = vi.fn(async () => ({ state: 'shared' as const, availability: AV }));
    mount({ read });
    expect(await screen.findByRole('heading', { name: r.c3AvTitle('Oleh') })).toBeTruthy();
    expect(read).toHaveBeenCalledWith(OLEH);
    const it = row(r.c3AvLabel);
    expect(within(it).getByText(r.c3AvLevel)).toBeTruthy();
    expect(within(it).getByText(r.c3AvWhat)).toBeTruthy();
  });

  it('not shared (or nothing published): "Not shared", no card, nothing to open', async () => {
    mount({ read: async () => ({ state: 'not-shared' }) });
    await waitFor(() => expect(screen.getByText(r.c3AvLabel)).toBeTruthy());
    const it = row(r.c3AvLabel);
    expect(within(it).getByText(r.c3Level.off)).toBeTruthy();
    expect(within(it).getByText(r.c3NotShared('Oleh'))).toBeTruthy();
    expect(screen.queryByRole('heading', { name: r.c3AvTitle('Oleh') })).toBeNull();
    expect(screen.queryByRole('button', { name: r.c3AvShow })).toBeNull();
  });

  it('no adapter installed (offline build, tests): behaves as not shared', async () => {
    mount(null);
    await waitFor(() => expect(screen.getByText(r.c3AvLabel)).toBeTruthy());
    expect(within(row(r.c3AvLabel)).getByText(r.c3Level.off)).toBeTruthy();
  });

  it('a failed read shows the card with Try again, and the list still says Not shared', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce({ state: 'shared', availability: AV });
    mount({ read });
    expect(await screen.findByText(r.c3AvFailed)).toBeTruthy();
    expect(within(row(r.c3AvLabel)).getByText(r.c3Level.off)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: r.c3AvRetry }));
    expect(await screen.findByRole('button', { name: r.c3AvShow })).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('Show on Schedule filters the Schedule to this client with free hours on; Propose a session opens the one-off form for them', async () => {
    mount({ read: async () => ({ state: 'shared', availability: AV }) });
    fireEvent.click(await screen.findByRole('button', { name: r.c3AvShow }));
    expect(currentHash()).toBe(`#/c/schedule?who=${OLEH}&free=1`);
    window.history.replaceState(null, '', '#/c/clients/x');
    fireEvent.click(screen.getByRole('button', { name: r.c3AvPropose }));
    const q = new URLSearchParams(currentHash().split('?')[1]);
    expect(q.get('form')).toBe('oneoff');
    expect(q.get('client')).toBe(OLEH);
    expect(q.get('who')).toBe(OLEH);
    expect(q.get('free')).toBe('1');
  });

  it('Request access offers Availability while it is not shared, and not once it is', async () => {
    mount({ read: async () => ({ state: 'not-shared' }) });
    await screen.findByText(r.c3AvLabel);
    fireEvent.click(screen.getAllByRole('button', { name: /request access/i })[0]);
    expect(await screen.findByRole('checkbox', { name: /Availability/ })).toBeTruthy();
    cleanup();
    mount({ read: async () => ({ state: 'shared', availability: AV }) });
    await screen.findByRole('button', { name: r.c3AvShow });
    fireEvent.click(screen.getAllByRole('button', { name: /request access/i })[0]);
    await screen.findAllByRole('checkbox');
    expect(screen.queryByRole('checkbox', { name: /Availability/ })).toBeNull();
  });
});
