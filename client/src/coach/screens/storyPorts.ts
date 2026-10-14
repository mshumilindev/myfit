/**
 * World ports for stories and tests: the fixtures world with an edit applied. Data stays the lab's; only the
 * scenario changes (empty roster, locked client, pending invites, ...). Never used by the app.
 */
import { createFixturesPort, type FixturesPortOptions } from '../data/__fixtures__/fixtures';
import type { CoachWorldPort, WorldData } from '../data/port';
import { ALL_OFF } from '../domain/consent';
import type { CoachClient } from '../domain/types';
import { DAY } from '../domain/time';

export function worldPort(
  edit: (w: WorldData) => WorldData = (w) => w,
  o: FixturesPortOptions = {},
): CoachWorldPort {
  const base = createFixturesPort(o);
  return {
    ...base,
    peek: () => {
      const p = base.peek();
      return p ? { ...p, data: edit(p.data) } : null;
    },
    load: async (opts) => edit(await base.load(opts)),
  };
}

export const emptyRoster = (w: WorldData): WorldData => ({
  ...w,
  clients: [],
  inputs: [],
  slots: [],
});

const mapClient =
  (name: string, f: (c: CoachClient) => CoachClient) =>
  (w: WorldData): WorldData => ({
    ...w,
    clients: w.clients.map((c) => (c.name === name ? f(c) : c)),
  });

/** Viktoriia shares nothing (client360-locked). */
export const lockedClient = mapClient('Viktoriia Danylchuk', (c) => ({
  ...c,
  consent: { ...ALL_OFF },
}));

/** Viktoriia shares workout totals only (the lab's client360-locked). */
export const totalsOnlyClient = mapClient('Viktoriia Danylchuk', (c) => ({
  ...c,
  consent: { ...ALL_OFF, totals: 'full' },
}));

/** Two pending invites on top of the lab roster (rows: "Invite sent . 6 d left"). */
export const withInvites = (w: WorldData): WorldData => ({
  ...w,
  clients: [
    ...w.clients,
    {
      id: 'inv1',
      name: 'Olena Marchenko',
      goal: '',
      program: 'Invite sent',
      programWeek: 0,
      gym: '',
      mode: 'app',
      consent: { ...ALL_OFF },
      streakWeeks: 0,
      planned: 0,
      done: 0,
      lastSessionAt: null,
      trainerDays: [],
      invite: { sentAt: w.asOf - DAY, expiresAt: w.asOf + 6 * DAY },
    },
  ],
});

export const idOf = (w: WorldData, name: string): string =>
  w.clients.find((c) => c.name === name)!.id;
