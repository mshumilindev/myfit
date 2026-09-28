import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionView } from '../SessionView';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { nextUpOffPref } from '../../activityPrefs';
import { setLocale } from '../../i18n';
import type { Shell } from '../../App';
import type { Activity, Exercise, Workout } from '../../types';
import { __resetNextUpForTests, markSummaryReturn } from './NextUp';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
// Sat 27 Sep 2025, 19:48 local — the workout just finished (design "finished 19:48").
const END = new Date(2025, 8, 27, 19, 48).getTime();
const START = END - 72 * MIN;
const NOW = END + 4 * MIN;

const ex = (muscle = 'chest'): Exercise => ({
  id: `e-${muscle}`,
  name: 'Bench Press',
  position: 0,
  primaryMuscle: muscle,
  sets: Array.from({ length: 3 }, (_, i) => ({
    id: `s${i}`,
    reps: 8,
    weight: 60,
    isWarmup: false,
    position: i,
  })),
});

/** History workout i (1 = most recent), 60 min long, i·3 days before. */
const past = (i: number): Workout => ({
  id: `w${i}`,
  startedAt: START - i * 3 * DAY,
  finishedAt: START - i * 3 * DAY + 60 * MIN,
  autoFinished: false,
  exercises: [ex()],
});
const current: Workout = {
  id: 'now',
  startedAt: START,
  finishedAt: END,
  autoFinished: false,
  exercises: [ex()],
};

let seq = 0;
const after = (w: Workout, type: string, minutes: number): Activity => {
  const startedAt = (w.finishedAt as number) + 10 * MIN;
  return {
    id: `a${++seq}`,
    type,
    category: type === 'walk' ? 'conditioning' : 'recovery',
    startedAt,
    finishedAt: startedAt + minutes * MIN,
    durationMin: minutes,
    effort: 'moderate',
  };
};

const history = Array.from({ length: 8 }, (_, k) => past(k + 1));
/** Sauna after 6 of the last 8 (w1–w6), walk after 4 (w5–w8), mobility after 3. */
function saunaHabit(): Activity[] {
  return [
    ...[18, 20, 22, 20, 19, 25].map((m, k) => after(history[k], 'sauna', m)),
    ...[10, 10, 10].map((m, k) => after(history[k + 2], 'mobility', m)),
    ...[20, 20, 20, 20].map((m, k) => after(history[k + 4], 'walk', m)),
  ];
}

function seed(workouts: Workout[], activities: Activity[]): void {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [current, ...workouts],
    activities: activities.sort((a, b) => b.startedAt - a.startedAt),
    sleeps: [],
  });
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

