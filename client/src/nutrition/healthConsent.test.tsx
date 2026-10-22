/**
 * SPO-290: the food log is a health feature. Off (no consent): nothing is written, what is stored is not shown, the
 * rest of the app is untouched, and the screen says "Nutrition is off". N9: the "not medical advice" notice on top.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const never = <T,>() => new Promise<T>(() => undefined);
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: unknown }[],
  deletes: [] as string[],
  snaps: new Map<string, (s: unknown) => void>(),
}));

vi.mock('../firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: (_d: unknown, ...p: string[]) => ({ path: p.join('/') }),
  onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
    fs.snaps.set(r.path, cb);
    return () => undefined;
  },
  setDoc: (r: { path: string }, data: unknown) => {
    fs.writes.push({ path: r.path, data });
    return Promise.resolve();
  },
  deleteDoc: (r: { path: string }) => {
    fs.deletes.push(r.path);
    return Promise.resolve();
  },
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken: () => never(),
  onAuthStateChanged: () => () => undefined,
  onIdTokenChanged: () => () => undefined,
  signOut: async () => undefined,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => () => never() }));

import { resetHealthGateForTests } from '../data/healthConsentGate';
import { HEALTH_FEATURES } from '../legal/consents';
import { healthConsentTexts } from '../i18n/healthConsent';

const en = healthConsentTexts('en');
const LOG = 'users/u1/meta/nutritionLog';
/** Today as the app keys a day (local `YYYY-MM-DD`): the Today screen shows only today's entries. */
const TODAY = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const entry = {
  id: 'e1',
  type: 'meal',
  name: 'Oatmeal',
  items: [],
  macros: { kcal: 300, protein: 10, fat: 5, carbs: 50 },
  loggedAt: '2026-10-21T08:00:00.000Z',
  day: TODAY,
};
const snap = (path: string, data: unknown) =>
  fs.snaps.get(path)?.({ exists: () => true, data: () => data });

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem('spotter.uid', 'u1');
  localStorage.setItem('spotter.username', 'Tester');
  window.location.hash = '#/nutrition';
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.snaps.clear();
  resetHealthGateForTests(false);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});
afterEach(() => {
  cleanup();
  resetHealthGateForTests(true);
});

// vi.resetModules() gives the app a fresh copy of the gate, so the tests drive that copy.
async function mountRoot() {
  const gate = await import('../data/healthConsentGate');
  const { NutritionRoot } = await import('./App');
  const view = render(
    <NutritionRoot
      now={Date.now()}
      onOpenShell={vi.fn()}
      onOpenProfile={vi.fn()}
      notifs={[]}
      notifState={{}}
      notifUnread={0}
      onNotifSeen={vi.fn()}
      onNotifMarkAll={vi.fn()}
    />,
  );
  return { gate, view };
}
const allow = (gate: typeof import('../data/healthConsentGate'), on: boolean) =>
  gate.setHealthConsentState({
    on: Object.fromEntries(
      HEALTH_FEATURES.map((f) => [f, f === 'nutrition' ? on : false]),
    ) as never,
    answered: Object.fromEntries(HEALTH_FEATURES.map((f) => [f, false])) as never,
    ready: true,
  });

