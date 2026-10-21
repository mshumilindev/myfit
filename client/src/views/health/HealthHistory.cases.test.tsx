import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { __getStateForTests, dayKey } from '../../store';
import type { Injury, RestPeriod, Workout } from '../../types';
import { DAY, NOW, emptyState, freezeClock, history, seed } from '../__fixtures__/viewKit';
import { HistControls, HistoryList, HistoryTimeline, type HistFilter } from './HealthHistory';

const T = dayKey(NOW);
const period = (over: Partial<RestPeriod> & { id: string }): RestPeriod =>
  ({
    startDay: T - 3,
    endDay: T + 1,
    mode: 'off',
    createdAt: NOW - DAY,
    name: null,
    ...over,
  }) as RestPeriod;
const injury = (over: Partial<Injury> & { id: string }): Injury =>
  ({
    reason: 'injury',
    bodyPart: 'knee',
    side: 'left',
    muscles: ['quads'],
    stage: 'reintroduce',
    startDay: T - 5,
    createdAt: NOW - 5 * DAY,
    checkins: [],
    healedDay: null,
    ...over,
  }) as Injury;

const ILL = period({
  id: 'ill',
  mode: 'illness',
  startDay: T - 2,
  endDay: T - 2,
  open: true,
  name: 'Flu',
});
const TRIP = period({ id: 'trip', mode: 'off', startDay: T + 3, endDay: T + 6, name: 'Trip' });
const SEPT = period({
  id: 'sept',
  mode: 'active',
  startDay: T - 15,
  endDay: T - 12,
  name: 'Deload',
});
const AUG = period({ id: 'aug', mode: 'off', startDay: T - 45, endDay: T - 39, name: 'Break' });
const KNEE = injury({ id: 'knee' });
const OLD = injury({
  id: 'old',
  bodyPart: 'shoulder',
  side: 'right',
  startDay: T - 100,
  healedDay: T - 90,
});

const load = (over: Partial<ReturnType<typeof emptyState>> = {}) =>
  seed({ ...emptyState(), restPeriods: [ILL, TRIP, SEPT, AUG], injuries: [KNEE, OLD], ...over });

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
});
afterEach(cleanup);

describe('HistControls', () => {
  it('switches between list and timeline and filters by type', () => {
    const onMode = vi.fn();
    const onFilter = vi.fn();
    render(<HistControls mode="list" filter="all" onMode={onMode} onFilter={onFilter} />);
    fireEvent.click(screen.getByText(en.hlTimelineView));
    expect(onMode).toHaveBeenCalledWith('timeline');
    for (const f of ['rest', 'illness', 'injury', 'all'] as HistFilter[])
      fireEvent.click(screen.getByText(en.hlFilter[f]));
    expect(onFilter.mock.calls.map((c) => c[0])).toEqual(['rest', 'illness', 'injury', 'all']);
  });
});

