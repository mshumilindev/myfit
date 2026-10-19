import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { activityType, estimateCalories } from '../activities';
import { __getStateForTests } from '../store';
import type { Activity } from '../types';
import { DAY, emptyState, NOW, seed } from './__fixtures__/viewKit';
import { ActivityView } from './ActivityView';

const KG = 80;
const withWeight = (over: Record<string, unknown> = {}) => {
  const s = emptyState();
  seed({
    ...s,
    bodyMetrics: { ...s.bodyMetrics, weights: [{ id: 'w', at: NOW - DAY, weight: KG }] },
    ...over,
  } as never);
};
const logged = (over: Partial<Activity> = {}): Activity => ({
  id: 'a1',
  type: 'run',
  category: 'conditioning',
  startedAt: new Date(2026, 8, 25, 18, 30).getTime(),
  finishedAt: new Date(2026, 8, 25, 19, 15).getTime(),
  durationMin: 45,
  calories: null,
  distanceKm: 7.5,
  effort: 'hard',
  ...over,
});

const stubGeometry = () => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 1440,
    bottom: 10,
    width: 1440,
    height: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
};
const drag = (handle: string, toMinute: number) => {
  const h = screen.getByRole('slider', { name: handle });
  fireEvent.pointerDown(h, { pointerId: 1, clientX: 0 });
  fireEvent.pointerMove(document.querySelector('.tlr-track')!, { pointerId: 1, clientX: toMinute });
  fireEvent.pointerUp(document.querySelector('.tlr-track')!, { pointerId: 1 });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setLocale('en');
  localStorage.clear();
  withWeight();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ActivityView: routing', () => {
  it('an unknown or missing type closes the page at once', () => {
    const onClose = vi.fn();
    render(<ActivityView newType="nonsense" onClose={onClose} />);
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    const again = vi.fn();
    render(<ActivityView onClose={again} />);
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('editing something that is not a finished activity closes at once', () => {
    seed({ ...emptyState(), activities: [logged({ id: 'live', finishedAt: null })] } as never);
    const onClose = vi.fn();
    render(<ActivityView editId="live" onClose={onClose} />);
    expect(onClose).toHaveBeenCalled();
    cleanup();
    const gone = vi.fn();
    render(<ActivityView editId="missing" onClose={gone} />);
    expect(gone).toHaveBeenCalled();
  });

  it('a running activity wins over the type being asked for', () => {
    seed({
      ...emptyState(),
      activities: [
        logged({
          id: 'live',
          finishedAt: null,
          runningSince: NOW,
          accumulatedMs: 0,
          durationMin: 0,
        }),
      ],
    } as never);
    render(<ActivityView newType="yoga" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: en.actFinish })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.actStart })).toBeNull();
  });
});

describe('ActivityView: starting a new activity', () => {
  it('names the type and what it counts as, and explains the timer', () => {
    render(<ActivityView newType="run" onClose={vi.fn()} />);
    expect(screen.getByText(en.actType.run)).toBeTruthy();
    expect(screen.getByText(en.actAddsConditioning)).toBeTruthy();
    expect(screen.getByText(en.actReadyCap)).toBeTruthy();
  });

  it('a recovery activity counts as recovery', () => {
    render(<ActivityView newType="yoga" onClose={vi.fn()} />);
    expect(screen.getByText(en.actCountsRecovery)).toBeTruthy();
    expect(screen.queryByText(en.actAddsConditioning)).toBeNull();
  });

  it('Start creates the live activity and flips the page into the running timer', () => {
    render(<ActivityView newType="run" onClose={vi.fn()} />);
    expect(__getStateForTests().activities).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: en.actStart }));
    const [a] = __getStateForTests().activities;
    expect(a).toMatchObject({
      type: 'run',
      category: 'conditioning',
      finishedAt: null,
      effort: 'moderate',
    });
    expect(screen.getByRole('button', { name: en.actPause })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.actStart })).toBeNull();
  });

  it('Back closes without logging anything', () => {
    const onClose = vi.fn();
    render(<ActivityView newType="run" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
    expect(__getStateForTests().activities).toHaveLength(0);
  });
});