describe('Nutrition without its consent', () => {
  it('shows "Nutrition is off" with Turn on, hides the add button and the stored food log, keeps the notice', async () => {
    const { gate } = await mountRoot();
    allow(gate, false);
    snap('users/u1/meta/nutritionLog', { entries: [entry] });
    expect(await screen.findByText('Nutrition is off')).toBeTruthy();
    expect(screen.getByText(en.disclaimer)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull();
    expect(screen.queryByText('Oatmeal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(gate.healthPromptFeature()).toBe('nutrition');
  });

  it('no write reaches Firestore, whatever calls the store', async () => {
    await mountRoot();
    const { store } = await import('./store');
    const gate = await import('../data/healthConsentGate');
    allow(gate, false);
    store.addEntry({ type: 'meal', name: 'Oatmeal', items: [], day: TODAY });
    store.addCustomFood({
      name: 'x',
      kcal: 1,
      protein: 0,
      fat: 0,
      carbs: 0,
      basis: '100g',
    } as never);
    store.setGoal({ kcal: 2000 } as never);
    store.setProfile({ heightCm: 180 } as never);
    expect(fs.writes).toEqual([]);
    expect(store.get().entries).toEqual([]);
  });

  it('with the consent the log shows and writes work again; withdrawing hides it again but keeps it stored', async () => {
    const { gate } = await mountRoot();
    allow(gate, true);
    snap('users/u1/meta/nutritionLog', { entries: [entry] });
    expect(await screen.findByText('Oatmeal')).toBeTruthy();
    const { store, hasNutritionData } = await import('./store');
    store.addEntry({ type: 'meal', name: 'Toast', items: [], day: TODAY });
    await waitFor(() => expect(fs.writes.some((w) => w.path === LOG)).toBe(true));
    allow(gate, false);
    await waitFor(() => expect(screen.queryByText('Oatmeal')).toBeNull());
    expect(hasNutritionData()).toBe(true);
  });

  it('deleting removes the four nutrition documents, and works while the feature is off', async () => {
    await mountRoot();
    const { deleteNutritionData } = await import('./store');
    deleteNutritionData();
    expect(fs.deletes.sort()).toEqual([
      'users/u1/meta/nutritionFoods',
      'users/u1/meta/nutritionGoal',
      'users/u1/meta/nutritionLog',
      'users/u1/meta/nutritionProfile',
    ]);
  });
});

describe('Nutrition: other writes, first snapshots and delete (SPO-290 review S4)', () => {
  const DOCS = ['nutritionLog', 'nutritionFoods', 'nutritionGoal', 'nutritionProfile'];
  const path = (n: string) => `users/u1/meta/${n}`;
  const empty = (n: string) => fs.snaps.get(path(n))?.({ exists: () => false, data: () => ({}) });

  it('removing, restoring and editing an entry or a custom food are writes too: refused while off', async () => {
    const gate = await import('../data/healthConsentGate');
    const { store } = await import('./store');
    allow(gate, true);
    snap(LOG, { entries: [entry] });
    snap('users/u1/meta/nutritionFoods', {
      foods: [{ id: 'f1', name: 'x', custom: true }],
    });
    fs.writes.length = 0;
    allow(gate, false);
    store.deleteEntry('e1');
    store.restoreEntry(entry as never);
    store.updateEntry(entry as never);
    store.deleteCustomFood('f1');
    expect(fs.writes).toEqual([]);
    allow(gate, true);
    expect(store.get().entries.map((e) => e.id)).toEqual(['e1']); // nothing was removed behind the screen
  });

  it('hasHealthData waits for the four first snapshots; an empty state at start is not "nothing stored"', async () => {
    const { hasHealthData } = await import('../legal/healthData');
    let answer: boolean | null = null;
    const pending = hasHealthData('nutrition').then((v) => (answer = v));
    await new Promise((r) => setTimeout(r, 30));
    expect(answer).toBeNull(); // still waiting: no snapshot yet
    snap(LOG, { entries: [entry] });
    for (const n of DOCS.slice(1)) empty(n);
    await pending;
    expect(answer).toBe(true);
  });

  it('when every document reports empty, the answer is false', async () => {
    await import('./store'); // opens the four streams
    const { hasHealthData } = await import('../legal/healthData');
    const pending = hasHealthData('nutrition');
    for (const n of DOCS) empty(n);
    expect(await pending).toBe(false);
  });

  it('if the snapshots never come (offline, nothing cached) the delete is still offered', async () => {
    const { nutritionLoaded } = await import('./store');
    expect(await nutritionLoaded(20)).toBe(false);
    const { hasHealthData } = await import('../legal/healthData');
    vi.useFakeTimers();
    const p = hasHealthData('nutrition');
    await vi.advanceTimersByTimeAsync(4100);
    expect(await p).toBe(true);
    vi.useRealTimers();
  });

  it('deleting before the first snapshot: the data that then arrives is deleted again, not shown', async () => {
    const gate = await import('../data/healthConsentGate');
    const { deleteNutritionData, store } = await import('./store');
    allow(gate, true);
    deleteNutritionData();
    fs.deletes.length = 0;
    snap(LOG, { entries: [entry] });
    expect(store.get().entries).toEqual([]);
    expect(fs.deletes).toContain(LOG);
    // the empty snapshot that follows ends the guard: a later write of the person's own works
    empty('nutritionLog');
    store.addEntry({ type: 'meal', name: 'Toast', items: [], day: TODAY });
    await waitFor(() => expect(fs.writes.some((w) => w.path === LOG)).toBe(true));
    snap(LOG, { entries: [entry] });
    expect(store.get().entries.length).toBeGreaterThan(0);
  });
});
