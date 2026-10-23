import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatMsg, storeSlice } from './fixtures.testutil';

const h = vi.hoisted(() => ({
  state: null as unknown,
  raw: { injuries: [{ id: 'raw-i' }], cycle: { updatedAt: 3 } } as unknown,
  stored: {} as Record<string, boolean>,
  loaded: true,
  rawFood: false,
  food: { entries: [] as unknown[], customFoods: [] as unknown[], goal: null, profile: null },
  rawFoodData: {
    entries: [] as unknown[],
    customFoods: [] as unknown[],
    goal: null,
    profile: null,
  },
  chat: [] as unknown[],
}));
vi.mock('../../api', () => ({
  registerSignOutFlush: () => undefined, // signupConsents registers its queues with api.ts at import
  currentUid: () => 'u1',
  getRole: () => 'member',
  getUsername: () => 'tester',
}));
vi.mock('../../atlas/chatLog', () => ({ getChatLog: () => h.chat }));
vi.mock('../../nutrition/store', () => ({
  nutritionLoaded: async () => h.loaded,
  hasNutritionData: () => h.rawFood,
  store: { get: () => h.food },
  storedNutrition: () => h.rawFoodData,
}));
vi.mock('../../store', () => ({
  getStoreState: () => h.state,
  hasStoredHealthData: (f: string) => h.stored[f] ?? false,
  getStoredHealthForExport: () => h.raw,
}));

import { readExportSources } from './readSources';

beforeEach(() => {
  h.state = { ...storeSlice(), syncStatus: 'synced' };
  h.stored = {};
  h.loaded = true;
  h.rawFood = false;
  h.food = { entries: [], customFoods: [], goal: null, profile: null };
  h.rawFoodData = h.food;
  h.chat = [chatMsg('1', 'me', 'hi')];
});

const live = { consents: [], hasTrainer: true };

describe('readExportSources', () => {
  it('reads the account, the store and the chat as they are now', async () => {
    const s = await readExportSources(live);
    expect(s.account).toEqual({ uid: 'u1', username: 'tester', role: 'member' });
    expect(s.storeSynced).toBe(true);
    expect(s.chat).toHaveLength(1);
    expect(s.hasTrainer).toBe(true);
    expect(s.hiddenHealth).toEqual([]);
  });

  it('a store not confirmed in step with the account is a device copy', async () => {
    h.state = { ...storeSlice(), syncStatus: 'offline' };
    expect((await readExportSources(live)).storeSynced).toBe(false);
  });

  it('health data that is stored but hidden by the consent mask is named as hidden', async () => {
    h.stored = { cycle: true, injuries: true, alcohol: true };
    h.state = {
      ...storeSlice({ injuries: [{ id: 'i1' } as never], alcohol: { updatedAt: 5 } as never }),
      syncStatus: 'synced',
    };
    expect((await readExportSources(live)).hiddenHealth).toEqual(['cycle']);
  });

  it('nutrition: not loaded, or stored (hidden by consent or readable) and always handed over', async () => {
    h.loaded = false;
    expect((await readExportSources(live)).nutrition).toBeNull();
    h.loaded = true;
    // the app shows nothing (consent off) but the raw state holds one entry
    h.rawFood = true;
    h.rawFoodData = { entries: [{ id: 'raw' }], customFoods: [], goal: null, profile: null };
    const hidden = (await readExportSources(live)).nutrition;
    expect(hidden?.hidden).toBe(true);
    expect(hidden?.entries).toHaveLength(1);
    // shown in the app too: not hidden
    h.food = { entries: [{ id: 'm' }], customFoods: [], goal: null, profile: null };
    h.rawFoodData = h.food;
    const shown = (await readExportSources(live)).nutrition;
    expect(shown?.hidden).toBe(false);
    expect(shown?.entries).toHaveLength(1);
  });

  it('health comes from the raw accessor, not from the masked view', async () => {
    const s = await readExportSources(live);
    expect(s.health).toBe(h.raw);
  });
});
