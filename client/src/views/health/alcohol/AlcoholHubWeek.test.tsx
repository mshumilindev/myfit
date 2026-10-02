import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AlcoholHubView } from './AlcoholHubView';
import { __getStateForTests, __replaceStateForTests } from '../../../store';
import { setLocale } from '../../../i18n';
import { defaultAlcoholSettings, emptyAlcoholState, newAlcoholEntry } from '../../../alcohol';
import type { AlcoholCheckin } from '../../../types';

// Wednesday 7 Oct 2026; the week (Monday start) began on 5 Oct.
const WED = new Date(2026, 9, 7, 12).getTime();

function seed(checkins: Record<string, AlcoholCheckin>) {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = true;
  settings.usualDays = [0, 2];
  __replaceStateForTests({
    ...__getStateForTests(),
    alcohol: {
      entries: [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: 4 }],
      checkins,
      settings,
      updatedAt: 1,
    },
  });
}
const mount = () => render(<AlcoholHubView onOpen={() => undefined} onBack={() => undefined} />);

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WED);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __replaceStateForTests({ ...__getStateForTests(), alcohol: emptyAlcoholState() });
});

describe('Alcohol hub: this week so far', () => {
  it("shows the sum of this week's answers once any check-in exists", () => {
    seed({
      '2026-10-05': { drank: true, grams: 40 },
      '2026-09-30': { drank: true, grams: 90 }, // last week: not counted
    });
    mount();
    expect(screen.getByText('This week so far ≈ 40 g (from your answers)')).toBeTruthy();
  });
  it('shows 0 g when the answers this week were all "no"', () => {
    seed({ '2026-10-05': { drank: false } });
    mount();
    expect(screen.getByText('This week so far ≈ 0 g (from your answers)')).toBeTruthy();
  });
  it('is not shown with no check-ins at all', () => {
    seed({});
    mount();
    expect(screen.queryByText(/This week so far/)).toBeNull();
  });
});
