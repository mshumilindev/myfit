/**
 * Vitest setup (SPO-518): the existing suites exercise the health features themselves, so every test file starts with the
 * Health add-ons installed (as the consents are, see legal/testSetup.ts). Done once per file, before the test file loads the
 * store: setting it later would sync the list to the account and trip suites that mock the database. A test about what the
 * base app is without them clears or sets the list itself (`addonsPref.reset()` / `addonsPref.set([...])`); a suite that
 * calls `resetLocalData()` (which clears the list) sets what it needs after it.
 */

// Tracker runtimes (SPO-500 I8): the tests run with the trackers' code loaded, as it is once the add-on is installed.
// Not in a node-environment suite (no DOM/storage there: the engines reach i18n, which reads `localStorage`).
if (typeof window !== 'undefined') {
  await Promise.all([
    import('../alcoholBoot'),
    import('../nicotineBoot'),
    import('../supplementsBoot'),
    import('../cycleBoot'),
    import('../conditionsBoot'),
    import('../sleepBoot'),
  ]);
}

/** Every Health add-on: what a test world has installed unless it says otherwise. */
export const HEALTH_ADDONS = [
  'health',
  'rest',
  'unwell',
  'conditions',
  'injury-log',
  'nicotine',
  'alcohol',
  'supplements',
  'cycle',
];

// Seeded in storage, not through `addonsPref`: importing the add-on code here would load api/firebase before a test
// file's own mocks apply. The list is read from storage when the add-on code first loads.
/** Apex with all its modules: the Apex screens exercise every tab. */
export const APEX_ADDONS = ['apex', 'apex-challenges', 'apex-ranks', 'apex-awards', 'mastery'];

/** The Coach extras (owner 08.11): the coach screens exercise Live, Signals, Notes and Team. */
export const COACH_ADDONS = ['coach-live', 'coach-signals', 'coach-notes', 'coach-team'];

try {
  localStorage.setItem(
    'spotter.addons',
    JSON.stringify({
      list: [
        ...HEALTH_ADDONS,
        ...APEX_ADDONS,
        'activities',
        'home-sets',
        'goals',
        'playbook',
        'planner',
        'planner-availability',
        ...COACH_ADDONS,
      ],
      updatedAt: 1,
    }),
  );
} catch {
  /* no storage in this environment: the test world starts without add-ons */
}
