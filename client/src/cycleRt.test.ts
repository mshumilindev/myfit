import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MENOPAUSE_KEY as REAL_KEY } from './cycle/cycleCore';
import { emptyCycleState, normalizeCycle } from './cycle/cycleState';
import { MENOPAUSE_KEY } from './cycleRt';

describe('cycle facade (SPO-500 I8)', () => {
  beforeEach(() => vi.resetModules());

  it('constants and the empty document match the model', async () => {
    expect(MENOPAUSE_KEY).toBe(REAL_KEY);
    vi.resetModules();
    const { cyc } = await import('./cycleRt');
    expect(cyc.empty()).toEqual(emptyCycleState());
  });

  it('passes stored data through untouched until the real modules are loaded', async () => {
    const { cyc } = await import('./cycleRt');
    const n = cyc.normalize({ enabled: true, starts: [3], updatedAt: 4 });
    expect(n.enabled).toBe(true);
    expect(n.starts).toEqual([3]);
    expect(cyc.normalize(null)).toEqual(cyc.empty());
    expect(cyc.withStart([1], 2)).toEqual([1, 2]);
    const s = { anchor: 1 } as never;
    expect(cyc.normalizeSettings(s)).toBe(s);
  });

  it('the real modules take over once imported, and the boot announces readiness', async () => {
    const { cyc } = await import('./cycleRt');
    const { onTrackerReady } = await import('./trackerRt');
    const seen: string[] = [];
    const off = onTrackerReady((id) => seen.push(id));
    await import('./cycleBoot');
    off();
    expect(seen).toEqual(['cycle']);
    expect(cyc.normalize({ starts: 'bad' })).toEqual(normalizeCycle({ starts: 'bad' }));
  });
});
