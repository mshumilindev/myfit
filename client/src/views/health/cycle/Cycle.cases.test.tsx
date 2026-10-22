import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { dayOfTimestamp, timestampOfDay } from '../../../components/ui/calendarDays';
import { cycEn as c } from '../../../i18n/cyc.en';
import { fmtShortDate, setLocale } from '../../../i18n';
import {
  __getStateForTests,
  __replaceStateForTests,
  addCondition,
  getCycle,
  resetLocalData,
  saveCycleSettings,
  setCycleSurface,
  updateCycleAnchor,
} from '../../../store';
import { MENOPAUSE_KEY } from '../../../cycle/cycleCore';
import type { Workout } from '../../../types';
import { CycleHubView } from './CycleHubView';
import { CyclePatternsView } from './CyclePatternsView';
import { CycleScreens } from './CycleScreens';
import { CycleHealthRow } from './CycleSection';
import { CycleSessionNote } from './CycleSessionNote';
import { CycleSetupView } from './CycleSetupView';

const NOW = new Date(2026, 8, 26, 12, 0).getTime();
const TODAY = dayOfTimestamp(NOW);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  resetLocalData();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const regular = (anchor = TODAY - 9, over = {}) =>
  saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor, ...over });
const step = (label: string, which: '+' | '−') => {
  const g = screen.getByRole('group', { name: label });
  fireEvent.click(within(g).getByLabelText(which));
};
const pickDay = (day: number) =>
  fireEvent.click(document.querySelector(`.uical-grid [data-day="${day}"]`) as HTMLElement);
const save = () => screen.getByRole('button', { name: c.cycSave }) as HTMLButtonElement;

describe('CycleSetupView: first run', () => {
  it('introduces itself and saves a regular 28/5 cycle starting today, then leaves', () => {
    const onBack = vi.fn();
    render(<CycleSetupView onBack={onBack} />);
    expect(screen.getByText(c.cycSetupIntro)).toBeTruthy();
    expect(screen.getByText(c.cycModeFootRegular)).toBeTruthy();
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(getCycle().enabled).toBe(true);
    expect(getCycle().settings).toEqual({ mode: 'regular', length: 28, period: 5, anchor: TODAY });
    expect(getCycle().starts).toEqual([TODAY]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has no "where to show" or delete rows before it is set up', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    expect(screen.queryByText(c.cycWhere)).toBeNull();
    expect(screen.queryByText(c.cycDelete)).toBeNull();
  });

  it('Cancel leaves without saving', () => {
    const onBack = vi.fn();
    render(<CycleSetupView onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: c.cycCancel }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(getCycle().enabled).toBe(false);
  });

  it('irregular mode adds the shortest and longest steppers (defaulting to the length) and saves them', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    expect(screen.queryByRole('group', { name: c.cycShortest })).toBeNull();
    fireEvent.click(screen.getByText(c.cycModeIrregular));
    expect(screen.getByText(c.cycModeFootIrregular)).toBeTruthy();
    const shortest = screen.getByRole('group', { name: c.cycShortest });
    expect((within(shortest).getByRole('textbox') as HTMLInputElement).value).toBe('28');
    step(c.cycShortest, '−');
    step(c.cycLongest, '+');
    fireEvent.click(save());
    expect(getCycle().settings).toMatchObject({ mode: 'irregular', length: 28, min: 27, max: 29 });
  });

  it('log-only mode explains itself', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(c.cycModeLog));
    expect(screen.getByText(c.cycModeFootLog)).toBeTruthy();
    fireEvent.click(save());
    expect(getCycle().settings?.mode).toBe('log');
  });

  it('length and period steppers move by one day and are saved', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    step(c.cycLength, '+');
    step(c.cycLength, '+');
    step(c.cycPeriod, '−');
    fireEvent.click(save());
    expect(getCycle().settings).toMatchObject({ length: 30, period: 4 });
  });

  it('the last start is chosen from a calendar that does not allow the future', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(c.cycLastStart));
    const future = document.querySelector(`[data-day="${TODAY + 1}"]`) as HTMLButtonElement | null;
    if (future) expect(future.disabled).toBe(true);
    pickDay(TODAY - 3);
    expect(document.querySelector('.uical-grid')).toBeNull();
    fireEvent.click(save());
    expect(getCycle().settings?.anchor).toBe(TODAY - 3);
  });

  it('values outside the usual range get a gentle notice', () => {
    render(<CycleSetupView onBack={() => undefined} />);
    expect(screen.queryByText(c.cycOutOfNorm)).toBeNull();
    for (let i = 0; i < 11; i++) step(c.cycLength, '+');
    expect(screen.getByText(c.cycOutOfNorm)).toBeTruthy();
  });
});

