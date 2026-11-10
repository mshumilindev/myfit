import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL, SURFACE_COEFFS, normalizeNicotine } from './nicotine';
import { NEUTRAL_MID } from './nicotineRt';

describe('nicotine facade (SPO-500 I8)', () => {
  beforeEach(() => vi.resetModules());

  it('neutral midpoints equal the model neutrals (x1 factors, +0 minutes / RPE)', () => {
    for (const k of Object.keys(SURFACE_COEFFS) as (keyof typeof SURFACE_COEFFS)[])
      expect(NEUTRAL_MID[k]).toBe(NEUTRAL[SURFACE_COEFFS[k].mode]);
  });

  it('is neutral and non-destructive until the real modules are loaded', async () => {
    const { nic } = await import('./nicotineRt');
    expect(nic.effects({ products: [], settings: nic.empty().settings })).toBeNull();
    expect(nic.coachView(nic.empty())).toBeNull();
    expect(nic.load([])).toEqual({ mgPerDay: 0, absorbedMgPerDay: 0, cigEq: 0 });
    expect(nic.surfaceOn(nic.empty().settings, 'trends')).toBe(false);
    expect(nic.normalizeProduct({})).toBeNull();
    expect(nic.isSharing('full')).toBe(true);
    expect(nic.isSharing('x')).toBe(false);
    expect(nic.rpeCap()).toBe(0);
    const n = nic.normalize({ products: [{ id: 'a' }], updatedAt: 7 });
    expect(n.products).toEqual([{ id: 'a' }]);
    expect(n.updatedAt).toBe(7);
    expect(nic.normalize(null).products).toEqual([]);
  });

  it('the real modules take over once imported, and the boot announces readiness', async () => {
    const { nic } = await import('./nicotineRt');
    const { onTrackerReady } = await import('./trackerRt');
    const seen: string[] = [];
    const off = onTrackerReady((id) => seen.push(id));
    await import('./nicotineBoot');
    off();
    expect(seen).toEqual(['nicotine']);
    expect(nic.normalize({ products: [{ id: 'bad' }] }).products).toEqual([]);
    expect(nic.empty()).toEqual(normalizeNicotine(null));
    expect(nic.rpeCap()).toBe(SURFACE_COEFFS.rpe.cap);
  });
});
