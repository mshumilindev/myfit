import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LogActivityView } from './LogActivityView';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { pinsPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import type { Shell } from '../App';
import type { Activity } from '../types';

const MIN = 60_000;
// Saturday 27 Sep 2025, 18:40 local — the design's "now".
const NOW = new Date(2025, 8, 27, 18, 40).getTime();
let seq = 0;

function act0(
  type: string,
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  min: number,
): Activity {
  seq += 1;
  const start = new Date(y, m - 1, d, hh, mm).getTime();
  return {
    id: `t${seq}`,
    type,
    category: type === 'sauna' ? 'recovery' : 'conditioning',
    startedAt: start,
    finishedAt: start + min * MIN,
    durationMin: min,
    effort: 'moderate',
  };
}

function history(): Activity[] {
  return [
    act0('dance', 2025, 8, 30, 18, 30, 110),
    act0('sauna', 2025, 8, 30, 20, 50, 20),
    act0('dance', 2025, 9, 6, 18, 30, 130),
    act0('dance', 2025, 9, 13, 18, 30, 115),
    act0('sauna', 2025, 9, 13, 20, 50, 20),
    act0('dance', 2025, 9, 20, 18, 30, 125),
    act0('sauna', 2025, 9, 20, 20, 50, 20),
    act0('tennis', 2025, 9, 17, 18, 0, 60),
    act0('run', 2025, 9, 25, 7, 30, 30),
  ].sort((a, b) => b.startedAt - a.startedAt);
}

function seed(activities: Activity[]): void {
  __replaceStateForTests({ ...__getStateForTests(), activities, workouts: [], sleeps: [] });
}

function shellMock(): Shell {
  return {
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    goPlaybook: vi.fn(),
    openStart: vi.fn(),
    toast: vi.fn(),
    snack: vi.fn(),
    signOut: vi.fn(),
    queueLength: 0,
  };
}

function setDesktop(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('min-width'),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  pinsPref.reset();
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LogActivityView (mobile)', () => {
  it('m01: likely-now hero, suggestions, pinned and categories', () => {
    seed(history());
    pinsPref.set(['run', 'dance', 'sauna']);
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Dance?')).toBeTruthy();
    expect(screen.getByText('The last 4 Saturdays, ~2 h')).toBeTruthy();
    expect(screen.getByText('Likely now · Saturday evening')).toBeTruthy();
    expect(screen.getByText('Also on your Saturdays')).toBeTruthy();
    expect(screen.getByText('After Dance · 3 of 4')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search activities')).toBeTruthy();
    // Owner: no "+ Pin" card on mobile; pinned cards wrap instead of scrolling.
    expect(screen.queryByLabelText('Pin an activity')).toBeNull();
    expect(document.querySelector('.la-row-wrap')).toBeTruthy();
    expect(screen.getByLabelText(/^Conditioning, 13 types/)).toBeTruthy();
    expect(screen.getByLabelText(/^Sports, 16 types, last: Tennis/)).toBeTruthy();
    expect(screen.getByLabelText(/^Recovery, 5 types/)).toBeTruthy();
  });

  it('m06: one-tap Log from the hero → toast with Undo, Today strip, up-next hero', () => {
    seed(history());
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    fireEvent.click(screen.getByText('Log 2 h'));
    const logged = __getStateForTests().activities.find((a) => a.startedAt === NOW - 120 * MIN);
    expect(logged?.type).toBe('dance');
    expect(screen.getByText('Dance · 120 min logged')).toBeTruthy();
    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('Up next · after Dance')).toBeTruthy();
    expect(screen.getByText('Sauna 20 min?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Undo logging Dance'));
    expect(__getStateForTests().activities.find((a) => a.id === logged?.id)).toBeUndefined();
  });

  it('m05: search with highlight, synonym badge and Other-sport fallback', () => {
    seed(history());
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText('Search activities'), { target: { value: 'bo' } });
    expect(screen.getByText('3 matches')).toBeTruthy();
    expect(screen.getByLabelText(/^Boxing, Sports/)).toBeTruthy();
    expect(screen.getByLabelText(/^Snowboard, Sports/)).toBeTruthy();
    expect(screen.getByLabelText(/^Climbing gym, Bouldering, Sports/)).toBeTruthy();
    expect(screen.getByLabelText('Log “bo” as Other sport')).toBeTruthy();
    expect(screen.queryByText('Dance?')).toBeNull();
  });

  it('m03: quick-log a type from the category page', () => {
    seed(history());
    render(<LogActivityView shell={shellMock()} cat="sport" onClose={() => undefined} />);
    expect(screen.getByText('All sports')).toBeTruthy();
    expect(screen.getByText('Recent in Sports')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Pin Badminton'));
    expect(pinsPref.get()).toEqual(['badminton']);
    fireEvent.click(screen.getAllByLabelText(/^Tennis, 60 min/)[0]);
    expect(screen.getByText('Duration · min')).toBeTruthy();
    expect(screen.getByText('Adds conditioning load')).toBeTruthy();
    fireEvent.click(screen.getByText('Log it · 60 min'));
    const last = __getStateForTests().activities.find((a) => a.startedAt === NOW - 60 * MIN);
    expect(last?.type).toBe('tennis');
    expect(last?.durationMin).toBe(60);
  });

  it('m04: pick-a-day calendar disables future days and logs in the past', () => {
    seed(history());
    render(<LogActivityView shell={shellMock()} cat="conditioning" onClose={() => undefined} />);
    fireEvent.click(screen.getAllByLabelText(/^Run, 30 min/)[0]);
    fireEvent.click(screen.getByText('Pick a day'));
    expect((screen.getByLabelText('Sunday Sep 28') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Thursday Sep 25, has conditioning activity'));
    fireEvent.click(screen.getByText('Log it · 30 min'));
    const run = __getStateForTests()
      .activities.filter((a) => a.type === 'run')
      .sort((a, b) => b.startedAt - a.startedAt)[0];
    expect(new Date(run.startedAt).getDate()).toBe(25);
    expect(run.id.startsWith('t')).toBe(false);
  });

  it('m07: live activity → resume banner, starting locked, past logs allowed', () => {
    const live: Activity = {
      id: 'live',
      type: 'dance',
      category: 'conditioning',
      startedAt: NOW - 42 * MIN,
      finishedAt: null,
      durationMin: 0,
      runningSince: NOW - 42 * MIN,
      accumulatedMs: 0,
    };
    seed([live, ...history()]);
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Finish Dance first')).toBeTruthy();
    expect(screen.getByText('Resume')).toBeTruthy();
    expect(screen.getByText('After Dance, usually')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByText('Finish'));
    });
    const done = __getStateForTests().activities.find((a) => a.id === 'live');
    expect(done?.finishedAt).not.toBeNull();
  });

  it('m08: first time → friendly hero, starters, pin hint', () => {
    seed([]);
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Log anything you do outside the gym')).toBeTruthy();
    expect(screen.getByText('Popular to start')).toBeTruthy();
    expect(screen.getByLabelText('Run, quick log')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('to pin the ones you do often');
  });
});

describe('LogActivityView (web)', () => {
  it('w01/w02: empty Quick log panel, then the filled one', () => {
    setDesktop(true);
    seed(history());
    pinsPref.set(['run', 'dance', 'sauna']);
    render(<LogActivityView shell={shellMock()} onClose={() => undefined} />);
    expect(screen.getByText('Pick an activity')).toBeTruthy();
    expect(screen.getByLabelText('Pinned activities, drag to reorder')).toBeTruthy();
    expect(screen.getByText('Or pick a category')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Run, pinned/));
    expect(screen.getByText('Pinned to top of Log activity')).toBeTruthy();
    expect(screen.getByLabelText('Close quick log')).toBeTruthy();
  });

  it('w03: category page with the 5-column grid and pin feedback', () => {
    setDesktop(true);
    seed(history());
    render(<LogActivityView shell={shellMock()} cat="sport" onClose={() => undefined} />);
    expect(screen.getByText('Your sports first')).toBeTruthy();
    expect(screen.getByText('All sports · A–Z')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Pin Tennis'));
    expect(screen.getByText('Tennis pinned — now 1st in your Pinned row')).toBeTruthy();
  });
});