describe('ActivityView: logging a past activity', () => {
  const past = (key = 'run') => {
    const onClose = vi.fn();
    const out = render(<ActivityView newType={key} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: en.actLogPast }));
    return { ...out, onClose };
  };
  const save = () => fireEvent.click(screen.getByRole('button', { name: en.actSave }));
  const kcalText = () => document.querySelector('.act-kcal .tnum')?.textContent;

  it('defaults to today 00:00 for 12 hours and shows the estimate for moderate effort', () => {
    past();
    expect(document.querySelector('.tlr-start')?.textContent).toBe('00:00');
    expect(document.querySelector('.tlr-end')?.textContent).toBe('12:00');
    expect(kcalText()).toBe(`~${estimateCalories(activityType('run')!, 720, KG, 'moderate')}`);
  });

  it('changing the effort changes the estimate', () => {
    past();
    const moderate = kcalText();
    fireEvent.click(screen.getByRole('button', { name: en.actEffortLevel.hard }));
    expect(kcalText()).toBe(`~${estimateCalories(activityType('run')!, 720, KG, 'hard')}`);
    expect(kcalText()).not.toBe(moderate);
  });

  it('without a body weight it asks for one instead of showing calories', () => {
    seed(emptyState());
    past();
    expect(screen.getByText(en.actNoWeight)).toBeTruthy();
    expect(document.querySelector('.act-kcal')).toBeNull();
  });

  it('only distance sports have a distance field', () => {
    past('run');
    expect(screen.getByLabelText(new RegExp(en.actDistance))).toBeTruthy();
    cleanup();
    past('hiit');
    expect(screen.queryByLabelText(new RegExp(en.actDistance))).toBeNull();
  });

  it('Save logs the activity with start, end, calories, distance and effort, then closes', () => {
    const { onClose } = past();
    stubGeometry();
    drag(en.srRangeStart, 600); // 10:00, end follows to keep the gap
    fireEvent.change(screen.getByLabelText(new RegExp(en.actDistance)), {
      target: { value: '5.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.actEffortLevel.light }));
    save();
    const [a] = __getStateForTests().activities;
    const start = new Date(2026, 8, 26, 10, 0).getTime();
    expect(a.startedAt).toBe(start);
    expect(a.finishedAt).toBe(start + a.durationMin * 60000);
    expect(a).toMatchObject({
      type: 'run',
      category: 'conditioning',
      distanceKm: 5.5,
      effort: 'light',
    });
    expect(a.calories).toBe(estimateCalories(activityType('run')!, a.durationMin, KG, 'light'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dragging the end handle sets the length (at least one hour)', () => {
    const { onClose } = past('hiit');
    stubGeometry();
    drag(en.srRangeEnd, 90); // end at 01:30 -> start pulled so the gap is >= 60
    expect(document.querySelector('.tlr-end')?.textContent).toBe('01:30');
    save();
    const [a] = __getStateForTests().activities;
    expect(a.durationMin).toBe(90);
    expect(new Date(a.startedAt).getHours()).toBe(0);
    expect(a.distanceKm).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('an empty distance is stored as none', () => {
    past();
    save();
    expect(__getStateForTests().activities[0].distanceKm).toBeNull();
  });

  it('a past date can be picked from the calendar; future days are disabled', () => {
    past();
    fireEvent.click(screen.getByRole('button', { name: en.backfillDate }));
    const days = [...document.querySelectorAll('.cal-day')] as HTMLButtonElement[];
    const future = days.find((d) => d.textContent === '28' && !d.classList.contains('muted'))!;
    expect(future.disabled).toBe(true);
    const pick = days.find((d) => d.textContent === '20' && !d.classList.contains('muted'))!;
    fireEvent.click(pick);
    save();
    const [a] = __getStateForTests().activities;
    expect(new Date(a.startedAt).getDate()).toBe(20);
    expect(new Date(a.startedAt).getMonth()).toBe(8);
  });
});

describe('ActivityView: a running activity', () => {
  const run = (key = 'run') => {
    const onClose = vi.fn();
    const out = render(<ActivityView newType={key} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: en.actStart }));
    return { ...out, onClose };
  };
  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('counts time and estimates calories as it runs', () => {
    run();
    expect(document.querySelector('.live-timer')?.textContent).toBe('0:00');
    expect(document.querySelector('.av-kcal')).toBeNull();
    tick(10 * 60000);
    expect(document.querySelector('.live-timer')?.textContent).toBe('10:00');
    expect(document.querySelector('.av-kcal .tnum')?.textContent).toBe(
      `~${estimateCalories(activityType('run')!, 10, KG, 'moderate')}`,
    );
  });

  it('Finish is disabled until some time has passed', () => {
    run();
    expect((screen.getByRole('button', { name: en.actFinish }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    tick(60000);
    expect((screen.getByRole('button', { name: en.actFinish }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('without a weight it says so instead of calories', () => {
    seed(emptyState());
    run();
    tick(60000);
    expect(screen.getByText(en.actNoWeight)).toBeTruthy();
  });

  it('effort and distance are saved on the activity as you change them', () => {
    run();
    fireEvent.click(screen.getByRole('button', { name: en.actEffortLevel.hard }));
    expect(__getStateForTests().activities[0].effort).toBe('hard');
    const dist = screen.getByLabelText(new RegExp(en.actDistance));
    fireEvent.change(dist, { target: { value: '3.2' } });
    expect(__getStateForTests().activities[0].distanceKm).toBe(3.2);
    fireEvent.change(dist, { target: { value: '' } });
    expect(__getStateForTests().activities[0].distanceKm).toBeNull();
    fireEvent.change(dist, { target: { value: '0' } });
    expect(__getStateForTests().activities[0].distanceKm).toBeNull();
  });

  it('Pause freezes the clock and shows Resume; Resume starts it again', () => {
    run();
    tick(5 * 60000);
    fireEvent.click(screen.getByRole('button', { name: en.actPause }));
    const frozen = document.querySelector('.live-timer')?.textContent;
    expect(frozen).toBe('5:00');
    tick(5 * 60000);
    expect(document.querySelector('.live-timer')?.textContent).toBe(frozen);
    expect(screen.getByText(new RegExp(en.actPaused))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.actResume }));
    tick(2 * 60000);
    expect(document.querySelector('.live-timer')?.textContent).toBe('7:00');
  });

  it('Finish asks, then saves the length and calories and closes', () => {
    const { onClose } = run();
    tick(5 * 60000);
    fireEvent.click(screen.getByRole('button', { name: en.actFinish }));
    expect(screen.getByText(en.actFinishTitle)).toBeTruthy();
    expect(screen.getByText(en.actFinishBody(5))).toBeTruthy();
    const dlg = screen
      .getByText(en.actFinishTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.actFinish }));
    const [a] = __getStateForTests().activities;
    expect(a.finishedAt).not.toBeNull();
    expect(a.durationMin).toBe(5);
    expect(a.calories).toBe(estimateCalories(activityType('run')!, 5, KG, 'moderate'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling the Finish question keeps it running', () => {
    const { onClose } = run();
    tick(2 * 60000);
    fireEvent.click(screen.getByRole('button', { name: en.actFinish }));
    const dlg = screen
      .getByText(en.actFinishTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.cancel }));
    expect(screen.queryByText(en.actFinishTitle)).toBeNull();
    expect(__getStateForTests().activities[0].finishedAt).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Discard asks, then deletes the activity and closes', () => {
    const { onClose } = run();
    fireEvent.click(screen.getByRole('button', { name: en.actDiscard }));
    expect(screen.getByText(en.actDiscardBody)).toBeTruthy();
    const dlg = screen
      .getByText(en.actDiscardTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.cancel }));
    expect(__getStateForTests().activities).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: en.actDiscard }));
    const dlg2 = screen
      .getByText(en.actDiscardTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg2).getByRole('button', { name: en.actDiscard }));
    expect(__getStateForTests().activities).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('when the live activity disappears elsewhere the page shows the idle Start screen again', () => {
    run();
    act(() => {
      seed({ ...__getStateForTests(), activities: [] });
    });
    expect(screen.getByRole('button', { name: en.actStart })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.actPause })).toBeNull();
  });
});

describe('ActivityView: editing a logged activity', () => {
  const edit = (a: Activity = logged()) => {
    seed({ ...__getStateForTests(), activities: [a] });
    const onClose = vi.fn();
    const out = render(<ActivityView editId={a.id} onClose={onClose} />);
    return { ...out, onClose };
  };

  it('starts from what was logged', () => {
    edit();
    expect(document.querySelector('.tlr-start')?.textContent).toBe('18:30');
    expect(document.querySelector('.tlr-end')?.textContent).toBe('19:15');
    expect((screen.getByLabelText(new RegExp(en.actDistance)) as HTMLInputElement).value).toBe(
      '7.5',
    );
    expect(document.querySelector('.act-kcal .tnum')?.textContent).toBe(
      `~${estimateCalories(activityType('run')!, 45, KG, 'hard')}`,
    );
  });

  it('Save rewrites the times, calories, distance and effort in place', () => {
    const { onClose } = edit();
    fireEvent.change(screen.getByLabelText(new RegExp(en.actDistance)), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: en.actEffortLevel.light }));
    fireEvent.click(screen.getByRole('button', { name: en.actSave }));
    const acts = __getStateForTests().activities;
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ id: 'a1', distanceKm: 8, effort: 'light', durationMin: 45 });
    expect(acts[0].calories).toBe(estimateCalories(activityType('run')!, 45, KG, 'light'));
    expect(acts[0].finishedAt).toBe(acts[0].startedAt + 45 * 60000);
    expect(onClose).toHaveBeenCalled();
  });

  it('a recovery activity shows the recovery tag and has no distance', () => {
    edit(logged({ type: 'yoga', category: 'recovery', distanceKm: null }));
    expect(screen.getByText(en.actCountsRecovery)).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(en.actDistance))).toBeNull();
  });

  it('Delete asks, Cancel keeps it, confirming removes it and closes', () => {
    const { onClose } = edit();
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    expect(screen.getByText(en.actDeleteBody)).toBeTruthy();
    const dlg = screen
      .getByText(en.actDeleteTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.cancel }));
    expect(__getStateForTests().activities).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    const dlg2 = screen
      .getByText(en.actDeleteTitle)
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg2).getByRole('button', { name: en.delete }));
    expect(__getStateForTests().activities).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('a type that no longer exists closes the editor', () => {
    const { onClose } = edit(logged({ type: 'retired-sport' }));
    expect(onClose).toHaveBeenCalled();
  });
});
