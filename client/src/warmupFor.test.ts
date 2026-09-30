import { describe, expect, it } from 'vitest';
import { MAX_PER_TARGET, warmupSuggestions } from './warmupFor';
import { richExerciseById, richExerciseByName } from './data/exercises';
import { NO_LIMITS, type Limits } from './conditions';
import type { Injury } from './types';

const limits = (avoid: string[]): Limits => ({
  effects: { avoid: avoid as never[] },
  avoidBy: Object.fromEntries(avoid.map((t) => [t, ['x']])),
  cautionBy: {},
  capBy: {},
  keys: ['x'],
});
const injury = (muscles: Injury['muscles'], stage: Injury['stage'] = 'protect'): Injury => ({
  id: 'i',
  reason: 'injury',
  bodyPart: 'knee',
  muscles,
  stage,
  startDay: 0,
  createdAt: 0,
  checkins: [],
});
const all = (s: ReturnType<typeof warmupSuggestions>) => [
  ...s.mobility,
  ...s.activation,
  ...s.cardio,
];

describe('warmupSuggestions', () => {
  it('is deterministic and capped per target', () => {
    const a = warmupSuggestions({ muscles: ['chest', 'shoulders'] });
    expect(warmupSuggestions({ muscles: ['chest', 'shoulders'] })).toEqual(a);
    for (const list of Object.values(a)) expect(list.length).toBeLessThanOrEqual(MAX_PER_TARGET);
    expect(a.mobility.length).toBeGreaterThan(0);
    expect(a.activation.length).toBeGreaterThan(0);
    expect(a.cardio.length).toBeGreaterThan(0);
  });

  it('builds mobility from stretching catalog entries for the day muscles', () => {
    const s = warmupSuggestions({ muscles: ['hamstrings', 'quads'] });
    for (const m of s.mobility) {
      const r = richExerciseById(m.exerciseId);
      expect(r?.category).toBe('stretching');
      expect(['hamstrings', 'quads']).toContain(r?.primaryMuscles[0]);
    }
  });

  it('every suggestion resolves to a real catalog move', () => {
    const s = warmupSuggestions({ dayType: 'full' });
    for (const x of all(s)) expect(richExerciseByName(x.name)?.id).toBe(x.exerciseId);
  });

  it('leads with moving drills and keeps leg cardio first on a lower day', () => {
    const lower = warmupSuggestions({ dayType: 'lower' });
    expect(lower.cardio[0].exerciseId).toMatch(/Walking_Treadmill|Bicycling_Stationary/);
    const upper = warmupSuggestions({ dayType: 'upper' });
    expect(upper.cardio[0].exerciseId).not.toBe('Walking_Treadmill');
  });

  it('falls back to the day type when no muscles are given', () => {
    const lower = warmupSuggestions({ dayType: 'lower' });
    expect(
      lower.mobility.every((m) =>
        ['hamstrings', 'quads', 'glutes', 'calves', 'adductors', 'abductors'].includes(
          m.muscle ?? '',
        ),
      ),
    ).toBe(true);
  });

  it('drops anything the condition limits avoid', () => {
    const plain = warmupSuggestions({ muscles: ['glutes'] });
    expect(plain.activation.some((x) => /Bridge/i.test(x.name))).toBe(true);
    const limited = warmupSuggestions({ muscles: ['glutes'], limits: limits(['extension']) });
    expect(limited.activation.some((x) => /Bridge/i.test(x.name))).toBe(false);
    expect(warmupSuggestions({ muscles: ['glutes'], limits: NO_LIMITS })).toEqual(plain);
  });

  it('leaves out muscles still in Protect, keeps those in a later stage', () => {
    const prot = warmupSuggestions({
      muscles: ['shoulders', 'hamstrings'],
      injuries: [injury(['hamstrings'])],
    });
    expect(
      all(prot).some((x) => richExerciseById(x.exerciseId)?.primaryMuscles.includes('hamstrings')),
    ).toBe(false);
    const later = warmupSuggestions({
      muscles: ['shoulders', 'hamstrings'],
      injuries: [injury(['hamstrings'], 'rebuild')],
    });
    expect(later.mobility.some((x) => x.muscle === 'hamstrings')).toBe(true);
  });

  it('never repeats names already on the list', () => {
    const first = warmupSuggestions({ muscles: ['shoulders'] });
    const names = first.mobility.map((m) => m.name.toUpperCase());
    const next = warmupSuggestions({ muscles: ['shoulders'], exclude: names });
    for (const m of next.mobility) expect(names).not.toContain(m.name.toUpperCase());
  });

  it('falls back to the mobility lines when every catalog drill is ruled out', () => {
    const s = warmupSuggestions({
      muscles: ['shoulders'],
      injuries: [injury(['shoulders'])],
      dayType: 'upper',
    });
    expect(s.mobility.length).toBeGreaterThan(0);
    expect(s.mobility.every((m) => m.exerciseId === null && m.key.startsWith('text:'))).toBe(true);
  });
});
