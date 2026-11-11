import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RestPeriod } from '../types';
import type { PlannerPrefs } from './types';

const state = vi.hoisted(() => ({
  prefs: {
    updatedAt: 0,
    availability: {
      0: [
        [360, 480],
        [1080, 1260],
      ],
      5: [[540, 780]],
    },
    shareAvailability: false,
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  } as unknown as PlannerPrefs,
  periods: [] as RestPeriod[],
  shown: (() => true) as (m: string) => boolean,
  saved: [] as PlannerPrefs[],
}));
vi.mock('./sync', () => ({
  usePrefs: () => state.prefs,
  savePrefs: (p: PlannerPrefs) => {
    state.saved.push(p);
    return Promise.resolve();
  },
}));
vi.mock('../store', () => ({ useStore: () => ({ restPeriods: state.periods }) }));
vi.mock('../healthAddons', () => ({ restPeriodShown: (m: string) => state.shown(m) }));

import { AvailabilityPage } from './AvailabilityPage';

const lastSaved = () => state.saved[state.saved.length - 1];
const today = Math.floor(Date.now() / 86_400_000);
const period = (over: Partial<RestPeriod>): RestPeriod => ({
  id: 'p',
  startDay: today - 1,
  endDay: today + 2,
  mode: 'illness',
  createdAt: 0,
  ...over,
});

beforeEach(() => {
  state.saved = [];
  state.periods = [];
  state.shown = () => true;
});
afterEach(cleanup);

describe('AvailabilityPage', () => {
  it("lists the week with each day's hours", () => {
    render(<AvailabilityPage onBack={() => {}} />);
    expect(screen.getByText('06:00–08:00 · 18:00–21:00')).toBeTruthy();
    expect(screen.getByText('09:00–13:00')).toBeTruthy();
    expect(screen.getAllByText('Not free').length).toBe(5);
  });

  it('shows Health overrides read-only, and none without Health', () => {
    state.periods = [
      period({}),
      period({ id: 'r', mode: 'off', startDay: today + 5, endDay: today + 6 }),
    ];
    const { unmount } = render(<AvailabilityPage onBack={() => {}} />);
    expect(screen.getByText('Unwell')).toBeTruthy();
    expect(screen.getByText('Full rest')).toBeTruthy();
    expect(screen.getByText(/active now/)).toBeTruthy();
    unmount();
    state.shown = () => false;
    render(<AvailabilityPage onBack={() => {}} />);
    expect(screen.queryByText('Overriding your hours')).toBeNull();
    expect(screen.queryByText('Unwell')).toBeNull();
  });

  it('the sharing switch only records the wish', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Show free hours to my trainer' }));
    expect(lastSaved().shareAvailability).toBe(true);
  });

  it('Clear all asks first, and clears only after the confirmation', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(state.saved).toHaveLength(0);
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByText('Reset'));
    expect(lastSaved().availability).toEqual({});
  });

  it('Cancel on the prompt keeps the hours', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Clear all'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByText('Cancel'));
    expect(state.saved).toHaveLength(0);
  });

  it('opens a day, removes a range only after the prompt, and applies it to weekdays', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    expect(screen.getAllByText('From')).toHaveLength(2);
    expect(screen.getAllByText('To')).toHaveLength(2);
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    fireEvent.click(screen.getAllByText('Remove these hours')[0]);
    expect(state.saved).toHaveLength(0);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove these hours' }),
    );
    fireEvent.click(screen.getByText('Only Monday'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(lastSaved().availability[0]).toEqual([[1080, 1260]]);
  });

  it('a new range asks From, then straight away To, with minutes', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByText('Add hours'));
    expect(screen.getByRole('heading', { name: 'From' })).toBeTruthy();
    expect(screen.getByText('Minutes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'To' })).toBeTruthy();
    expect(state.saved).toHaveLength(0);
    // the sheet's Save is the last one in the page (it is a portal); then the page's own Save writes
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);
    expect(state.saved).toHaveLength(0);
    fireEvent.click(screen.getByText('Only Monday'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(lastSaved().availability[0]).toEqual([
      [360, 480],
      [1080, 1260],
      [1320, 1380],
    ]);
  });

  it('"Weekends" copies the day onto Sat-Sun only', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByText('Weekends'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const a = lastSaved().availability;
    for (const d of [5, 6])
      expect(a[d]).toEqual([
        [360, 480],
        [1080, 1260],
      ]);
    expect(a[1]).toBeUndefined();
  });

  it('"Weekdays" copies the day onto Mon-Fri and leaves the weekend', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByText('Weekdays'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const a = lastSaved().availability;
    for (const d of [0, 1, 2, 3, 4])
      expect(a[d]).toEqual([
        [360, 480],
        [1080, 1260],
      ]);
    expect(a[5]).toEqual([[540, 780]]);
  });

  it('nothing is written until Save; with no change Save only explains itself (SaveGuide)', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    const save = () => screen.getByRole('button', { name: 'Save' });
    expect(save().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(save());
    expect(screen.getAllByText('Add hours').length).toBeGreaterThan(1);
    expect(state.saved).toHaveLength(0);
    fireEvent.click(screen.getByText('Weekdays'));
    expect(state.saved).toHaveLength(0);
    expect(save().getAttribute('aria-disabled')).not.toBe('true');
  });

  it('Back with no changes goes straight to the week', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Weekly hours')).toBeTruthy();
  });

  it('Cancel with changes asks first; Discard drops them, Keep editing stays', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByText('Every day'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByText('Keep editing'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByText('Discard'));
    expect(screen.getByText('Weekly hours')).toBeTruthy();
    expect(state.saved).toHaveLength(0);
  });

  it('the ‹ Back button asks too when something changed', () => {
    render(<AvailabilityPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('Monday'));
    fireEvent.click(screen.getByText('Weekdays'));
    fireEvent.click(screen.getAllByRole('button', { name: /back/i })[0]);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });
});
