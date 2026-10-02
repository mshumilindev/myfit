import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NicotineCalcView } from './NicotineCalcView';
import { setLocale } from '../../../i18n';
import { en } from '../../../i18n/en';
import { et } from '../../../i18n/et';
import { lt } from '../../../i18n/lt';
import { pl } from '../../../i18n/pl';
import { uk } from '../../../i18n/uk';
import { EVIDENCE_SURFACES, EXPERIMENTAL_SURFACES, NICOTINE_SURFACES } from '../../../nicotine';
import {
  __getStateForTests,
  deleteNicotineData,
  setNicotineSurface,
  setNicotineUseInCalculations,
} from '../../../store';

beforeEach(() => {
  setLocale('en');
  deleteNicotineData();
});
afterEach(cleanup);

const settings = () => __getStateForTests().nicotine.settings;

describe('NicotineCalcView', () => {
  const sw = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

  it('master on by default; two groups: research (on) and experimental (off)', () => {
    render(<NicotineCalcView onBack={() => undefined} />);
    expect(sw('Use nicotine in my numbers').checked).toBe(true);
    expect(screen.getAllByRole('switch')).toHaveLength(NICOTINE_SURFACES.length + 1);
    expect(screen.getByText('Based on research (weak)')).toBeTruthy();
    expect(screen.getByText('Experimental — no research behind it yet')).toBeTruthy();
    expect(screen.getByText(/The estimates are guesses/)).toBeTruthy();
    for (const k of EVIDENCE_SURFACES) expect(settings().surfaces[k]).toBe(true);
    for (const k of EXPERIMENTAL_SURFACES) expect(settings().surfaces[k]).toBe(false);
    for (const name of ['Recovery and readiness', 'Sleep', 'Trends', 'After a workout'])
      expect(sw(name).checked).toBe(true);
    for (const name of [
      'Fatigue and deload',
      'Warm-up length',
      'Rest between sets',
      'Progression steps',
      'RPE targets',
    ])
      expect(sw(name).checked).toBe(false);
  });

  it('switches apply immediately, in both groups', () => {
    render(<NicotineCalcView onBack={() => undefined} />);
    fireEvent.click(sw('Sleep'));
    expect(settings().surfaces.sleep).toBe(false);
    fireEvent.click(sw('RPE targets'));
    expect(settings().surfaces.rpe).toBe(true);
    fireEvent.click(sw('Use nicotine in my numbers'));
    expect(settings().useInCalculations).toBe(false);
    setNicotineUseInCalculations(true);
    setNicotineSurface('sleep', true);
    setNicotineSurface('rpe', false);
  });

  it('disables the per-surface switches while the master is off', () => {
    setNicotineUseInCalculations(false);
    render(<NicotineCalcView onBack={() => undefined} />);
    expect(sw('Sleep').disabled).toBe(true);
    expect(sw('RPE targets').disabled).toBe(true);
  });

  it('Done goes back', () => {
    let n = 0;
    render(<NicotineCalcView onBack={() => n++} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(n).toBe(1);
  });
});

describe('Nicotine page titles', () => {
  // The page title is one line (ellipsis). At 390 px about 20 characters of the 26 px title
  // fit, so "Використання в розрахунках" / "Naudojimas skaičiavimuose" were cut to "…".
  it('stay short enough for a one-line title in every locale', () => {
    for (const [id, dict] of Object.entries({ en, uk, pl, lt, et })) {
      for (const key of ['nicCalcTitle', 'hlPrivRow', 'nicTitle'] as const) {
        expect(dict[key].length, `${id}.${key}`).toBeLessThanOrEqual(22);
      }
    }
  });
});