describe('HistoryList', () => {
  it('groups what is on now, what is coming up and the past by month, each with its own sub-line', () => {
    load();
    render(<HistoryList now={NOW} filter="all" web={false} onOpen={() => undefined} />);
    expect(screen.getByText(en.hlNow)).toBeTruthy();
    expect(screen.getByText(en.hlComingUp)).toBeTruthy();
    expect(document.body.textContent).toContain(en.hlTypeDayN(en.restModeIllness, 3)); // open illness: day 3
    expect(document.body.textContent).toContain(en.hlRehabStage(2, 4)); // ongoing injury
    expect(document.body.textContent).toContain(en.hlTypeDays(en.hlFilter.injury, 11)); // healed injury
    expect(document.body.textContent).toContain(en.hlTypeDays(en.hlFullRest, 7));
    expect(screen.getByText(en.hlListFoot)).toBeTruthy();
    // the past comes in month groups, newest first
    const body = document.body.textContent ?? '';
    const at = (s: string) => body.indexOf(s);
    expect(at('September 2026')).toBeGreaterThan(-1);
    expect(at('September 2026')).toBeLessThan(at('August 2026'));
    expect(at('August 2026')).toBeLessThan(at('June 2026'));
  });

  it('a filter keeps one kind; an empty result says nothing is logged', () => {
    load();
    const { rerender } = render(
      <HistoryList now={NOW} filter="injury" web={false} onOpen={() => undefined} />,
    );
    expect(document.querySelectorAll('.hl-swipe')).toHaveLength(2);
    rerender(<HistoryList now={NOW} filter="illness" web={false} onOpen={() => undefined} />);
    expect(document.querySelectorAll('.hl-swipe')).toHaveLength(1);
    cleanup();
    seed(emptyState());
    render(<HistoryList now={NOW} filter="all" web onOpen={() => undefined} />);
    expect(screen.getByText(en.hlNoHistory)).toBeTruthy();
  });

  it('web: rows are plain buttons that open the item, with the click-wording footnote', () => {
    load();
    const onOpen = vi.fn();
    render(<HistoryList now={NOW} filter="all" web onOpen={onOpen} />);
    expect(document.querySelector('.hl-swipe')).toBeNull();
    expect(screen.getByText(en.hlListFootWeb)).toBeTruthy();
    fireEvent.click(screen.getByText('Deload'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toMatchObject({ id: 'sept', kind: 'rest' });
  });

  describe('swiping a row (mobile)', () => {
    const rowEl = (name: string) => screen.getByText(name).closest('.hl-swipe') as HTMLElement;
    const swipe = (el: HTMLElement, dx: number, dy = 0) => {
      fireEvent.pointerDown(el, { clientX: 200, clientY: 100 });
      fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 100 + dy });
    };

    it('a clear swipe left opens Edit/Delete; right closes; small or mostly vertical moves do nothing', () => {
      load();
      render(<HistoryList now={NOW} filter="all" web={false} onOpen={() => undefined} />);
      const r = rowEl('Deload');
      swipe(r, -20);
      expect(r.className).not.toContain('open');
      swipe(r, -60, 80);
      expect(r.className).not.toContain('open');
      swipe(r, -80);
      expect(r.className).toContain('open');
      swipe(r, 80);
      expect(r.className).not.toContain('open');
    });

    it('a pointer-up without a pointer-down is ignored', () => {
      load();
      render(<HistoryList now={NOW} filter="all" web={false} onOpen={() => undefined} />);
      fireEvent.pointerUp(rowEl('Deload'), { clientX: 10, clientY: 10 });
      expect(rowEl('Deload').className).not.toContain('open');
    });

    it('tapping an open row closes it instead of opening; Edit closes and opens the item', () => {
      load();
      const onOpen = vi.fn();
      render(<HistoryList now={NOW} filter="all" web={false} onOpen={onOpen} />);
      const r = rowEl('Deload');
      swipe(r, -80);
      fireEvent.click(within(r).getByText('Deload'));
      expect(onOpen).not.toHaveBeenCalled();
      expect(r.className).not.toContain('open');
      swipe(r, -80);
      fireEvent.click(within(r).getByRole('button', { name: en.hlEditAria('Deload') }));
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(r.className).not.toContain('open');
    });

    it('deleting a period asks first (with its range and length); Keep it leaves it, Delete removes it', () => {
      load();
      render(<HistoryList now={NOW} filter="all" web={false} onOpen={() => undefined} />);
      fireEvent.click(
        within(rowEl('Deload')).getByRole('button', { name: en.hlDeleteAria('Deload') }),
      );
      expect(screen.getByText(en.hlDeletePeriod)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: en.hlKeepIt }));
      expect(__getStateForTests().restPeriods.map((p) => p.id)).toContain('sept');
      fireEvent.click(
        within(rowEl('Deload')).getByRole('button', { name: en.hlDeleteAria('Deload') }),
      );
      fireEvent.click(
        within(
          document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement,
        ).getByRole('button', { name: en.delete }),
      );
      expect(__getStateForTests().restPeriods.map((p) => p.id)).not.toContain('sept');
      expect(screen.queryByText('Deload')).toBeNull();
    });

    it('deleting an injury uses the injury wording and removes it', () => {
      load();
      render(<HistoryList now={NOW} filter="injury" web={false} onOpen={() => undefined} />);
      const label = [...document.querySelectorAll('.hl-swipe')].map(
        (s) => s.querySelector('.uirow-l')?.textContent,
      )[1] as string;
      const swipeRows = [...document.querySelectorAll<HTMLElement>('.hl-swipe')];
      const target = swipeRows.find(
        (s) => s.querySelector('.uirow-l')?.textContent === label,
      ) as HTMLElement;
      fireEvent.click(within(target).getByRole('button', { name: en.hlDeleteAria(label) }));
      expect(screen.getByText(en.hlDeleteInjury)).toBeTruthy();
      fireEvent.click(
        within(
          document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement,
        ).getByRole('button', { name: en.delete }),
      );
      expect(__getStateForTests().injuries).toHaveLength(1);
    });
  });
});

