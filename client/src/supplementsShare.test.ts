import { describe, expect, it } from 'vitest';
import { supplementsCoachView } from './supplementsShare';
import { defaultSupplementSettings, newSupplementEntry } from './supplements';
import type { SupplementState } from './types';

const T = Date.parse('2026-10-02T12:00:00');
const st = (sharing: 'off' | 'effects' | 'full', ids: string[] = ['creatine', 'whey']) =>
  ({
    entries: ids.map((id, i) =>
      newSupplementEntry(id as never, `e${i}`, T - 70 * 24 * 3600 * 1000),
    ),
    settings: { ...defaultSupplementSettings(), sharing },
  }) as Pick<SupplementState, 'entries' | 'settings'>;

describe('supplementsCoachView', () => {
  it('null when off, empty or missing', () => {
    expect(supplementsCoachView(st('off'), undefined, T)).toBeNull();
    expect(supplementsCoachView(null)).toBeNull();
    expect(supplementsCoachView(st('full', []), undefined, T)).toBeNull();
  });
  it('effects: ranges only', () => {
    const v = supplementsCoachView(st('effects'), { isTrainingDay: () => true }, T)!;
    expect(v.mode).toBe('effects');
    expect(v.full).toBeUndefined();
    expect(v.effects.some((e) => e.key === 'strength')).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/creatine"|whey/);
  });
  it('full: items and totals', () => {
    const v = supplementsCoachView(st('full'), { isTrainingDay: () => true }, T)!;
    expect(v.full!.items.map((i) => i.itemId)).toEqual(['creatine', 'whey']);
    expect(v.full!.proteinGramsPerDay).toBeGreaterThan(0);
    expect(v.full!.caffeineMgPerDay).toBe(0);
  });
});
