import { describe, expect, it } from 'vitest';
import { maskHealth } from './healthMask';
import { emptyCycleState } from './cycle/cycleState';
import { emptyNicotineState, newNicotineProduct } from './nicotine';
import { emptyAlcoholState } from './alcohol';
import { emptySupplementState } from './supplements';
import type { HealthOnMap } from './data/healthConsentGate';

const ALL: HealthOnMap = {
  injuries: true,
  chronic: true,
  cycle: true,
  nicotine: true,
  alcohol: true,
  supplements: true,
  nutrition: true,
};
const raw = {
  injuries: [{ id: 'i' }],
  conditions: [{ id: 'c' }],
  nicotine: { ...emptyNicotineState(), products: [newNicotineProduct('vape', 'p')], updatedAt: 5 },
  cycle: { ...emptyCycleState(), enabled: true, updatedAt: 5 },
  alcohol: { ...emptyAlcoholState(), updatedAt: 5 },
  supplements: { ...emptySupplementState(), updatedAt: 5 },
  other: 'x',
} as unknown as Parameters<typeof maskHealth>[0] & { other: string };

describe('maskHealth', () => {
  it('returns the very same state when every feature is on', () => {
    expect(maskHealth(raw, ALL)).toBe(raw);
  });

  it('replaces only the features that are off, by their empty value, and keeps the rest', () => {
    const m = maskHealth(raw, { ...ALL, injuries: false, nicotine: false, cycle: false });
    expect(m.injuries).toEqual([]);
    expect(m.nicotine.products).toEqual([]);
    expect(m.cycle.enabled).toBe(false);
    expect(m.conditions).toBe(raw.conditions);
    expect(m.alcohol).toBe(raw.alcohol);
    expect(m.other).toBe('x');
  });

  it('keeps references stable between calls (no needless re-render)', () => {
    const off = { ...ALL, chronic: false, supplements: false };
    expect(maskHealth(raw, off).conditions).toBe(maskHealth(raw, off).conditions);
    expect(maskHealth(raw, off).supplements).toBe(maskHealth(raw, off).supplements);
  });

  it('every feature off empties all six held in the store', () => {
    const none = Object.fromEntries(Object.keys(ALL).map((k) => [k, false])) as HealthOnMap;
    const m = maskHealth(raw, none);
    expect([m.injuries.length, m.conditions.length, m.nicotine.products.length]).toEqual([0, 0, 0]);
    expect(m.supplements.updatedAt).toBe(0);
    expect(m.alcohol.updatedAt).toBe(0);
  });
});