describe('CycleSetupView: settings of a set-up cycle', () => {
  it('Save stays disabled until something changed', () => {
    regular();
    render(<CycleSetupView onBack={() => undefined} />);
    expect(screen.queryByText(c.cycSetupIntro)).toBeNull();
    expect(save().disabled).toBe(true);
    step(c.cycPeriod, '+');
    expect(save().disabled).toBe(false);
    step(c.cycPeriod, '−');
    expect(save().disabled).toBe(true);
  });

  it('each place the cycle shows can be switched off and on', () => {
    regular();
    render(<CycleSetupView onBack={() => undefined} />);
    expect(getCycle().surfaces).toEqual({ today: true, calendar: true, session: true });
    fireEvent.click(screen.getByRole('switch', { name: c.cycSurfCalendar }));
    expect(getCycle().surfaces.calendar).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: c.cycSurfCalendar }));
    expect(getCycle().surfaces.calendar).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: c.cycSurfSession }));
    expect(getCycle().surfaces).toEqual({ today: true, calendar: true, session: false });
  });

  it('deleting asks first; cancel keeps the data, confirm wipes it and leaves', () => {
    regular();
    const onBack = vi.fn();
    render(<CycleSetupView onBack={onBack} />);
    fireEvent.click(screen.getByText(c.cycDelete));
    expect(screen.getByText(c.cycDeleteBody)).toBeTruthy();
    fireEvent.click(
      within(
        document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement,
      ).getByRole('button', { name: c.cycCancel }),
    );
    expect(getCycle().enabled).toBe(true);
    fireEvent.click(screen.getByText(c.cycDelete));
    fireEvent.click(screen.getByRole('button', { name: c.cycDeleteConfirm }));
    expect(getCycle().enabled).toBe(false);
    expect(getCycle().settings).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('CycleHubView', () => {
  const props = () => ({
    onBack: vi.fn(),
    onSettings: vi.fn(),
    onPatterns: vi.fn(),
    onOpenStates: vi.fn(),
  });

  it('regular: the day of the cycle, the phase, its hint and the range of the next start', () => {
    regular(TODAY - 9);
    render(<CycleHubView {...props()} />);
    expect(screen.getByText(c.cycDayOf(10, 28))).toBeTruthy();
    expect(screen.getByText(c.cycPhEarly, { selector: '.ut-lg' })).toBeTruthy();
    expect(screen.getByText(c.cycHintEarly)).toBeTruthy();
    expect(document.body.textContent).toMatch(/Next start: /);
    expect(screen.getByText(c.cycApprox)).toBeTruthy();
    // the legend names the four phases
    const legend = [c.cycPhMenses, c.cycPhEarly, c.cycPhMid, c.cycPhLate];
    legend.forEach((n) => expect(screen.getAllByText(n).length).toBeGreaterThan(0));
  });

  it('log only: the last start and no patterns row, one recorded-period legend', () => {
    saveCycleSettings({ mode: 'log', length: 28, period: 5, anchor: TODAY - 3 });
    render(<CycleHubView {...props()} />);
    expect(screen.getAllByText(c.cycLogHead).length).toBeGreaterThan(0);
    expect(screen.getByText(c.cycLogLast(fmtShortDate(timestampOfDay(TODAY - 3))))).toBeTruthy();
    expect(screen.getByText(c.cycLogNote)).toBeTruthy();
    expect(screen.queryByText(c.cycPatterns)).toBeNull();
    expect(screen.getByText(c.cycLegendLogged)).toBeTruthy();
    expect(screen.queryByText(c.cycDayOf(4, 28))).toBeNull();
  });

  it('rows lead to settings, patterns and back', () => {
    regular();
    const p = props();
    render(<CycleHubView {...p} />);
    fireEvent.click(screen.getByText(c.cycSettings));
    fireEvent.click(screen.getByText(c.cycPatterns));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(p.onSettings).toHaveBeenCalledTimes(1);
    expect(p.onPatterns).toHaveBeenCalledTimes(1);
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });

  it('a schedule more than two cycles old is stale: no estimate, no calendar, and a way to update the date', () => {
    regular(TODAY - 200);
    render(<CycleHubView {...props()} />);
    expect(screen.getByText(c.cycStale)).toBeTruthy();
    expect(screen.queryByText(c.cycCalendar)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.cycStaleBtn }));
    pickDay(TODAY - 2);
    fireEvent.click(screen.getByRole('button', { name: c.cycUpdateSave }));
    expect(getCycle().settings?.anchor).toBe(TODAY - 2);
    expect(getCycle().starts).toEqual([TODAY - 200, TODAY - 2]);
    expect(screen.queryByText(c.cycStale)).toBeNull();
    expect(screen.getByText(c.cycDayOf(3, 28))).toBeTruthy();
  });

  it('after a pause the hub asks for a new start date', () => {
    regular();
    act(() => {
      __replaceStateForTests({
        ...__getStateForTests(),
        cycle: { ...getCycle(), pendingDate: true },
      });
    });
    render(<CycleHubView {...props()} />);
    expect(screen.getByText(c.cycAfterPause)).toBeTruthy();
  });

  it('"Update start date" is always there; the sheet defaults to today', () => {
    regular();
    render(<CycleHubView {...props()} />);
    fireEvent.click(screen.getByText(c.cycUpdateDate));
    fireEvent.click(screen.getByRole('button', { name: c.cycUpdateSave }));
    expect(getCycle().settings?.anchor).toBe(TODAY);
  });

  it('pregnancy: the sheet shows the week, adds a private condition and the hub switches to "off"', () => {
    regular();
    const p = props();
    const { rerender } = render(<CycleHubView {...p} />);
    fireEvent.click(screen.getByText(c.cycMarkPreg));
    expect(screen.getByText(c.cycPregInfo(5))).toBeTruthy();
    pickDay(TODAY - 47);
    expect(screen.getByText(c.cycPregInfo(7))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: c.cycPregAdd }));
    rerender(<CycleHubView {...p} />);
    expect(screen.getByText(c.cycOffTitle)).toBeTruthy();
    expect(screen.getByText(c.cycOffPregnancy)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: c.cycOpenStates }));
    expect(p.onOpenStates).toHaveBeenCalledTimes(1);
    expect(__getStateForTests().conditions.at(-1)?.share).toBe('off');
  });

  it('menopause asks first; cancel keeps the cycle on', () => {
    regular();
    render(<CycleHubView {...props()} />);
    fireEvent.click(screen.getByText(c.cycMarkMeno));
    expect(screen.getByText(c.cycMenoBody)).toBeTruthy();
    fireEvent.click(
      within(
        document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement,
      ).getByRole('button', { name: c.cycCancel }),
    );
    expect(__getStateForTests().conditions).toHaveLength(0);
    expect(screen.queryByText(c.cycMenoBody)).toBeNull();
  });

  it('an existing menopause condition shows its own explanation', () => {
    regular();
    act(() => void addCondition({ key: MENOPAUSE_KEY, severity: 2, share: 'off' }));
    render(<CycleHubView {...props()} />);
    expect(screen.getByText(c.cycOffMenopause)).toBeTruthy();
  });
});

