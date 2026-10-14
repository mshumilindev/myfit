/**
 * In-memory live adapter (fixtures): the lab's two live clients, one who lost connection and one who just
 * finished. The heartbeat of the live ones is refreshed every 20 s so the screen stays live while you look at it.
 */
import { FIXTURE_NOW } from '../../../data/__fixtures__/fixtures';
import type { CoachLiveSession, LivePort } from '../port';

const MIN = 60_000;

export interface FixturesLiveOptions {
  /** the app clock; default: `at` running on from page load */
  now?: () => number;
  /** Sessions to serve instead of the default four (stories, tests). Times are relative to the port clock. */
  sessions?: (now: number) => CoachLiveSession[];
  /** Do not refresh heartbeats (stories that show Offline). */
  freeze?: boolean;
  /** Make the first subscription fail. */
  fail?: boolean;
  /** Start the clock here (default: Wed 7 Oct 2026 09:05). */
  at?: number;
}

export function defaultLiveSessions(now: number): CoachLiveSession[] {
  const base = (
    clientId: string,
    athleteName: string,
    over: Partial<CoachLiveSession>,
  ): CoachLiveSession => ({
    id: `u-${clientId}`,
    clientId,
    athleteName,
    trainerId: 'trainer',
    startedAt: now - 20 * MIN,
    updatedAt: now - 12_000,
    ...over,
  });
  return [
    base('c5', 'Denys Koval', {
      sessionName: 'Lower A',
      startedAt: now - 38 * MIN,
      gymName: 'Iron Yard',
      exerciseCount: 6,
      lastName: 'Upper B',
      lastSets: 18,
      lastTonnageKg: 7400,
      lastAt: now - 3 * 86_400_000,
    }),
    base('c11', 'Yulia Marchenko', {
      sessionName: 'Upper A',
      startedAt: now - 14 * MIN,
      gymName: 'Iron Yard',
      exerciseCount: 5,
      lastName: 'Lower B',
      lastSets: 15,
      lastTonnageKg: 5200,
      lastAt: now - 2 * 86_400_000,
    }),
    base('c2', 'Maria Tkach', {
      sessionName: 'Glutes',
      startedAt: now - 52 * MIN,
      updatedAt: now - 3 * MIN,
      gymName: 'Pulse Fitness',
      exerciseCount: 7,
      lastName: 'Glutes',
      lastSets: 16,
      lastTonnageKg: 6100,
      lastAt: now - 5 * 86_400_000,
    }),
    base('c7', 'Andriy Melnyk', {
      sessionName: 'Push',
      startedAt: now - 71 * MIN,
      updatedAt: now - 4 * MIN,
      finishedAt: now - 3 * MIN,
      gymName: 'Iron Yard',
      exerciseCount: 6,
      finalSets: 18,
      finalTonnageKg: 7400,
      lastName: 'Pull',
      lastSets: 17,
      lastTonnageKg: 6800,
      lastAt: now - 4 * 86_400_000,
    }),
  ];
}

export function createFixturesLivePort(opts: FixturesLiveOptions = {}): LivePort {
  const t0 = Date.now();
  const origin = opts.at ?? FIXTURE_NOW;
  const now = opts.now ?? (() => origin + (Date.now() - t0));
  const make = opts.sessions ?? defaultLiveSessions;
  const frozenAt = origin;
  return {
    now,
    subscribe(_uid, onSessions, onError) {
      if (opts.fail) {
        const t = setTimeout(() => onError(new Error('unavailable')), 0);
        return () => clearTimeout(t);
      }
      const emit = () => {
        const n = opts.freeze ? frozenAt : now();
        onSessions(make(n));
      };
      emit();
      const iv = opts.freeze ? undefined : setInterval(emit, 20_000);
      return () => {
        if (iv) clearInterval(iv);
      };
    },
  };
}
