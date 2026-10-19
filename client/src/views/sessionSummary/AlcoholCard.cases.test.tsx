import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import {
  ALCOHOL_SOURCES,
  ALCOHOL_SURFACES,
  defaultAlcoholSettings,
  newAlcoholEntry,
} from '../../alcohol';
import type { Workout } from '../../types';
import { emptyState, freezeClock, seed } from '../__fixtures__/viewKit';
import { AlcoholCard, AlcoholHowSheet } from './AlcoholCard';

const SAT_EVENING = new Date(2026, 9, 3, 18).getTime();
const wo = {
  id: 'w',
  startedAt: SAT_EVENING,
  finishedAt: SAT_EVENING + 3600_000,
  autoFinished: false,
  exercises: [],
} as unknown as Workout;

function hold(servings: number) {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = true;
  for (const s of ALCOHOL_SURFACES) settings.surfaces[s] = true;
  settings.usualDays = [4];
  seed({
    ...emptyState(),
    alcohol: {
      entries:
        servings > 0
          ? [{ ...newAlcoholEntry('beerRegular', 'b', 500), servingsPerWeek: servings }]
          : [],
      checkins: {},
      settings,
      updatedAt: 1,
    },
  });
}

beforeEach(() => {
  freezeClock(SAT_EVENING + 1800_000);
  setLocale('en');
});
afterEach(cleanup);

describe('AlcoholHowSheet', () => {
  it('with nothing saved the summary row invites adding what is drunk, and there is no settings button without a link', () => {
    hold(0);
    render(<AlcoholHowSheet onClose={() => undefined} />);
    expect(screen.getByText(en.alcRowEmpty)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Use in calculations/ })).toBeNull();
  });

  it('lists every source and marks the unverified one as approximate', () => {
    hold(6);
    render(<AlcoholHowSheet onClose={() => undefined} onOpenSettings={() => undefined} />);
    for (const src of ALCOHOL_SOURCES)
      expect(
        screen.getByText(src.approx ? `${src.cite} (${en.nicSrcApprox})` : src.cite),
      ).toBeTruthy();
    expect(ALCOHOL_SOURCES.some((s) => s.approx)).toBe(true);
  });

  it('closes with Escape', async () => {
    hold(6);
    const onClose = vi.fn();
    render(<AlcoholHowSheet onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('AlcoholCard: the "How is this estimated?" sheet', () => {
  const open = () =>
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(en.nicFxHow.replace('?', '\\?')) }),
    );

  it('without a link the sheet has no settings button and Escape closes it', async () => {
    hold(6);
    render(<AlcoholCard workout={wo} />);
    open();
    expect(screen.getByText(en.alcoholDisclaimer)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Use in calculations/ })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByText(en.alcoholDisclaimer)).toBeNull());
  });

  it('with a link, its button closes the sheet and then opens the settings', async () => {
    hold(6);
    const settings = vi.fn();
    render(<AlcoholCard workout={wo} onOpenSettings={settings} />);
    open();
    await act(
      async () => void fireEvent.click(screen.getByRole('button', { name: /Use in calculations/ })),
    );
    expect(settings).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByText(en.alcoholDisclaimer)).toBeNull());
  });
});
