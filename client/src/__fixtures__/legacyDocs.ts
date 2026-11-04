import type { SealedCollection } from '../encryptedDoc';

/**
 * SPO-65: documents exactly as old app versions stored them in Firestore: plaintext, no `enc` envelope.
 * Synthetic data only. Adding a collection to OPEN_FIELDS without adding its legacy document here is a
 * compile error (`satisfies Record<SealedCollection, …>`), so a schema change cannot skip the fixture.
 * Value = [document id, the document]. Meta collections live at `meta/{name}`, so id === name.
 */
export const LEGACY_DOCS = {
  workouts: [
    'w-legacy-1',
    {
      id: 'w-legacy-1',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_003_600_000,
      updatedAt: 1_700_003_600_000,
      note: 'felt strong',
      exercises: [
        {
          exerciseId: 'barbell-back-squat',
          sets: [
            { reps: 5, weight: 100, done: true },
            { reps: 5, weight: 100, done: true },
          ],
        },
      ],
    },
  ],
  sleeps: [
    's-legacy-1',
    {
      id: 's-legacy-1',
      date: '2023-11-14',
      bedtime: 1_699_999_000_000,
      wake: 1_700_027_800_000,
      kind: 'night',
      source: 'manual',
      updatedAt: 1_700_027_800_000,
      quality: 4,
    },
  ],
  activities: [
    'a-legacy-1',
    {
      id: 'a-legacy-1',
      startedAt: 1_700_100_000_000,
      updatedAt: 1_700_103_600_000,
      type: 'run',
      durationMin: 42,
      distanceKm: 7.5,
    },
  ],
  gyms: [
    'g-legacy-1',
    { id: 'g-legacy-1', updatedAt: 1_700_000_000_000, name: 'Test Gym', city: 'Testville' },
  ],
  restPeriods: [
    'r-legacy-1',
    {
      id: 'r-legacy-1',
      updatedAt: 1_700_000_000_000,
      from: '2023-11-01',
      to: '2023-11-07',
      reason: 'trip',
    },
  ],
  injuries: [
    'i-legacy-1',
    { id: 'i-legacy-1', updatedAt: 1_700_000_000_000, area: 'knee', side: 'left', severity: 2 },
  ],
  conditions: [
    'c-legacy-1',
    { id: 'c-legacy-1', updatedAt: 1_700_000_000_000, name: 'Synthetic condition', share: 'off' },
  ],
  body: ['body', { updatedAt: 1_700_000_000_000, weightKg: 80.5, heightCm: 180 }],
  coachShare: ['coachShare', { updatedAt: 1_700_000_000_000, sections: ['workouts'] }],
  conditionPrefs: ['conditionPrefs', { updatedAt: 1_700_000_000_000, share: 'off' }],
  nicotine: [
    'nicotine',
    { updatedAt: 1_700_000_000_000, enabled: true, products: [{ name: 'Test product' }] },
  ],
  cycle: ['cycle', { updatedAt: 1_700_000_000_000, mode: 'typical', lengthDays: 28 }],
  alcohol: [
    'alcohol',
    { updatedAt: 1_700_000_000_000, enabled: true, drinks: [{ name: 'Test drink' }] },
  ],
  supplements: [
    'supplements',
    { updatedAt: 1_700_000_000_000, entries: [{ name: 'Test supplement', dose: 5 }] },
  ],
  goals: ['goals', { updatedAt: 1_700_000_000_000, physique: 'lean', focus: ['legs'] }],
  home: ['home', { updatedAt: 1_700_000_000_000, sets: [{ name: 'Home set' }] }],
  mastery: ['mastery', { updatedAt: 1_700_000_000_000, level: 'intermediate' }],
  coach: ['coach', { updatedAt: 1_700_000_000_000, temper: 5 }],
  exercisePrefs: [
    'exercisePrefs',
    {
      updatedAt: 1_700_000_000_000,
      unit: 'kg',
      perExercise: { 'barbell-back-squat': { rest: 120 } },
    },
  ],
  sleepPrefs: [
    'sleepPrefs',
    { updatedAt: 1_700_000_000_000, bedtime: '23:00', wake: '07:00', autoLog: true },
  ],
  widgetData: ['widgetData', { updatedAt: 1_700_000_000_000, oneRm: { weight: 100, reps: 5 } }],
  challenges: [
    'challenges',
    { updatedAt: 1_700_000_000_000, active: [{ id: 'ch1', title: 'Test challenge' }] },
  ],
  atlasChat: [
    'm-legacy-1',
    {
      id: 'm-legacy-1',
      at: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      role: 'user',
      text: 'hello',
    },
  ],
  atlasChatState: [
    'atlasChatState',
    { updatedAt: 1_700_000_000_000, clearedAt: 1_700_000_000_000 },
  ],
} as const satisfies Record<SealedCollection, readonly [string, Record<string, unknown>]>;
