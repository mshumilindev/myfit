/**
 * The manager's "world": only the people the schedule needs (names, ids, the trainer of each). No signals, no
 * decisions, no consent: a manager sees none of that, so every consent level is `off` and every list is empty. The same
 * `CoachWorldPort` seam the trainer's dashboard reads, so the schedule's names and counts come from one place.
 */
import { emptyBook } from '../../domain/decisions';
import type { Category, Consent, CoachClient } from '../../domain/types';
import { CATEGORIES } from '../../domain/types';
import type { CoachWorldPort, WorldData } from '../port';
import type { ManagerBook } from './managerRings';

const offConsent = (): Consent =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 'off'])) as Record<Category, 'off'>;

export function createManagerWorldPort(d: {
  manager: { id: string; name: string };
  book: ManagerBook;
  now?: () => number;
}): CoachWorldPort {
  const now = d.now ?? Date.now;
  const build = (): WorldData => ({
    asOf: now(),
    trainer: d.manager,
    clients: d.book.clients().map((c): CoachClient => ({
      id: c.clientId,
      name: c.name,
      goal: '',
      program: '',
      programWeek: 0,
      gym: '',
      mode: 'app',
      consent: offConsent(),
      streakWeeks: 0,
      planned: 0,
      done: 0,
      lastSessionAt: null,
      trainerDays: [],
    })),
    inputs: [],
    slots: [],
    book: emptyBook(),
  });
  let last: { data: WorldData; fetchedAt: number } | null = null;
  const snap = () => (last = { data: build(), fetchedAt: now() });
  return {
    peek: () => (d.book.clients().length ? snap() : last),
    async load() {
      await d.book.ready();
      return snap().data;
    },
    async save() {
      /* a manager never records a decision */
    },
    now,
    subscribe: (on) => d.book.watch(on),
  };
}
