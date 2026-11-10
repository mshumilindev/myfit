import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL, SURFACE_COEFFS, ALCOHOL_EFFECT_KEYS, normalizeAlcohol } from './alcohol';
import { NEUTRAL_MID } from './alcoholRt';
import { provide } from './trackerRt';

describe('alcohol facade (SPO-500 I8)', () => {
  beforeEach(() => vi.resetModules());

  it('neutral midpoints equal the model neutrals (x1 factors, +0 minutes)', () => {
    for (const k of ALCOHOL_EFFECT_KEYS)
      expect(NEUTRAL_MID[k]).toBe(NEUTRAL[SURFACE_COEFFS[k].mode]);
  });

  it('is neutral and non-destructive until the real modules are loaded', async () => {
    const { alc } = await import('./alcoholRt');
    expect(alc.effects(null)).toBeNull();
    expect(alc.effectsFor(null, Date.now())).toBeNull();
    expect(alc.weekActual(null, Date.now(), 1)).toBeNull();
    expect(alc.pending(Date.now(), null)).toBeNull();
    expect(alc.coachView(null)).toBeNull();
    expect(alc.load([])).toEqual({ gramsPerWeek: 0, gramsPerDay: 0 });
    expect(alc.surfaceOn({} as never, 'trends')).toBe(false);
    expect(alc.dayKey(Date.now())).toBeNull();
    expect(alc.cleanUsualDays([1])).toEqual([]);
    expect(alc.usualGrams([], [])).toBe(0);
    expect(alc.normalizeEntry({})).toBeNull();
    expect(alc.isSharing('effects')).toBe(true);
    expect(alc.isSharing('full')).toBe(false);
    expect(alc.isRegion('us')).toBe(true);
    expect(alc.resolveRegion(null)).toBe('eu');
    expect(alc.resolveRegion('us')).toBe('us');
    // Stored data passes through untouched, so nothing is lost before the model is here.
    const stored = { entries: [{ id: 'a' }], updatedAt: 5 };
    const n = alc.normalize(stored);
    expect(n.entries).toEqual([{ id: 'a' }]);
    expect(n.updatedAt).toBe(5);
    expect(alc.normalize(null).entries).toEqual([]);
    expect(alc.normalizeCheckins({ d: 1 })).toEqual({ d: 1 });
    expect(alc.normalizeCheckins(null)).toEqual({});
  });

  it('the real modules take over once imported, and the boot announces readiness', async () => {
    const { alc } = await import('./alcoholRt');
    const { onTrackerReady, trackerReady } = await import('./trackerRt');
    const seen: string[] = [];
    const off = onTrackerReady((id) => seen.push(id));
    await import('./alcoholBoot');
    expect(seen).toEqual(['alcohol']);
    expect(alc.normalize({ entries: [{ id: 'bad' }], updatedAt: 3 }).entries).toEqual([]);
    expect(alc.empty()).toEqual(normalizeAlcohol(null));
    expect(alc.surfaceOn(alc.empty().settings, 'afterWorkoutHints')).toBeTypeOf('boolean');
    off();
    trackerReady('alcohol');
    expect(seen).toEqual(['alcohol']);
  });

  it('provide replaces members in place', () => {
    const rt = { f: () => 1 };
    provide(rt, { f: () => 2 });
    expect(rt.f()).toBe(2);
  });
});
