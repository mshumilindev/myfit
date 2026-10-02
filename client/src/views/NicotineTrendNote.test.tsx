import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NicotineTrendNote } from './NicotineTrendNote';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { defaultNicotineSettings, emptyNicotineState, newNicotineProduct } from '../nicotine';
import { defaultAlcoholSettings, emptyAlcoholState, newAlcoholEntry } from '../alcohol';
import { setLocale } from '../i18n';
import type { NicotineSettings } from '../types';

const NOTE = 'Recovery figures include your nicotine use. Estimates.';
function seed(over: Partial<NicotineSettings> = {}, trends = true, withProduct = true) {
  const settings = { ...defaultNicotineSettings(), ...over };
  settings.surfaces = { ...settings.surfaces, trends };
  __replaceStateForTests({
    ...__getStateForTests(),
    nicotine: {
      products: withProduct ? [{ ...newNicotineProduct('cigarettes', 'c'), amount: 10 }] : [],
      settings,
      updatedAt: 1,
    },
  });
}
beforeEach(() => setLocale('en'));
afterEach(() => {
  cleanup();
  __replaceStateForTests({ ...__getStateForTests(), nicotine: emptyNicotineState() });
});

describe('NicotineTrendNote', () => {
  it('shows when effects are active and the Trends switch is on', () => {
    seed();
    render(<NicotineTrendNote />);
    expect(screen.getByText(NOTE)).toBeTruthy();
  });
  it('is hidden with the Trends switch off', () => {
    seed({}, false);
    const { container } = render(<NicotineTrendNote />);
    expect(container.firstChild).toBeNull();
  });
  it('is hidden with the master switch off or with no product', () => {
    seed({ useInCalculations: false });
    expect(render(<NicotineTrendNote />).container.firstChild).toBeNull();
    cleanup();
    seed({}, true, false);
    expect(render(<NicotineTrendNote />).container.firstChild).toBeNull();
  });
});

describe('NicotineTrendNote with alcohol', () => {
  const ALC_NOTE = 'Recovery figures include your alcohol use. Estimates.';
  const BOTH = 'Recovery figures include your nicotine and alcohol use. Estimates.';
  function seedAlc(trends = true, master = true) {
    const settings = defaultAlcoholSettings();
    settings.useInCalculations = master;
    settings.surfaces = { ...settings.surfaces, trends };
    __replaceStateForTests({
      ...__getStateForTests(),
      alcohol: {
        entries: [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: 4 }],
        checkins: {},
        settings,
        updatedAt: 1,
      },
    });
  }
  afterEach(() => {
    __replaceStateForTests({ ...__getStateForTests(), alcohol: emptyAlcoholState() });
  });

  it('names alcohol alone, or both when nicotine is active too', () => {
    seedAlc();
    render(<NicotineTrendNote />);
    expect(screen.getByText(ALC_NOTE)).toBeTruthy();
    cleanup();
    seed();
    render(<NicotineTrendNote />);
    expect(screen.getByText(BOTH)).toBeTruthy();
  });
  it('drops alcohol from the line with its Trends switch or master off', () => {
    seed();
    seedAlc(false);
    render(<NicotineTrendNote />);
    expect(screen.getByText('Recovery figures include your nicotine use. Estimates.')).toBeTruthy();
    cleanup();
    seedAlc(true, false);
    render(<NicotineTrendNote />);
    expect(screen.getByText('Recovery figures include your nicotine use. Estimates.')).toBeTruthy();
  });
  it('is hidden when neither is active', () => {
    seedAlc(false);
    expect(render(<NicotineTrendNote />).container.firstChild).toBeNull();
  });
});