describe('sheets close with Escape', () => {
  it('the date, pregnancy and picker sheets leave nothing behind', async () => {
    regular();
    render(
      <CycleHubView
        onBack={() => undefined}
        onSettings={() => undefined}
        onPatterns={() => undefined}
        onOpenStates={() => undefined}
      />,
    );
    for (const label of [c.cycUpdateDate, c.cycMarkPreg]) {
      fireEvent.click(screen.getByText(label));
      expect(document.querySelector('.uical-grid')).not.toBeNull();
      fireEvent.keyDown(document, { key: 'Escape' });
      await vi.waitFor(() => expect(document.querySelector('.uical-grid')).toBeNull());
    }
    cleanup();
    render(<CycleSetupView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(c.cycLastStart));
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(document.querySelector('.uical-grid')).toBeNull());
  });
});

describe('CycleScreens routing', () => {
  const mount = (screen: 'hub' | 'settings' | 'patterns', onOpen = vi.fn(), onBack = vi.fn()) =>
    render(
      <CycleScreens
        screen={screen}
        onOpen={onOpen}
        onBack={onBack}
        onOpenStates={() => undefined}
      />,
    );

  it('settings and patterns go back to the hub, not out of the Cycle', () => {
    regular();
    const onOpen = vi.fn();
    const onBack = vi.fn();
    mount('settings', onOpen, onBack);
    fireEvent.click(screen.getByRole('button', { name: c.cycCancel }));
    expect(onOpen).toHaveBeenCalledWith('hub');
    expect(onBack).not.toHaveBeenCalled();
    cleanup();
    mount('patterns', onOpen, onBack);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onOpen).toHaveBeenLastCalledWith('hub');
  });

  it('the hub opens settings and patterns through the router', () => {
    regular();
    const onOpen = vi.fn();
    mount('hub', onOpen);
    fireEvent.click(screen.getByText(c.cycSettings));
    fireEvent.click(screen.getByText(c.cycPatterns));
    expect(onOpen.mock.calls).toEqual([['settings'], ['patterns']]);
  });

  it('a paused cycle shows the hub even when settings or patterns were asked for', () => {
    regular();
    act(() => void addCondition({ key: MENOPAUSE_KEY, severity: 2, share: 'off' }));
    mount('settings');
    expect(screen.getByText(c.cycOffTitle)).toBeTruthy();
    cleanup();
    mount('patterns');
    expect(screen.getByText(c.cycOffTitle)).toBeTruthy();
  });
});

