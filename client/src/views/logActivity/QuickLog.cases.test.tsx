import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { pinsPref } from '../../activityPrefs';
import { __getStateForTests } from '../../store';
import type { Activity } from '../../types';
import { DAY, NOW, emptyState, freezeClock, seed } from '../__fixtures__/viewKit';
import { QuickLog, type QuickLogProps } from './QuickLog';

const MIN = 60_000;
const WEIGH = { id: 'wt', at: NOW - DAY, weight: 80 };
const past = (type: string, over: Partial<Activity> = {}): Activity =>
  ({
    id: `p-${type}`,
    type,
    category: type === 'sauna' ? 'recovery' : 'conditioning',
    startedAt: NOW - 2 * DAY - 3 * 3600_000 + 0,
    finishedAt: NOW - 2 * DAY - 3 * 3600_000 + 40 * MIN,
    durationMin: 40,
    effort: 'hard',
    ...over,
  }) as Activity;

function put(activities: Activity[] = [], weigh = true) {
  const s = emptyState();
  seed({ ...s, activities, bodyMetrics: { ...s.bodyMetrics, weights: weigh ? [WEIGH] : [] } });
}
function ql(over: Partial<QuickLogProps> = {}) {
  const fns = { onClose: vi.fn(), onLogged: vi.fn(), onStarted: vi.fn() };
  const r = render(<QuickLog typeKey="run" locked={false} variant="sheet" {...fns} {...over} />);
  return { ...r, ...fns };
}
const seg = (label: string | RegExp) =>
  screen.getByRole('button', { name: label }) as HTMLButtonElement;
const logBtn = () => screen.getByRole('button', { name: /^Log it/ }) as HTMLButtonElement;
const acts = () => __getStateForTests().activities;
const type = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  localStorage.clear();
  pinsPref.reset();
  put();
});
afterEach(cleanup);