/** The session screen opened straight on its summary (as right after Finish). */
function renderSummary(shell = shellMock()) {
  markSummaryReturn('now');
  render(<SessionView workoutId="now" shell={shell} onClose={() => undefined} />);
  return shell;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  nextUpOffPref.reset();
  __resetNextUpForTests();
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Session summary · Next up (mobile)', () => {
  it('p01: pattern → the card with reason, strip, Start / Log and alternatives', () => {
    seed(history, saunaHabit());
    renderSummary();
    expect(screen.getByText('Done.')).toBeTruthy();
    expect(screen.getByText('Next up · while you’re warm')).toBeTruthy();
    expect(screen.getByText('Sauna · 20 min')).toBeTruthy();
    expect(screen.getByText('You hit the sauna after 6 of your last 8 sessions')).toBeTruthy();
    expect(screen.getByLabelText('Sauna after 6 of the last 8 sessions')).toBeTruthy();
    expect(screen.getByText('8 sessions ago')).toBeTruthy();
    expect(screen.getByText('usually 18–25 min · counts as recovery')).toBeTruthy();
    expect(screen.getByText('Start sauna')).toBeTruthy();
    expect(screen.getByLabelText('Log Sauna, 20 min, without a timer')).toBeTruthy();
    expect(screen.getByText('Or, also after lifting')).toBeTruthy();
    expect(screen.getByLabelText('Start Mobility, 10 min')).toBeTruthy();
    expect(screen.getByLabelText('Start Walk, 20 min')).toBeTruthy();
    expect(screen.queryByText('Anything after this?')).toBeNull();
    // Placed after the headline and before the stats.
    const card = screen.getByText('Sauna · 20 min').closest('section') as HTMLElement;
    const stats = document.querySelector('.stat-grid') as HTMLElement;
    expect(card.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('p02: Start → live timer, sticky banner, compact running card; Done still closes', () => {
    seed(history, saunaHabit());
    const onClose = vi.fn();
    markSummaryReturn('now');
    render(<SessionView workoutId="now" shell={shellMock()} onClose={onClose} />);
    act(() => {
      fireEvent.click(screen.getByText('Start sauna'));
    });
    const live = __getStateForTests().activities.find((a) => a.finishedAt === null);
    expect(live?.type).toBe('sauna');
    expect(screen.getByText('Sauna running — we’ll count it as recovery')).toBeTruthy();
    expect(screen.getByText('Timer keeps going after Done. Find it on Today.')).toBeTruthy();
    expect(screen.getByText(/^Recovery · since/)).toBeTruthy();
    expect(screen.getByText('of ~20 min')).toBeTruthy();
    expect(screen.getByText('Pause')).toBeTruthy();
    expect(screen.getByText('Sauna keeps timing if you leave')).toBeTruthy();
    expect(screen.queryByText('Start sauna')).toBeNull();
    act(() => {
      fireEvent.click(screen.getByText('Pause'));
    });
    expect(__getStateForTests().activities.find((a) => a.id === live?.id)?.runningSince).toBeNull();
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
    // The timer is untouched by leaving the summary.
    expect(__getStateForTests().activities.find((a) => a.id === live?.id)?.finishedAt).toBeNull();
  });

  it('p02: Finish from the banner saves it and shows the logged row with Undo', () => {
    seed(history, saunaHabit());
    renderSummary();
    act(() => {
      fireEvent.click(screen.getByText('Start sauna'));
    });
    act(() => {
      fireEvent.click(screen.getByText('Finish'));
    });
    const done = __getStateForTests().activities.find(
      (a) => a.type === 'sauna' && a.startedAt >= END,
    );
    expect(done?.finishedAt).not.toBeNull();
    expect(screen.getByText(/^Sauna · .* logged$/)).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByLabelText('Undo logging Sauna'));
    });
    expect(__getStateForTests().activities.find((a) => a.id === done?.id)).toBeUndefined();
    expect(screen.getByText('Start sauna')).toBeTruthy();
  });

  it('Log 20 min → logged from the workout finish, snackbar with Undo', () => {
    seed(history, saunaHabit());
    const shell = renderSummary();
    act(() => {
      fireEvent.click(screen.getByText('Log 20 min'));
    });
    const a = __getStateForTests().activities.find((x) => x.startedAt === END);
    expect(a?.type).toBe('sauna');
    expect(a?.finishedAt).toBe(END + 20 * MIN);
    expect(a?.durationMin).toBe(20);
    expect(shell.snack).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Sauna · 20 min logged' }),
    );
    expect(screen.getByText('Sauna · 20 min logged')).toBeTruthy();
  });

  it('p03: options — Not today hides it; Change to… opens Log activity', () => {
    seed(history, saunaHabit());
    const shell = renderSummary();
    fireEvent.click(screen.getByLabelText('More options for this suggestion'));
    expect(screen.getByText('Suggested after this workout')).toBeTruthy();
    expect(screen.getByText('Don’t suggest Sauna after workouts')).toBeTruthy();
    expect(screen.getByText('Walk and Mobility can still show up')).toBeTruthy();
    expect(screen.getByText('Suggestions come from your last 8 sessions.')).toBeTruthy();
    fireEvent.click(screen.getByText('Change to…'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
    fireEvent.click(screen.getByLabelText('More options for this suggestion'));
    act(() => {
      fireEvent.click(screen.getByText('Not today'));
    });
    expect(screen.queryByText('Sauna · 20 min')).toBeNull();
    expect(screen.getByText('Anything after this?')).toBeTruthy();
  });

  it('p03: Don’t suggest → added to nextUpOff with Undo; the next habit takes over', () => {
    seed(history, saunaHabit());
    const shell = renderSummary();
    fireEvent.click(screen.getByLabelText('More options for this suggestion'));
    act(() => {
      fireEvent.click(screen.getByText('Don’t suggest Sauna after workouts'));
    });
    expect(nextUpOffPref.get()).toEqual(['sauna']);
    expect(screen.queryByText('Sauna · 20 min')).toBeNull();
    expect(screen.getByText('Walk · 20 min')).toBeTruthy();
    const snack = vi.mocked(shell.snack).mock.calls[0][0];
    expect(snack.text).toBe('Sauna won’t be suggested after workouts');
    act(() => snack.onUndo());
    expect(nextUpOffPref.get()).toEqual([]);
    expect(screen.getByText('Sauna · 20 min')).toBeTruthy();
  });

  it('off → hidden (turned off earlier, no other habit) → the quiet row', () => {
    seed(
      history,
      [18, 20, 22, 20, 19, 25].map((m, k) => after(history[k], 'sauna', m)),
    );
    nextUpOffPref.set(['sauna']);
    renderSummary();
    expect(screen.queryByText('Sauna · 20 min')).toBeNull();
    expect(screen.getByText('Anything after this?')).toBeTruthy();
  });

  it('p04: no pattern → quiet row under the stats linking to Log activity', () => {
    seed(history.slice(0, 2), []);
    const shell = renderSummary();
    expect(screen.queryByText('Next up · while you’re warm')).toBeNull();
    const row = screen.getByText('Anything after this?');
    const stats = document.querySelector('.stat-grid') as HTMLElement;
    expect(stats.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText('Log activity'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
  });
});

describe('Session summary · Next up (web)', () => {
  it('p05: the Next up panel beside the summary with Today', () => {
    setDesktop(true);
    seed(history, saunaHabit());
    renderSummary();
    const panel = screen.getByRole('complementary', { name: 'Next up' });
    expect(panel.textContent).toContain('from your last 8 sessions');
    expect(panel.textContent).toContain('While you’re warm');
    expect(panel.textContent).toContain('Sauna · 20 min');
    expect(panel.textContent).toContain('Today');
    expect(screen.getByText('Log something else')).toBeTruthy();
    expect(document.querySelector('.screen.sum-web .sum-main .stat-grid')).toBeTruthy();
  });
});
