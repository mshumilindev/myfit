import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CoachAlcohol } from './CoachAlcohol';
import { alcoholCoachView } from '../alcoholShare';
import { ALCOHOL_SURFACES, defaultAlcoholSettings, newAlcoholEntry } from '../alcohol';
import { setLocale } from '../i18n';

function state(sharing: 'off' | 'effects', allOn = true) {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = true;
  settings.sharing = sharing;
  if (allOn) for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  return {
    entries: [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: 6 }],
    settings,
  };
}
beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('CoachAlcohol', () => {
  it('shows only effects, tagged: weak for readiness and sleep, experimental for the rest', () => {
    const v = alcoholCoachView(state('effects'))!;
    expect(v.mode).toBe('effects');
    render(<CoachAlcohol view={v} />);
    expect(screen.getAllByText('Weak evidence')).toHaveLength(2);
    expect(screen.getAllByText('Experimental')).toHaveLength(2);
    expect(screen.getByText('Recovery and readiness')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    // Never the drinks.
    expect(screen.queryByText(/beer/i)).toBeNull();
  });
  it('experimental surfaces are left out while they are off (the default)', () => {
    const v = alcoholCoachView(state('effects', false))!;
    expect(v.effects.map((e) => e.key).sort()).toEqual(['readiness', 'sleepMin']);
  });
  it('sharing off gives no view and nothing renders for an empty one', () => {
    expect(alcoholCoachView(state('off'))).toBeNull();
    const { container } = render(<CoachAlcohol view={{ mode: 'effects', effects: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});