describe('CycleHealthRow', () => {
  it('says what the cycle is doing today', () => {
    const open = vi.fn();
    regular(TODAY - 9);
    render(<CycleHealthRow onOpen={open} />);
    expect(screen.getByText(c.cycRowDay(10, c.cycPhEarly))).toBeTruthy();
    fireEvent.click(screen.getByText(c.cycTitle));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('log-only, stale and menopause rows', () => {
    saveCycleSettings({ mode: 'log', length: 28, period: 5, anchor: TODAY - 3 });
    const { unmount } = render(<CycleHealthRow onOpen={() => undefined} />);
    expect(screen.getByText(c.cycRowLog)).toBeTruthy();
    unmount();
    regular(TODAY - 200);
    const second = render(<CycleHealthRow onOpen={() => undefined} />);
    expect(screen.getByText(c.cycStaleBtn)).toBeTruthy();
    second.unmount();
    act(() => void addCondition({ key: MENOPAUSE_KEY, severity: 2, share: 'off' }));
    render(<CycleHealthRow onOpen={() => undefined} />);
    expect(screen.getByText(c.cycRowMenopause)).toBeTruthy();
  });
});

/** Four observed 28-day cycles; `lastBack` days ago the newest one started. Rated sets are put at the given offsets. */
function seedPatterns(lastBack: number, plan: Array<{ off: number; rpe: number[] }[]>) {
  const starts = [0, 1, 2, 3, 4].map((i) => TODAY - lastBack - 28 * (4 - i));
  regular(starts[0]);
  starts.slice(1).forEach((s) => updateCycleAnchor(s));
  const workouts: Workout[] = [];
  plan.forEach((sessions, k) =>
    sessions.forEach(({ off, rpe }, j) => {
      const at = timestampOfDay(starts[k] + off) + 12 * 3600_000;
      workouts.push({
        id: `w-${k}-${j}`,
        startedAt: at,
        finishedAt: at + 3600_000,
        exercises: [
          {
            id: `e-${k}-${j}`,
            name: 'Barbell Bench Press - Medium Grip',
            kind: 'strength',
            position: 0,
            sets: [
              { id: `warm-${k}-${j}`, reps: 10, weight: 20, isWarmup: true, rpe: 1 },
              ...rpe.map((r, i) => ({
                id: `s-${k}-${j}-${i}`,
                reps: 5,
                weight: 60,
                isWarmup: false,
                rpe: r,
              })),
              { id: `un-${k}-${j}`, reps: 5, weight: 60, isWarmup: false },
            ],
          },
        ],
      } as unknown as Workout);
    }),
  );
  act(() => __replaceStateForTests({ ...__getStateForTests(), workouts }));
}
// period (days 0-4) easy, late cycle (day 16+) hard, every cycle
const STEADY = [0, 1, 2, 3].map(() => [
  { off: 1, rpe: [6, 6] },
  { off: 20, rpe: [9, 9] },
]);

describe('CyclePatternsView', () => {
  it('says plainly how many cycles it has when there is not enough', () => {
    regular();
    updateCycleAnchor(TODAY - 2);
    render(<CyclePatternsView onBack={() => undefined} />);
    expect(screen.getByText(c.cycPatEmptyBody(0))).toBeTruthy();
  });

  it('a phase whose interval excludes zero is called higher or lower, with the signed difference and its interval', () => {
    seedPatterns(20, STEADY);
    render(<CyclePatternsView onBack={() => undefined} />);
    expect(screen.getByText(c.cycPatIntro)).toBeTruthy();
    expect(screen.getByText(c.cycPatLower)).toBeTruthy();
    expect(screen.getByText(c.cycPatHigher)).toBeTruthy();
    expect(screen.getByText(c.cycPatRow('-1.5', '-1.5', '-1.5'))).toBeTruthy();
    expect(screen.getByText(c.cycPatRow('+1.5', '+1.5', '+1.5'))).toBeTruthy();
    expect(screen.getAllByText(c.cycPatCycles(4))).toHaveLength(2);
    expect(screen.getByText(c.cycPatFoot)).toBeTruthy();
    // each verdict sits in the same card as its own signed difference
    const cardOf = (text: string) => screen.getByText(text).parentElement as HTMLElement;
    expect(cardOf(c.cycPatRow('-1.5', '-1.5', '-1.5')).textContent).toContain(c.cycPatLower);
    expect(cardOf(c.cycPatRow('+1.5', '+1.5', '+1.5')).textContent).toContain(c.cycPatHigher);
  });

  it('noise across cycles is reported as "cannot tell apart"', () => {
    seedPatterns(
      20,
      [9, 3, 9, 3].map((hard) => [
        { off: 1, rpe: [6, 6] },
        { off: 8, rpe: [hard, hard] },
        { off: 20, rpe: [6, 6] },
      ]),
    );
    render(<CyclePatternsView onBack={() => undefined} />);
    expect(screen.getAllByText(c.cycPatSame).length).toBeGreaterThan(0);
    expect(screen.queryByText(c.cycPatHigher)).toBeNull();
  });
});

describe('CycleSessionNote', () => {
  it('in a late phase with a proven pattern it reports the higher effort without changing anything', () => {
    seedPatterns(20, STEADY);
    render(<CycleSessionNote className="x" />);
    const note = screen.getByTestId('cycle-session-note');
    expect(note.textContent).toBe(c.cycSessionHigher('+1.5'));
    expect(note.className).toContain('x');
  });

  it('in the period phase it reports the lower effort', () => {
    seedPatterns(1, STEADY);
    render(<CycleSessionNote />);
    expect(screen.getByTestId('cycle-session-note').textContent).toBe(c.cycSessionLower('+1.5'));
  });

  it('is silent when its surface is off, in log-only mode, or when the pattern is not distinct', () => {
    seedPatterns(20, STEADY);
    act(() => setCycleSurface('session', false));
    const { container, unmount } = render(<CycleSessionNote />);
    expect(container.textContent).toBe('');
    unmount();
    act(() => setCycleSurface('session', true));
    seedPatterns(
      20,
      [9, 3, 9, 3].map((hard) => [
        { off: 1, rpe: [6, 6] },
        { off: 8, rpe: [hard, hard] },
        { off: 20, rpe: [6, 6] },
      ]),
    );
    const noisy = render(<CycleSessionNote />);
    expect(noisy.container.textContent).toBe('');
  });
});
