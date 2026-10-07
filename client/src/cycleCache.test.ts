import { describe, expect, it } from 'vitest';
import { CYCLE_ENC_KEY, CYCLE_KEY, createCycleCache } from './cycleCache';
import { emptyCycleState, normalizeCycle, type CycleState } from './cycle/cycleState';

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};
const saved = (): CycleState => ({
  ...emptyCycleState(),
  enabled: true,
  settings: { mode: 'regular', length: 28, period: 5, anchor: 100 },
  updatedAt: 5,
});

describe('cycleCache', () => {
  it('without a key keeps a plaintext fallback, never loses data', () => {
    const st = mem();
    const c = createCycleCache({ vault: { materialOrNull: () => null }, storage: () => st });
    c.persist(saved());
    expect(st.getItem(CYCLE_KEY)).toContain('"anchor":100');
    expect(c.load().settings?.length).toBe(28);
  });
  it('never saved (updatedAt 0) writes nothing', () => {
    const st = mem();
    const c = createCycleCache({ vault: { materialOrNull: () => null }, storage: () => st });
    c.persist(emptyCycleState());
    expect(st.m.size).toBe(0);
  });
  it('clear removes both copies', () => {
    const st = mem();
    st.setItem(CYCLE_KEY, '{}');
    st.setItem(CYCLE_ENC_KEY, '{}');
    createCycleCache({ vault: { materialOrNull: () => null }, storage: () => st }).clear();
    expect(st.m.size).toBe(0);
  });
});

describe('normalizeCycle', () => {
  it('survives garbage and clamps values', () => {
    expect(normalizeCycle(null)).toEqual(emptyCycleState());
    expect(normalizeCycle({ settings: { mode: 'x' } }).settings).toBeNull();
    const n = normalizeCycle({
      enabled: true,
      settings: { mode: 'regular', length: 200, period: 0, anchor: 9.4 },
    });
    expect(n.settings).toMatchObject({ length: 60, period: 1, anchor: 9 });
  });
});
