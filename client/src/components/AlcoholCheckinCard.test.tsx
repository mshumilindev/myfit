import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AlcoholCheckinCard } from './AlcoholCheckinCard';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { defaultAlcoholSettings, emptyAlcoholState, newAlcoholEntry } from '../alcohol';
import { setLocale } from '../i18n';

/** Saturday 3 Oct 2026, 10:00 (local): the Friday before is the pending day. */
const SAT_MORNING = new Date(2026, 9, 3, 10).getTime();

function seed(usualDays: number[] = [4], master = true, checkins = {}, checkinsOn = true) {
  const settings = defaultAlcoholSettings();
  settings.useInCalculations = master;
  settings.usualDays = usualDays;
  settings.checkinsOn = checkinsOn;
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

beforeEach(() => {
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAT_MORNING);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __replaceStateForTests({ ...__getStateForTests(), alcohol: emptyAlcoholState() });
});

const checkins = () => __getStateForTests().alcohol.checkins ?? {};

describe('AlcoholCheckinCard', () => {
  it('asks about the pending usual day with the three answers and "Not now"', () => {
    seed();
    render(<AlcoholCheckinCard />);
    expect(screen.getByText('Did you have a drink on Friday?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Usual \(≈ \d+(\.\d)? g\)$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Different amount' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('"No" saves the answer and the card goes away', () => {
    seed();
    render(<AlcoholCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(checkins()['2026-10-02']).toEqual({ drank: false });
    expect(screen.queryByTestId('alc-checkin')).toBeNull();
  });

  it('"Usual" saves the usual grams', () => {
    seed();
    render(<AlcoholCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: /^Usual/ }));
    const c = checkins()['2026-10-02'];
    expect(c?.drank).toBe(true);
    expect(c?.grams).toBeGreaterThan(0);
    expect(screen.queryByTestId('alc-checkin')).toBeNull();
  });

  it('"Different amount" opens a sheet; Save stays disabled until the amount changes', () => {
    seed();
    render(<AlcoholCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Different amount' }));
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /increase|plus|\+/i })[0]);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const c = checkins()['2026-10-02'];
    expect(c?.drank).toBe(true);
    expect(screen.queryByTestId('alc-checkin')).toBeNull();
  });

  it('"Not now" hides it for the day without answering', () => {
    seed();
    const { unmount } = render(<AlcoholCheckinCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('alc-checkin')).toBeNull();
    expect(checkins()['2026-10-02']).toBeUndefined();
    unmount();
    render(<AlcoholCheckinCard />);
    expect(screen.queryByTestId('alc-checkin')).toBeNull();
    // The next day it is back (Friday is still within 3 days).
    cleanup();
    vi.setSystemTime(SAT_MORNING + 24 * 3600 * 1000);
    render(<AlcoholCheckinCard />);
    expect(screen.queryByTestId('alc-checkin')).toBeTruthy();
  });

  it('is hidden while "Ask me on Today" is off and appears once it is on', () => {
    seed([4], true, {}, false);
    const a = render(<AlcoholCheckinCard />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    seed([4], true, {}, true);
    render(<AlcoholCheckinCard />);
    expect(screen.getByTestId('alc-checkin')).toBeTruthy();
  });

  it('shows nothing without usual days, with the master switch off, or when answered', () => {
    seed([]);
    const a = render(<AlcoholCheckinCard />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    seed([4], false);
    const b = render(<AlcoholCheckinCard />);
    expect(b.container.firstChild).toBeNull();
    b.unmount();
    seed([4], true, { '2026-10-02': { drank: false } });
    const c = render(<AlcoholCheckinCard />);
    expect(c.container.firstChild).toBeNull();
  });

  it('asks about today only after 21:00', () => {
    seed([5]); // Saturday
    const a = render(<AlcoholCheckinCard />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    vi.setSystemTime(new Date(2026, 9, 3, 21, 30).getTime());
    seed([5]);
    render(<AlcoholCheckinCard />);
    expect(screen.getByText('Did you have a drink on Saturday?')).toBeTruthy();
  });
});