describe('QuickLog: duration', () => {
  it('opens on 30 minutes by default, and on the rounded length of the last one when there is one', () => {
    ql();
    expect(seg('30').getAttribute('aria-pressed')).toBe('true');
    cleanup();
    put([past('run', { durationMin: 47, finishedAt: NOW - 2 * DAY - 3 * 3600_000 + 47 * MIN })]);
    ql();
    expect(seg('45').getAttribute('aria-pressed')).toBe('true');
  });

  it('a preset sets the minutes and the log label follows', () => {
    ql();
    fireEvent.click(seg('60'));
    expect(logBtn().textContent).toBe(en.laLogIt('60 min'));
  });

  it('a length that is not a preset opens the custom field; typing clamps to 1–1440 and empty disables logging', () => {
    ql({ initialMinutes: 50 });
    const field = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(field.value).toBe('50');
    type(field, '5000');
    expect(field.value).toBe('1440');
    type(field, '');
    expect(logBtn().disabled).toBe(true);
    type(field, '25');
    expect(logBtn().disabled).toBe(false);
    expect(logBtn().textContent).toBe(en.laLogIt('25 min'));
    fireEvent.click(seg('15'));
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('"Custom" reveals the field with the current value', () => {
    ql();
    fireEvent.click(seg(en.laCustomAria));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('30');
  });
});

describe('QuickLog: logging now', () => {
  it('logs a run that ended now with the chosen effort, estimated calories and no distance', () => {
    const { onLogged } = ql();
    fireEvent.click(seg(en.actEffortLevel.hard));
    fireEvent.click(logBtn());
    expect(acts()).toHaveLength(1);
    expect(acts()[0]).toMatchObject({
      type: 'run',
      category: 'conditioning',
      durationMin: 30,
      effort: 'hard',
      finishedAt: NOW,
      startedAt: NOW - 30 * MIN,
      note: null,
      distanceKm: null,
    });
    expect(acts()[0].calories).toBeGreaterThan(0);
    expect(onLogged).toHaveBeenCalledWith(expect.objectContaining({ type: 'run' }));
  });

  it('the estimate shows kcal and how it was worked out, or asks for a weight when there is none', () => {
    ql();
    expect(document.querySelector('.la-est-n')?.textContent).toMatch(/^≈ \d+$/);
    expect(document.querySelector('.la-est-s')?.textContent).toMatch(/80/);
    cleanup();
    put([], false);
    ql();
    expect(document.querySelector('.la-est-s')?.textContent).toBe(en.actNoWeight);
  });

  it('a note names the activity: "other sport" is shown and saved under the person\'s own words', () => {
    ql({ typeKey: 'sport', note: 'Underwater hockey' });
    expect(screen.getByRole('heading', { name: 'Underwater hockey' })).toBeTruthy();
    fireEvent.click(logBtn());
    expect(acts()[0]).toMatchObject({ type: 'sport', note: 'Underwater hockey' });
  });

  it('recovery and sport types carry their own tag', () => {
    ql({ typeKey: 'sauna' });
    expect(screen.getByText(en.actCountsRecovery)).toBeTruthy();
    cleanup();
    ql({ typeKey: 'tennis' });
    expect(screen.getByText(en.actAddsConditioning)).toBeTruthy();
  });

  it('shows the last one with distance, length, weekday and date', () => {
    put([past('run', { distanceKm: 5.4 })]);
    ql();
    const line = document.querySelector('.la-ql-last')?.textContent ?? '';
    expect(line).toContain(`5.4 ${en.laKm}`);
    expect(line).toContain('40 min');
    expect(line).not.toContain(en.actEffortLevel.hard);
    cleanup();
    put([past('sauna')]);
    ql({ typeKey: 'sauna' });
    expect(document.querySelector('.la-ql-last')?.textContent).toContain(en.actEffortLevel.hard);
  });

  it('opens on the last effort used', () => {
    put([past('run', { effort: 'light' })]);
    ql();
    expect(seg(en.actEffortLevel.light).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('QuickLog: the timer', () => {
  it('Start timer begins a live activity and hands over; a plain start sends no extras', () => {
    const { onStarted } = ql();
    fireEvent.click(seg(en.laStartTimer));
    const live = acts().find((a) => a.finishedAt === null);
    expect(live?.type).toBe('run');
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(live?.effort ?? 'moderate').toBe('moderate');
  });

  it('effort, distance and note chosen before starting are put on the live activity', () => {
    ql({ typeKey: 'run', note: 'Track day' });
    fireEvent.click(seg(en.actEffortLevel.hard));
    type(screen.getByLabelText(en.actDistance), '7,5');
    fireEvent.click(seg(en.laStartTimer));
    const live = acts().find((a) => a.finishedAt === null);
    expect(live).toMatchObject({ effort: 'hard', distanceKm: 7.5, note: 'Track day' });
  });

  it('is off while something else is live, and for any time but now', () => {
    ql({ locked: true });
    expect(seg(en.laStartTimer).disabled).toBe(true);
    expect(seg(en.laNow).disabled).toBe(true);
    expect(seg(en.laEarlierToday).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(en.laTimerNowOnly)).toBeTruthy();
    cleanup();
    const { onStarted } = ql();
    fireEvent.click(seg(en.laEarlierToday));
    expect(seg(en.laStartTimer).disabled).toBe(true);
    fireEvent.click(seg(en.laStartTimer));
    expect(onStarted).not.toHaveBeenCalled();
    expect(acts()).toHaveLength(0);
  });

  it('a refused start (another session is already open) does not hand over', () => {
    seed({
      ...__getStateForTests(),
      sleeps: [
        { id: 's', date: 'd', bedtime: NOW - 3600_000, wake: null, source: 'live' } as never,
      ],
    });
    const { onStarted } = ql();
    fireEvent.click(seg(en.laStartTimer));
    expect(onStarted).not.toHaveBeenCalled();
    expect(acts()).toHaveLength(0);
  });
});

describe('QuickLog: when', () => {
  it('"Now" explains the range it will log', () => {
    ql();
    expect(screen.getByText(en.laEndsNow('11:30–12:00'))).toBeTruthy();
  });

  it('"Earlier today" proposes a start that ends by now and logs there', () => {
    ql();
    fireEvent.click(seg(en.laEarlierToday));
    const time = screen.getByDisplayValue(/^\d\d:\d\d$/) as HTMLInputElement;
    expect(time.value).toBe('11:30');
    type(time, '08:15');
    fireEvent.click(logBtn());
    expect(new Date(acts()[0].startedAt).getHours()).toBe(8);
    expect(new Date(acts()[0].startedAt).getMinutes()).toBe(15);
    expect(acts()[0].finishedAt).toBe(acts()[0].startedAt + 30 * MIN);
  });

  it('the usual start of the last log is proposed when it still fits', () => {
    const start = new Date(NOW - DAY);
    start.setHours(7, 20, 0, 0);
    put([past('run', { startedAt: start.getTime(), finishedAt: start.getTime() + 40 * MIN })]);
    ql();
    fireEvent.click(seg(en.laEarlierToday));
    expect((screen.getByDisplayValue(/^\d\d:\d\d$/) as HTMLInputElement).value).toBe('07:20');
  });

  it('a time that would end in the future warns and blocks logging; clearing the field falls back to midnight', () => {
    ql();
    fireEvent.click(seg(en.laEarlierToday));
    const time = screen.getByDisplayValue(/^\d\d:\d\d$/) as HTMLInputElement;
    type(time, '11:59');
    expect(screen.getByText(en.laFuture)).toBeTruthy();
    expect(logBtn().disabled).toBe(true);
    fireEvent.click(logBtn());
    expect(acts()).toHaveLength(0);
    type(time, '11:31');
    expect(screen.queryByText(en.laFuture)).toBeNull();
    type(time, '11:32');
    expect(screen.getByText(en.laFuture)).toBeTruthy();
    type(time, '');
    expect(time.value).toBe('00:00');
    expect(screen.queryByText(en.laFuture)).toBeNull();
  });

  it('"Pick a day" starts on yesterday, summarises the day, and a tap on the calendar moves it', () => {
    ql();
    fireEvent.click(seg(en.laPickDay));
    expect(document.querySelector('.la-when-sum')?.textContent).toContain(en.laYesterday);
    fireEvent.click(screen.getByLabelText(/^Wednesday Sep 23/));
    expect(document.querySelector('.la-when-sum')?.textContent).toContain(en.laDaysAgo(3));
    fireEvent.click(logBtn());
    expect(new Date(acts()[0].startedAt).getDate()).toBe(23);
  });

  it('the calendar disables the future, marks today, and flags days with activity by colour family', () => {
    put([past('run'), past('sauna', { id: 'p2' })]);
    ql();
    fireEvent.click(seg(en.laPickDay));
    expect((screen.getByLabelText(/^Sunday Sep 27/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText(en.laDayToday('Saturday Sep 26'))).toBeTruthy();
    const label = en.laDayHas(
      'Thursday Sep 24',
      `${en.actConditioning.toLowerCase()} ${en.laAnd} ${en.actRecovery.toLowerCase()}`,
    );
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(en.actSports)).toBeTruthy();
  });
});

describe('QuickLog: distance', () => {
  it('a type without distance has no distance field', () => {
    ql({ typeKey: 'yoga' });
    expect(screen.queryByLabelText(en.actDistance)).toBeNull();
  });

  it('shows the pace once there is a distance, and the stepper moves by half a kilometre without going below zero', () => {
    ql();
    const field = screen.getByLabelText(en.actDistance) as HTMLInputElement;
    expect(document.body.textContent).toContain(`${en.laPace} —`);
    fireEvent.click(screen.getByRole('button', { name: en.laIncDist }));
    expect(field.value).toBe('0.5');
    fireEvent.click(screen.getByRole('button', { name: en.laIncDist }));
    type(field, '5');
    expect(document.body.textContent).toContain(`6:00 /${en.laKm}`);
    fireEvent.click(screen.getByRole('button', { name: en.laDecDist }));
    expect(field.value).toBe('4.5');
    type(field, '0.2');
    fireEvent.click(screen.getByRole('button', { name: en.laDecDist }));
    expect(field.value).toBe('0');
    fireEvent.click(logBtn());
    expect(acts()[0].distanceKm).toBeNull();
  });

  it('opens on the last distance and logs it', () => {
    put([past('run', { distanceKm: 8 })]);
    ql();
    expect((screen.getByLabelText(en.actDistance) as HTMLInputElement).value).toBe('8');
    fireEvent.click(logBtn());
    expect(acts().find((a) => a.id !== 'p-run')?.distanceKm).toBe(8);
  });
});

describe('QuickLog: pinning', () => {
  it('the switch pins and unpins the type and changes its wording', () => {
    ql();
    const sw = screen.getByRole('switch') as HTMLInputElement;
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    expect(pinsPref.get()).toContain('run');
    expect(screen.getByText(en.laNameShowsFirst('Run'))).toBeTruthy();
    fireEvent.click(screen.getByRole('switch'));
    expect(pinsPref.get()).not.toContain('run');
    expect(screen.getByText(en.laShowsFirst)).toBeTruthy();
  });
});

describe('QuickLog: the side panel', () => {
  const panel = (over: Partial<QuickLogProps> = {}) => ql({ variant: 'panel', ...over });

  it('has its own close button and the pin toggle at the top', () => {
    const { onClose } = panel();
    fireEvent.click(screen.getByRole('button', { name: en.laCloseQuick }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(en.laPinToTop));
    expect(pinsPref.get()).toContain('run');
    expect(screen.getByText(en.laPinnedToTop)).toBeTruthy();
    fireEvent.click(screen.getByText(en.laPinnedToTop));
    expect(pinsPref.get()).not.toContain('run');
  });

  it('a past time asks for a start time, shows when it ends, and the button names the range', () => {
    panel();
    fireEvent.click(seg(en.laEarlierToday));
    expect(screen.getByLabelText(en.laStartTime)).toBeTruthy();
    expect(screen.getByText(en.laEnds)).toBeTruthy();
    expect(screen.getByText(en.laPastNoTimer)).toBeTruthy();
    expect(logBtn().textContent).toBe(en.laLogIt('11:30–12:00'));
    expect(screen.queryByText(en.laStartTimer)).toBeNull();
    type(screen.getByLabelText(en.laStartTime), '');
    expect((screen.getByLabelText(en.laStartTime) as HTMLInputElement).value).toBe('00:00');
  });

  it('on a picked day the end is shown with the day name', () => {
    panel();
    fireEvent.click(seg(en.laPickDay));
    const ends = document.querySelector('.la-fld.plain') as HTMLElement;
    expect(ends.textContent).toMatch(/^\d\d:\d\d · /);
    expect(ends.textContent).not.toContain(en.laTodayLower);
  });

  it('distance has a labelled field and a pace box; the metabolic line is shown under the estimate', () => {
    panel();
    const field = screen.getByLabelText(en.laDistanceKm) as HTMLInputElement;
    expect(
      within(document.querySelector('.la-pacebox') as HTMLElement).getByText('—'),
    ).toBeTruthy();
    type(field, '6');
    expect(document.querySelector('.la-pacebox b')?.textContent).toBe(`5:00 /${en.laKm}`);
    expect(document.querySelector('.la-est-s.right')).not.toBeNull();
  });

  it('with no weight the panel says so beside the estimate', () => {
    put([], false);
    panel();
    expect(document.querySelector('.la-est-s')?.textContent).toBe(en.actNoWeight);
  });
});
