import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CoachSupplements, supEffectText } from './CoachSupplements';
import { setLocale } from '../i18n';
import { supplementsCoachView } from './../supplementsShare';
import { defaultSupplementSettings, newSupplementEntry } from '../supplements';
import type { SupplementCheckin, SupplementEntry, SupplementId, SupplementState } from '../types';

const T0 = new Date(2026, 8, 1, 10).getTime();
const NOW = new Date(2027, 2, 1, 12).getTime(); // full creatine ramp
const ent = (id: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry(id, `e-${id}`, T0),
  ...over,
});
const state = (
  sharing: 'off' | 'effects' | 'full',
  entries: SupplementEntry[],
  checkins: Record<string, SupplementCheckin> = {},
): SupplementState => {
  const settings = defaultSupplementSettings();
  settings.sharing = sharing;
  return { entries, checkins, settings, updatedAt: 1 };
};
const allTraining = { isTrainingDay: () => true, bodyWeightKg: 80, usualTrainingStartMin: 18 * 60 };
const ENTRIES = [
  ent('creatine'),
  ent('whey', { timing: 'postWorkout' }),
  ent('preWorkout', { dose: 1.5 }),
];

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('supEffectText', () => {
  const t = { minShort: 'min', supFxUnit: { g: 'g' } } as never;
  it('formats each effect with its unit, the strong end last', () => {
    expect(supEffectText('strength', 0, 0.08, t)).toBe('0 → +8 %');
    expect(supEffectText('bodyweightKg', 0.5, 2, t)).toBe('+0.5 → +2 kg');
    expect(supEffectText('rpe', -0.5, -0.2, t)).toBe('−0.2 → −0.5');
    expect(supEffectText('sleepMin', 0, 22.5, t)).toBe('0 → +23 min');
    expect(supEffectText('proteinGrams', 40, 40, t)).toBe('+40 g');
  });
});

describe('CoachSupplements', () => {
  it('"effects": neutral labels and ranges, never a name, dose or schedule', () => {
    const view = supplementsCoachView(state('effects', ENTRIES), allTraining, NOW)!;
    const { container } = render(<CoachSupplements view={view} />);
    expect(screen.getByText('Expected effects')).toBeTruthy();
    expect(screen.getByText('Strength (expectation)')).toBeTruthy();
    expect(screen.getByText('Effort (RPE)')).toBeTruthy();
    expect(screen.getByText('0 → +8 %')).toBeTruthy();
    expect(screen.getByText(/Study averages, not promises/)).toBeTruthy();
    expect(screen.queryByText('What they take')).toBeNull();
    for (const secret of [/Creatine/, /Whey/, /Pre-workout/, /\b5 g\b/, /Daily/, /Training days/])
      expect(container.textContent).not.toMatch(secret);
  });

  it('"full": the supplements with dose, schedule and timing, and the caffeine and protein totals', () => {
    const view = supplementsCoachView(state('full', ENTRIES), allTraining, NOW)!;
    render(<CoachSupplements view={view} />);
    expect(screen.getByText('What they take')).toBeTruthy();
    expect(screen.getByText('Creatine')).toBeTruthy();
    expect(screen.getByText('5 g · Daily · Any time')).toBeTruthy();
    expect(screen.getByText('1.5 × scoop · Training days · Pre-workout')).toBeTruthy();
    expect(screen.getByText('Caffeine about 300 mg on a training day')).toBeTruthy();
    expect(screen.getByText('Protein from supplements about 20 g on a training day')).toBeTruthy();
  });

  it('never carries the day check-ins', () => {
    const view = supplementsCoachView(
      state('full', ENTRIES, { '2026-10-06': { taken: false } }),
      allTraining,
      NOW,
    )!;
    expect(JSON.stringify(view)).not.toContain('2026-10-06');
  });

  it('"off" shares nothing; "effects" with no effect shares nothing', () => {
    expect(supplementsCoachView(state('off', ENTRIES), allTraining, NOW)).toBeNull();
    expect(supplementsCoachView(state('effects', [ent('vitaminD')]), allTraining, NOW)).toBeNull();
  });

  it('renders in every locale without missing strings', () => {
    const view = supplementsCoachView(state('full', ENTRIES), allTraining, NOW)!;
    for (const lang of ['uk', 'pl', 'lt', 'et'] as const) {
      setLocale(lang);
      const r = render(<CoachSupplements view={view} />);
      expect(r.container.textContent).not.toMatch(/undefined|\[object/);
      expect(r.container.textContent!.length).toBeGreaterThan(40);
      r.unmount();
    }
  });
});
