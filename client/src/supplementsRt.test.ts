import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPLEMENT_NEUTRAL as REAL_NEUTRAL, normalizeSupplements } from './supplements';
import { SUPPLEMENT_NEUTRAL } from './supplementsRt';

describe('supplements facade (SPO-500 I8)', () => {
  beforeEach(() => vi.resetModules());

  it('neutral value equals the model neutral', () => {
    expect(SUPPLEMENT_NEUTRAL).toBe(REAL_NEUTRAL);
  });

  it('is neutral and non-destructive until the real modules are loaded', async () => {
    const { sup } = await import('./supplementsRt');
    expect(sup.effectsFor(null, Date.now(), {} as never)).toBeNull();
    expect(sup.proteinGramsFor(null, Date.now(), {} as never)).toBe(0);
    expect(sup.warnings(null, {} as never)).toEqual([]);
    expect(sup.pending(Date.now(), null, {} as never)).toBeNull();
    expect(sup.usualStartMin([], Date.now())).toBeNull();
    expect(sup.trainingDayResolver({} as never)('2026-01-01')).toBe(false);
    expect(sup.coachView(null)).toBeNull();
    expect(sup.normalizeEntry({}, 0)).toBeNull();
    expect(sup.isSharing('full')).toBe(true);
    expect(sup.isSharing('x')).toBe(false);
    const n = sup.normalize({ entries: [{ id: 'a' }], updatedAt: 9 });
    expect(n.entries).toEqual([{ id: 'a' }]);
    expect(n.updatedAt).toBe(9);
    expect(sup.normalize(null).entries).toEqual([]);
    expect(sup.normalizeCheckins({ d: 1 })).toEqual({ d: 1 });
    expect(sup.normalizeCheckins(null)).toEqual({});
  });

  it('the real modules take over once imported, and the boot announces readiness', async () => {
    const { sup } = await import('./supplementsRt');
    const { onTrackerReady } = await import('./trackerRt');
    const seen: string[] = [];
    const off = onTrackerReady((id) => seen.push(id));
    await import('./supplementsBoot');
    off();
    expect(seen).toEqual(['supplements']);
    expect(sup.normalize({ entries: [{ id: 'bad' }] }).entries).toEqual([]);
    expect(sup.empty()).toEqual(normalizeSupplements(null));
  });
});
