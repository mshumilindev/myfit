/** Synthetic export sources for tests (no real person). */
import type { ChatMsg } from '../../atlas/chatLog';
import type { ConsentRecord } from '../consents';
import type { ExportSources, StoredHealth, StoreSlice } from './exportModel';

const T0 = Date.UTC(2026, 9, 1, 8, 0, 0);

export const consent = (id: string, kind: ConsentRecord['kind'], at: number): ConsentRecord => ({
  id,
  kind,
  action: 'grant',
  version: '2026-10-21',
  at,
});

export function storeSlice(over: Partial<StoreSlice> = {}): StoreSlice {
  const slice = {
    workouts: [
      {
        id: 'w1',
        startedAt: T0,
        finishedAt: T0 + 3_600_000,
        autoFinished: false,
        dayName: '=Push, "heavy"',
        exercises: [
          {
            id: 'e1',
            name: 'Bench press',
            position: 0,
            sets: [
              { id: 's1', reps: 8, weight: 60, isWarmup: true },
              { id: 's2', reps: 5, weight: 80, isWarmup: false, rpe: 8 },
            ],
          },
        ],
      },
    ],
    gyms: [{ id: 'g1', name: 'Test Gym', lat: 50.1, lng: 19.9, radiusM: 120 }],
    restPeriods: [],
    injuries: [],
    conditions: [],
    conditionsShare: 'effects',
    nicotine: { products: [], settings: {}, updatedAt: 0 },
    cycle: { updatedAt: 0 },
    alcohol: { updatedAt: 0 },
    supplements: { updatedAt: 0 },
    activities: [
      {
        id: 'a1',
        type: 'run',
        category: 'conditioning',
        startedAt: T0,
        finishedAt: T0 + 1_800_000,
        durationMin: 30,
        distanceKm: 5,
      },
    ],
    weightUnit: 'kg',
    mastery: { sinceYear: 2020, pattern: null, seenRating: null },
    bodyMetrics: { weights: [{ id: 'b1', at: T0, weight: 80.5 }], heightCm: 180 },
    sleeps: [{ id: 'n1', date: '2026-10-02', bedtime: T0 - 28_800_000, wake: T0, source: 'live' }],
    sleepSchedule: { sameEveryNight: true, every: null, byDay: {} },
    sleepSettings: { autoDim: false, autoLog: false, goalMin: 480, lastDimDay: null },
    goals: {},
    coach: {
      enabled: true,
      temper: 'green',
      role: 'main',
      startedAt: T0,
      readAt: 0,
      yoMama: false,
      swearing: false,
    },
    home: { sets: [], moves: [] },
    ...over,
  };
  return slice as unknown as StoreSlice;
}

export const chatMsg = (id: string, from: 'me' | 'atlas', text: string): ChatMsg => ({
  id,
  at: T0,
  from,
  text,
});

export function storedHealth(over: Partial<StoredHealth> = {}): StoredHealth {
  const { injuries, conditions, conditionsShare, cycle, nicotine, alcohol, supplements } =
    storeSlice();
  return { injuries, conditions, conditionsShare, cycle, nicotine, alcohol, supplements, ...over };
}

export function sources(over: Partial<ExportSources> = {}): ExportSources {
  return {
    account: { uid: 'u-test', username: 'tester', role: 'member' },
    consents: [consent('c2', 'atlas-ai', T0 + 10), consent('c1', 'terms', T0)],
    store: storeSlice(),
    storeSynced: true,
    health: storedHealth(),
    hiddenHealth: [],
    nutrition: {
      entries: [
        {
          id: 'm1',
          type: 'meal',
          name: 'Oats',
          items: [],
          macros: { kcal: 350, protein: 12, fat: 6, carbs: 60 },
          loggedAt: '2026-10-01T07:30:00',
          day: '2026-10-01',
        },
      ],
      foods: [],
      goal: null,
      profile: null,
      hidden: false,
    },
    chat: [chatMsg('c1', 'me', 'hi'), chatMsg('c2', 'atlas', 'hello')],
    hasTrainer: true,
    ...over,
  };
}
