import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HistorySection } from './HistoryCalendar';
import { CORE_DEFAULTS, type HistoryOpts } from './layout';
import { useStore } from '../store';
import { setLocale } from '../i18n';
import { setProgramMemory } from '../data/programMemory';
import {
  NOW,
  PROGRAM,
  makeShell,
  richState,
  emptyState,
  seed,
  restWeek,
  knee,
} from './__fixtures__/widgetHarness';

const shell = makeShell();
const onLogFor = vi.fn();
const openMuscle = vi.fn();

function Host({ opts, wide = false }: { opts: HistoryOpts; wide?: boolean }) {
  const store = useStore();
  void wide;
  return (
    <HistorySection
      opts={opts}
      timeline={<div>timeline-view</div>}
      store={store}
      shell={shell}
      bodyKg={85}
      openMuscleHistory={openMuscle}
      onLogFor={onLogFor}
    />
  );
}

const cal: HistoryOpts = { ...CORE_DEFAULTS.history, view: 'calendar' };

function mockMedia(matches: boolean) {
  window.matchMedia = ((q: string) => ({
    matches,
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
  setLocale('en');
  mockMedia(false);
  seed(richState());
  setProgramMemory(PROGRAM);
  shell.calls.openOverlay?.mockClear();
  onLogFor.mockClear();
});
afterEach(() => {
  setProgramMemory(null);
  cleanup();
  vi.useRealTimers();
});

describe('History section — view toggle', () => {
  it('opens on the timeline by default and swaps to the calendar and back', () => {
    render(<Host opts={CORE_DEFAULTS.history} />);
    expect(screen.getByText('timeline-view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.queryByText('timeline-view')).toBeNull();
    expect(screen.getByText('September 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByText('timeline-view')).toBeTruthy();
  });

  it('follows a changed default view from the settings', () => {
    const { rerender } = render(<Host opts={CORE_DEFAULTS.history} />);
    expect(screen.getByText('timeline-view')).toBeTruthy();
    rerender(<Host opts={cal} />);
    expect(screen.queryByText('timeline-view')).toBeNull();
    expect(screen.getByText('September 2026')).toBeTruthy();
  });

  it('shows the settings button only on a wide screen and opens the History config sheet', () => {
    const { unmount } = render(<Host opts={CORE_DEFAULTS.history} />);
    expect(screen.queryByRole('button', { name: /settings/i })).toBeNull();
    unmount();
    mockMedia(true);
    render(<Host opts={CORE_DEFAULTS.history} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByText('Days shown')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Days shown')).toBeNull();
  });
});

describe('History calendar — month and summary', () => {
  it('names the month, counts what was logged this month and what is still planned', () => {
    render(<Host opts={cal} />);
    // 26 Sep: every day 1-26 carries something (sleep nights, sessions, activities, weigh-ins), so 26 days are
    // logged; the programme's training days after today are still planned.
    const sum = document.querySelector('.td-hcal-sum')!.textContent!;
    expect(sum).toBe('26 logged · 2 planned');
  });

  it('without planned days the summary has no "planned" part', () => {
    render(<Host opts={{ ...cal, planned: false }} />);
    expect(document.querySelector('.td-hcal-sum')!.textContent).not.toMatch(/planned/);
  });

  it('pages months with the arrows', () => {
    render(<Host opts={cal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('August 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('an empty log still draws the grid and says nothing is logged for the selected day', () => {
    seed(emptyState());
    render(<Host opts={cal} />);
    expect(document.querySelector('.td-hcal-sum')!.textContent).toBe('0 logged · 2 planned');
    expect(document.querySelector('.td-hcal-none')!.textContent).toBe('Nothing logged this day');
  });
});

describe('History calendar — selected day', () => {
  it('Open full history goes to the History screen', () => {
    render(<Host opts={cal} />);
    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'history' });
  });

  it('"Log" for a past day passes its ISO date; a future day offers no log button', () => {
    render(<Host opts={cal} />);
    const logBtn = () => document.querySelector<HTMLButtonElement>('.td-hcal-log');
    expect(logBtn()).toBeTruthy();
    fireEvent.click(logBtn()!);
    expect(onLogFor).toHaveBeenLastCalledWith('2026-09-26');
    const grid = document.querySelector('.td-hcal')!;
    const tomorrow = within(grid as HTMLElement)
      .getAllByRole('button')
      .find((b) => /^27\b/.test(b.textContent ?? ''));
    expect(tomorrow).toBeTruthy();
    fireEvent.click(tomorrow!);
    expect(logBtn()).toBeNull();
  });

  it('picking a day in another month switches the month', () => {
    render(<Host opts={cal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const grid = document.querySelector('.td-hcal')!;
    const btns = within(grid as HTMLElement)
      .getAllByRole('button')
      .filter((b) => /^(\d+)\b/.test(b.textContent ?? ''));
    expect(btns.length).toBeGreaterThan(27);
  });

  it('opens a logged session from the selected day card', () => {
    // Friday 25 Sep has a Pull session in the fixture.
    render(<Host opts={cal} />);
    const grid = document.querySelector('.td-hcal')!;
    const fri = within(grid as HTMLElement)
      .getAllByRole('button')
      .find((b) => /^25\b/.test(b.textContent ?? ''));
    fireEvent.click(fri!);
    const open = document.querySelector('.td-hcal-day button')!;
    expect(open).toBeTruthy();
  });

  it('labels days with their sessions, activities, weigh-ins and health state', () => {
    seed({ ...richState(), restPeriods: [{ ...restWeek, mode: 'illness' }], injuries: [knee] });
    render(<Host opts={cal} />);
    const label = (prefix: string) =>
      screen
        .getAllByRole('button')
        .find((b) => b.getAttribute('aria-label')?.startsWith(prefix))!
        .getAttribute('aria-label');
    expect(label('Friday, September 25')).toBe('Friday, September 25, Pull, Run 35 min');
    expect(label('Saturday, September 5')).toBe('Saturday, September 5, Rowing 25 min, 82.8 kg');
    expect(label('Wednesday, September 30')).toBe('Wednesday, September 30, Legs, Sick');
    expect(label('Tuesday, September 29')).toBe('Tuesday, September 29, Sick');
  });

  it('planned rest days outside the program week read "Rest"', () => {
    render(<Host opts={cal} />);
    const sun = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.startsWith('Sunday, September 27'))!;
    expect(sun.getAttribute('aria-label')).toBe('Sunday, September 27, Rest');
  });

  it('with planned days switched off the future has no plan', () => {
    render(<Host opts={{ ...cal, planned: false }} />);
    const sun = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.startsWith('Sunday, September 27'))!;
    expect(sun.getAttribute('aria-label')).toBe('Sunday, September 27');
  });
});

describe('History calendar — selected day card and wide layout', () => {
  const pickDay = (prefix: string) =>
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith(prefix))!,
    );

  it('rows of the selected day open the session, the activity and the night', () => {
    render(<Host opts={cal} />);
    pickDay('Friday, September 25');
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.td-hcal-day .hist-item'));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) fireEvent.click(r);
    const screens = (shell.calls.openOverlay.mock.calls as Array<[{ screen: string }]>).map(
      (c) => c[0].screen,
    );
    expect(screens).toEqual(expect.arrayContaining(['past-workout', 'activity', 'sleep']));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'sleep', mode: 'edit', nightId: expect.any(String) }),
    );
  });

  it('shows "day N of M" for a program day and the planned name for an empty planned day', () => {
    render(<Host opts={cal} />);
    pickDay('Friday, September 25');
    expect(document.querySelector('.hist-tl-aside')!.textContent).toBe('day 3 of 3');
    pickDay('Monday, September 28');
    expect(document.querySelector('.td-hcal-none')!.textContent).toMatch(/Push/);
  });

  it('a wide column gets big tiles, a Today button and the split footer; Today jumps back to this month', () => {
    const observers: Array<(es: unknown[]) => void> = [];
    class RO {
      constructor(cb: (es: unknown[]) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO);
    try {
      render(<Host opts={cal} />);
      expect(document.querySelector('.td-hcal')!.classList.contains('is-wide')).toBe(false);
      act(() => observers.forEach((cb) => cb([{ contentRect: { width: 900 } }])));
      const box = document.querySelector('.td-hcal')!;
      expect(box.classList.contains('is-wide')).toBe(true);
      expect(box.classList.contains('is-split')).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
      expect(screen.getByText('October 2026')).toBeTruthy();
      fireEvent.click(within(box as HTMLElement).getByRole('button', { name: 'Today' }));
      expect(screen.getByText('September 2026')).toBeTruthy();
      act(() => observers.forEach((cb) => cb([{ contentRect: { width: 800 } }])));
      expect(box.classList.contains('is-split')).toBe(false);
      expect(box.classList.contains('is-wide')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