describe('HistoryTimeline', () => {
  const text = () => document.body.textContent ?? '';

  it('with nothing logged it shows the empty "later", "now" and a start-of-log row only when a workout exists', () => {
    seed(emptyState());
    render(<HistoryTimeline now={NOW} filter="all" web={false} />);
    expect(screen.getByText(en.hlLater)).toBeTruthy();
    expect(screen.getByText(en.hlNothingPlanned)).toBeTruthy();
    expect(text()).not.toContain('Start of your log');
    expect(screen.getByText(en.hlTlFoot)).toBeTruthy();
  });

  it('web wording of the footnote', () => {
    seed(emptyState());
    render(<HistoryTimeline now={NOW} filter="all" web />);
    expect(screen.getByText(en.hlTlFootWeb)).toBeTruthy();
  });

  it('scheduled periods hang under "Later", what is on now is counted, and the past follows by month', () => {
    load();
    render(<HistoryTimeline now={NOW} filter="all" web={false} />);
    expect(screen.queryByText(en.hlNothingPlanned)).toBeNull();
    expect(text()).toContain('Trip');
    expect(text()).toContain(en.hlNActive(2));
    expect(text()).toContain(en.hlDayNoEnd(3)); // open illness
    expect(text()).toContain(en.hlRehabStageName(en.injStage.reintroduce));
    expect(text()).toContain('Deload');
    expect(text()).toContain('Break');
    expect(text()).toMatch(/\d+ \w+ – \d+ \w+ · free|\d+–\d+ \w+ · free/);
  });

  it('the earliest workout marks the start of the log', () => {
    const w = history(2)[0] as Workout;
    load({
      workouts: [{ ...w, startedAt: NOW - 120 * DAY, finishedAt: NOW - 120 * DAY + 3600_000 }],
    });
    render(<HistoryTimeline now={NOW} filter="all" web={false} />);
    expect(text()).toMatch(/Start of your log · /);
  });

  it('a workout done during a full rest is flagged as kept; during an active rest it is not', () => {
    const w = history(1)[0] as Workout;
    const during = (day: number): Workout =>
      ({
        ...w,
        id: `k${day}`,
        startedAt: (day + 0.5) * DAY,
        finishedAt: (day + 0.5) * DAY + 3600_000,
      }) as Workout;
    load({ workouts: [during(T - 42), during(T - 14)] });
    render(<HistoryTimeline now={NOW} filter="all" web={false} />);
    expect(text().match(/workout kept/g)).toHaveLength(1);
  });

  it('a filter narrows the timeline to one kind', () => {
    load();
    render(<HistoryTimeline now={NOW} filter="injury" web={false} />);
    expect(text()).not.toContain('Trip');
    expect(text()).not.toContain('Deload');
    expect(text()).toContain(en.hlRehabStageName(en.injStage.reintroduce));
  });

  it('two things at once share the rail side by side: both running now and an overlap in the past', () => {
    load({
      restPeriods: [
        period({ id: 'a', mode: 'illness', startDay: T - 4, endDay: T + 2, name: 'Cold' }),
        period({ id: 'b', mode: 'off', startDay: T - 30, endDay: T - 20, name: 'Long trip' }),
        period({ id: 'c', mode: 'active', startDay: T - 25, endDay: T - 24, name: 'Inside' }),
      ],
      injuries: [KNEE],
    });
    render(<HistoryTimeline now={NOW} filter="all" web={false} />);
    expect(text()).toContain(en.hlNActive(2));
    expect(text()).toContain('Inside');
    expect(text()).toContain('Long trip');
    expect(
      document.querySelectorAll('.uitl-bar, [class*="tl-bar"], [class*="uitl"]').length,
    ).toBeGreaterThan(0);
  });
});
