import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { __getStateForTests, dayKey } from '../../store';
import type { Workout } from '../../types';
import type { HealthFormSpec } from '../../health';
import { DAY, NOW, emptyState, freezeClock, history, seed } from '../__fixtures__/viewKit';
import { HealthForm } from './HealthForm';

const T = dayKey(NOW);
const fmt = (day: number) => {
  const d = new Date(day * DAY + 12 * 3600_000);
  const p = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' }).format(d);
  return `${p({ weekday: 'short' })} ${d.getUTCDate()} ${p({ month: 'short' })}`;
};

interface Opts {
  web?: boolean;
  presentation?: 'page' | 'sheet';
}
function form(spec: HealthFormSpec, opts: Opts = {}) {
  const fns = { onCancel: vi.fn(), onDone: vi.fn(), onRehab: vi.fn() };
  const r = render(
    <HealthForm
      spec={spec}
      now={NOW}
      web={opts.web ?? false}
      presentation={opts.presentation}
      {...fns}
    />,
  );
  return { ...r, ...fns };
}
const start = (type: 'off' | 'active' | 'illness' | 'injury') =>
  ({ kind: 'new', ctx: 'start', type }) as HealthFormSpec;
const past = (type: 'off' | 'active' | 'illness' | 'injury') =>
  ({ kind: 'new', ctx: 'past', type }) as HealthFormSpec;
const row = (label: string | RegExp) =>
  [...document.querySelectorAll<HTMLElement>('.uirow')].find((r) => {
    const l = r.querySelector('.uirow-l')?.textContent ?? '';
    return typeof label === 'string' ? l === label : label.test(l);
  }) as HTMLElement;
const click = (el: HTMLElement | null | undefined) => fireEvent.click(el as HTMLElement);
const primary = () => document.querySelector('.uiab-acts .uibtn--primary') as HTMLButtonElement;
const periods = () => __getStateForTests().restPeriods;
const day = (n: number) => document.querySelector(`.uical-grid [data-day="${n}"]`) as HTMLElement;
const period = (over: Record<string, unknown>) =>
  ({
    id: 'p1',
    mode: 'off',
    startDay: T - 20,
    endDay: T - 15,
    createdAt: NOW - 25 * DAY,
    name: 'Trip',
    ...over,
  }) as never;
const workoutOn = (d: number, id: string): Workout =>
  ({
    ...history(1)[0],
    id,
    startedAt: d * DAY + 15 * 3600_000,
    finishedAt: d * DAY + 16 * 3600_000,
    dayName: 'Push',
  }) as Workout;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  seed(emptyState());
});
afterEach(cleanup);

