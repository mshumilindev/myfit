/** SPO-552 I10: what a trainer sees is republished when (and only when) the person's choice, hours or Health states change. */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  prefs: { shareAvailability: true, availability: { 0: [[540, 600]] } } as Record<string, unknown>,
  state: { restPeriods: [] as unknown[], injuries: [] as unknown[] },
  planner: new Set<() => void>(),
  store: new Set<() => void>(),
  republish: vi.fn(),
  injuryModule: true,
}));

vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  getStoreState: () => h.state,
  republishCoachShare: h.republish,
  subscribeStore: (f: () => void) => (h.store.add(f), () => h.store.delete(f)),
}));
vi.mock('./sync', async (orig) => ({
  ...(await orig<typeof import('./sync')>()),
  getPrefs: () => h.prefs,
  subscribePlanner: (f: () => void) => (h.planner.add(f), () => h.planner.delete(f)),
  startPlannerSync: () => () => undefined,
}));
vi.mock('../healthAddons', async (orig) => ({
  ...(await orig<typeof import('../healthAddons')>()),
  restPeriodShown: () => true,
  healthAddonInstalled: () => h.injuryModule,
}));

const fire = (set: Set<() => void>) => set.forEach((f) => f());

let bootRepublishes = 0;
beforeAll(async () => {
  await import('./plannerBoot');
  bootRepublishes = h.republish.mock.calls.length;
});
beforeEach(() => {
  // back to the base view and settled, so every test starts from "nothing pending"
  h.injuryModule = true;
  h.prefs = { shareAvailability: true, availability: { 0: [[540, 600]] } };
  h.state = { restPeriods: [], injuries: [] };
  fire(h.planner);
  h.republish.mockClear();
});

describe('plannerBoot: when the coach view is republished', () => {
  it('once at boot, and not again when nothing changed', () => {
    expect(bootRepublishes).toBe(1);
    fire(h.planner);
    fire(h.store);
    expect(h.republish).not.toHaveBeenCalled();
  });
  it('the person turns sharing off or edits the hours: republished', () => {
    h.prefs = { ...h.prefs, availability: { 0: [[540, 660]] } };
    fire(h.planner);
    expect(h.republish).toHaveBeenCalledTimes(1);
    h.prefs = { ...h.prefs, shareAvailability: false };
    fire(h.planner);
    expect(h.republish).toHaveBeenCalledTimes(2);
  });
  it('a Health rest period or an injury no-load window appears: republished; an injury without a window is not', () => {
    h.state = {
      ...h.state,
      restPeriods: [{ id: 'p', mode: 'illness', startDay: 1e9, endDay: 1e9 + 2 }],
    };
    fire(h.store);
    expect(h.republish).toHaveBeenCalledTimes(1);
    h.state = {
      ...h.state,
      injuries: [{ id: 'i', startDay: 1, fullRestUntil: null, healedDay: null }],
    };
    fire(h.store);
    expect(h.republish).toHaveBeenCalledTimes(1);
    h.state = {
      ...h.state,
      injuries: [{ id: 'i', startDay: 1e9, fullRestUntil: 1e9 + 5, healedDay: null }],
    };
    fire(h.store);
    expect(h.republish).toHaveBeenCalledTimes(2);
  });
  it('with the injury module off an injury never reaches the view', () => {
    h.injuryModule = false;
    h.state = {
      ...h.state,
      injuries: [{ id: 'i', startDay: 1e9, fullRestUntil: 1e9 + 5, healedDay: null }],
    };
    fire(h.store);
    expect(h.republish).not.toHaveBeenCalled();
  });
});
