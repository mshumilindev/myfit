import { describe, expect, it } from 'vitest';
import { readyVault, unsetVault } from '../testVault';
import { openPlans, openPrefs, sealPlan, sealPrefs, DEFAULT_PREFS } from './data';
import { zonedToUtc } from './zoned';
import type { PlanDoc } from './types';

const plan: PlanDoc = {
  id: 'p1',
  title: 'Dentist, Dr Kowalski',
  note: 'bring the X-ray',
  icon: 'tooth',
  color: 'blue',
  timing: {
    tz: 'Europe/Warsaw',
    start: '2026-11-12',
    time: '18:00',
    lead: 60,
    repeat: { kind: 'none' },
    ends: { kind: 'never' },
    skip: [],
  },
  mode: 'ring',
  respectQuiet: false,
  enabled: true,
  nextFireAt: null,
  v: 1,
  updatedAt: 0,
};

describe('Planner data is sealed (SPO-552 I2)', () => {
  it('the stored plan shows only when, how loud and a stamp; nothing readable', async () => {
    const v = await readyVault();
    const now = zonedToUtc('2026-11-10', '09:00', 'Europe/Warsaw');
    const raw = await sealPlan(plan, now, v);
    expect(Object.keys(raw).sort()).toEqual(
      ['enc', 'enabled', 'fireAts', 'id', 'mode', 'nextFireAt', 'updatedAt', 'v'].sort(),
    );
    expect(raw.nextFireAt).toBe(zonedToUtc('2026-11-12', '17:00', 'Europe/Warsaw'));
    expect(raw.mode).toBe('ring');
    const text = JSON.stringify(raw);
    for (const secret of ['Dentist', 'Kowalski', 'X-ray', 'tooth', 'Warsaw', '18:00'])
      expect(text).not.toContain(secret);
  });
  it('round-trips with the key', async () => {
    const v = await readyVault();
    const raw = await sealPlan(plan, 1_700_000_000_000, v);
    const { plans, locked } = await openPlans([raw], v);
    expect(locked).toBe(0);
    expect(plans[0]).toMatchObject({
      id: 'p1',
      title: 'Dentist, Dr Kowalski',
      note: 'bring the X-ray',
      icon: 'tooth',
    });
  });
  it('a plan that is over, or switched off, has no next reminder', async () => {
    const v = await readyVault();
    const past = zonedToUtc('2027-01-01', '09:00', 'Europe/Warsaw');
    expect((await sealPlan(plan, past, v)).nextFireAt).toBeNull();
    expect((await sealPlan({ ...plan, enabled: false }, 1, v)).nextFireAt).toBeNull();
  });
  it('without the key it stays locked, never plaintext', async () => {
    const v = await readyVault();
    const raw = await sealPlan(plan, 1, v);
    const off = await unsetVault();
    expect(await openPlans([raw], off)).toEqual({ plans: [], locked: 1 });
  });
  it('availability and defaults are sealed too (only the stamp is open)', async () => {
    const v = await readyVault();
    const raw = await sealPrefs({ ...DEFAULT_PREFS, shareAvailability: true }, 5, v);
    expect(Object.keys(raw).sort()).toEqual(['enc', 'updatedAt']);
    expect(await openPrefs(raw, v)).toMatchObject({ shareAvailability: true, updatedAt: 5 });
  });
});