describe('HealthForm: start a full rest', () => {
  it('opens on the end date with a week planned, titled and labelled for starting today', () => {
    form(start('off'));
    expect(document.querySelector('.uipagehead')?.textContent).toContain(en.hlFullRest);
    expect(row(en.hlStarts)?.textContent).toContain(fmt(T));
    expect(document.querySelector('.uical-grid')).not.toBeNull();
    expect(primary().textContent).toBe(en.hlStartMode('off'));
    expect(screen.getByText(en.hlWhatItDoes)).toBeTruthy();
    expect(screen.getByText(en.hlPaused)).toBeTruthy();
  });

  it('saves the period with its name and leaves', () => {
    const { onDone } = form(start('off'));
    fireEvent.change(screen.getByLabelText(en.hlName), { target: { value: '  Beach week ' } });
    click(primary());
    expect(periods()).toHaveLength(1);
    expect(periods()[0]).toMatchObject({
      mode: 'off',
      startDay: T,
      endDay: T + 6,
      name: 'Beach week',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('presets move the range: "Next week" schedules instead of starting', () => {
    form(start('off'));
    click(screen.getByRole('button', { name: en.hlPreset.nextWeek }));
    expect(primary().textContent).toBe(en.hlSchedule('off'));
    click(primary());
    expect(periods()[0].startDay).toBeGreaterThan(T);
    expect(periods()[0].endDay - periods()[0].startDay).toBe(6);
  });

  it('clicking a day in the calendar moves the start; an end before the start pulls the start back', () => {
    form(start('active'));
    click(row(en.hlStarts));
    click(day(T + 4)); // 30 Sep
    expect(row(en.hlStarts).textContent).toContain(fmt(T + 4));
    click(row(en.hlEnds)); // the end (2 Oct) opens in October
    click(day(T + 5));
    expect(row(en.hlEnds).textContent).toContain(fmt(T + 5));
    click(screen.getByRole('button', { name: en.hlPrevMonth }));
    click(day(T + 1)); // before the start: both move
    expect(row(en.hlEnds).textContent).toContain(fmt(T + 1));
    expect(row(en.hlStarts).textContent).toContain(fmt(T + 1));
  });

  it('"still ongoing" is blocked while the dates are ahead and, once on, ends when the person ends it', () => {
    form(start('off'));
    const sw = () => within(row(en.hlStillOngoing)).getByRole('switch') as HTMLInputElement;
    expect(sw().disabled).toBe(true);
    expect(row(en.hlStillOngoing).textContent).toContain(en.hlOngoingBlocked);
    click(screen.getByRole('button', { name: en.hlPreset.today }));
    expect(sw().disabled).toBe(false);
    click(sw());
    expect(row(en.hlEnds).textContent).toContain(en.hlEndsWhenEnded);
    expect(screen.getByText(en.hlLenOngoing(1))).toBeTruthy();
    click(primary());
    expect(periods()[0]).toMatchObject({ open: true, startDay: T });
    expect(periods()[0].endDay).toBeGreaterThanOrEqual(T);
  });

  it('turning "still ongoing" off again restores a fixed end', () => {
    form(start('off'));
    click(screen.getByRole('button', { name: en.hlPreset.today }));
    const sw = within(row(en.hlStillOngoing)).getByRole('switch');
    click(sw);
    click(sw);
    expect(row(en.hlEnds)?.textContent).toContain(fmt(T));
  });

  it('the type drawer swaps the kind: active recovery relabels, injury becomes the injury form', () => {
    form(start('off'));
    click(row(en.hlType));
    click(screen.getByText(en.restModeActive));
    expect(primary().textContent).toBe(en.hlStartMode('active'));
    expect(screen.getByText(en.hlLighter)).toBeTruthy();
    click(row(en.hlType));
    click(screen.getByText(en.hlFilter.injury, { selector: '.uirow-l' }));
    expect(screen.getByText(en.hlWhere)).toBeTruthy();
    expect(screen.queryByText(en.hlDates)).toBeNull();
  });
});

describe('HealthForm: unwell', () => {
  it('asks how long (today by default), marks today and shows the kind of unwell', () => {
    form(start('illness'));
    expect(screen.getByText(en.illnessDur)).toBeTruthy();
    expect(screen.getByText(en.illKindHeader)).toBeTruthy();
    expect(screen.getByText(en.illHintCold)).toBeTruthy();
    expect(screen.queryByText(en.hlDates)).toBeNull();
    expect(primary().textContent).toBe(en.restStartIllness);
    click(primary());
    expect(periods()[0]).toMatchObject({
      mode: 'illness',
      startDay: T,
      endDay: T,
      illnessKind: 'cold',
    });
  });

  it('each kind has its own note and the placeholder follows the kind', () => {
    form(start('illness'));
    const name = screen.getByLabelText(en.hlName) as HTMLInputElement;
    expect(name.placeholder).toBe(en.illKindCold);
    click(screen.getByText(en.illKindVirus));
    expect(screen.getByText(en.illHintVirus)).toBeTruthy();
    click(screen.getByText(en.illKindStomach));
    expect(screen.getByText(en.illHintStomach)).toBeTruthy();
    click(screen.getByText(en.illKindMental));
    expect(screen.getByText(en.illMentalLead)).toBeTruthy();
    click(screen.getByText(en.illKindOther));
    expect(screen.getByText(en.illKindFoot)).toBeTruthy();
    expect(name.placeholder).toBe(en.hlNamePhIll);
    click(primary());
    expect(periods()[0].illnessKind).toBe('other');
  });

  it('"until better" saves an open period from today', () => {
    form(start('illness'));
    click(screen.getByText(en.illDurOpenShort));
    expect(screen.getByText(en.illnessNoEnd)).toBeTruthy();
    click(primary());
    expect(periods()[0]).toMatchObject({ mode: 'illness', open: true, startDay: T });
  });

  it('"earlier day" reveals the dates, starts yesterday and says when it started', () => {
    form(start('illness'));
    click(screen.getByText(en.illDurEarlier));
    expect(screen.getByText(en.hlDates)).toBeTruthy();
    expect(row(en.hlStarts).textContent).toContain(fmt(T - 1));
    expect(primary().textContent).toBe(
      en.hlStartFrom(row(en.hlStarts).querySelector('.uirow-v')!.textContent!),
    );
    click(screen.getByText(en.illnessDurToday));
    expect(screen.queryByText(en.hlDates)).toBeNull();
  });

  it('is never planned ahead: the future wording is a note, not a choice', () => {
    form(start('illness'));
    click(screen.getByText(en.illDurEarlier));
    expect(screen.getAllByText(en.hlIllNoFuture).length).toBeGreaterThan(0);
  });
});

describe('HealthForm: log the past', () => {
  it('a break that happened yesterday is saved as one', () => {
    const { onDone } = form(past('off'));
    expect(document.querySelector('.uipagehead')?.textContent).toContain(en.hlTookBreak);
    expect(primary().textContent).toBe(en.hlSaveBreak);
    expect(row(en.hlStarted).textContent).toContain(fmt(T - 1));
    click(primary());
    expect(periods()[0]).toMatchObject({ mode: 'off', startDay: T - 1, endDay: T - 1 });
    expect(onDone).toHaveBeenCalled();
  });

  it('a past illness has its own title and button; the calendar cannot go past today', () => {
    form(past('illness'));
    expect(document.querySelector('.uipagehead')?.textContent).toContain(en.hlWasUnwell);
    expect(primary().textContent).toBe(en.hlSaveIllness);
    expect(day(T + 1)?.hasAttribute('disabled') ?? true).toBe(true);
    expect(screen.getByRole('button', { name: en.hlPreset.last3 })).toBeTruthy();
    click(screen.getByRole('button', { name: en.hlPreset.last3 }));
    click(primary());
    expect(periods()[0]).toMatchObject({ mode: 'illness', startDay: T - 2, endDay: T });
  });

  it('workouts inside a full rest are kept by default, can all be removed, and then go with the save', () => {
    seed({ ...emptyState(), workouts: [workoutOn(T - 1, 'w1')] });
    form(past('off'));
    expect(screen.getByText(en.hlOverlapN(1))).toBeTruthy();
    expect(row(en.hlKeepSession(1))?.getAttribute('aria-pressed')).toBe('true');
    click(row(en.hlRemoveSession(1)));
    expect(row(en.hlRemoveSession(1)).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(en.hlRemoveFoot(1))).toBeTruthy();
    click(row(en.hlKeepSession(1)));
    expect(row(en.hlKeepSession(1)).getAttribute('aria-pressed')).toBe('true');
    click(row(en.hlRemoveSession(1)));
    click(primary());
    expect(__getStateForTests().workouts.find((w) => w.id === 'w1')).toBeUndefined();
    expect(periods()).toHaveLength(1);
  });

  it('active recovery does not skip workouts, so nothing overlaps', () => {
    seed({ ...emptyState(), workouts: [workoutOn(T - 1, 'w1')] });
    form(past('active'));
    expect(screen.queryByText(en.hlOverlapN(1))).toBeNull();
  });
});

describe('HealthForm: periods that overlap', () => {
  const other = (mode: 'off' | 'active' | 'illness', over: Record<string, unknown> = {}) =>
    period({ id: 'o1', mode, startDay: T - 3, endDay: T - 1, name: 'Other', ...over });

  it('another full rest on the same days has to be merged or replaced before saving', () => {
    seed({ ...emptyState(), restPeriods: [other('off')] });
    form(past('off'));
    expect(screen.getByText(en.hlConflictFoot)).toBeTruthy();
    expect(primary().disabled).toBe(true);
    expect(row(en.hlMerge)).toBeTruthy();
    click(row(en.hlMerge));
    expect(primary().disabled).toBe(false);
    click(primary());
    expect(periods()).toHaveLength(1);
    expect(periods()[0].startDay).toBe(T - 3);
  });

  it('replace trims the other period around the new days', () => {
    seed({ ...emptyState(), restPeriods: [other('off')] });
    form(past('off'));
    click(row(en.hlReplace));
    click(primary());
    expect(periods().length).toBeGreaterThanOrEqual(1);
    expect(periods().some((p) => p.id === 'o1' && p.endDay < T - 1)).toBe(true);
  });

  it('a period of another kind is not a conflict at all', () => {
    seed({ ...emptyState(), restPeriods: [other('illness')] });
    form(past('off'));
    expect(screen.queryByText(en.hlConflictFoot)).toBeNull();
    expect(row(en.hlMerge)).toBeUndefined();
    expect(row(en.hlReplace)).toBeUndefined();
  });

  it('changing the type drops a merge choice that no longer applies', () => {
    seed({ ...emptyState(), restPeriods: [other('off')] });
    form(past('off'));
    click(row(en.hlMerge));
    expect(row(en.hlMerge).getAttribute('aria-pressed')).toBe('true');
    click(row(en.hlType));
    click(screen.getByText(en.restModeIllness));
    expect(row(en.hlMerge)).toBeUndefined();
    expect(row(en.hlReplace)).toBeUndefined();
    expect(primary().disabled).toBe(false);
  });
});
