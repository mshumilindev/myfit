import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests, dayKey as bucket } from '../store';
import type { Activity, Injury, RestPeriod, SleepNight, Workout } from '../types';

vi.mock('./PeriodEditSheet', () => ({
  PeriodEditSheet: ({ spec, onClose }: { spec: unknown; onClose: () => void }) => (
    <div data-testid="edit-sheet" data-spec={JSON.stringify(spec)}>
      <button onClick={onClose}>close edit</button>
    </div>
  ),
}));

import {
  ActivityRow,
  HistoryDay,
  HistoryTimeline,
  SleepRow,
  WorkoutRow,
  buildHistoryDays,
  useDayBars,
} from './HistoryTimeline';

const NOW = new Date(2026, 8, 30, 12).getTime(); // Wed 30 Sep 2026
const at = (d: number, h = 10, m = 0) => new Date(2026, 8, d, h, m).getTime();
const wo = (id: string, started: number, over: Partial<Workout> = {}): Workout => ({
  id,
  startedAt: started,
  finishedAt: started + 3600000,
  autoFinished: false,
  exercises: [],
  ...over,
});
const act = (id: string, started: number, over: Partial<Activity> = {}): Activity =>
  ({
    id,
    type: 'run',
    category: 'conditioning',
    startedAt: started,
    finishedAt: started + 1800000,
    durationMin: 30,
    ...over,
  }) as Activity;
const sleep = (id: string, wake: number, over: Partial<SleepNight> = {}): SleepNight =>
  ({ id, date: 'x', bedtime: wake - 8 * 3600000, wake, source: 'backfill', ...over }) as SleepNight;
const restP = (id: string, a: number, b: number, over: Partial<RestPeriod> = {}): RestPeriod =>
  ({
    id,
    startDay: bucket(a),
    endDay: bucket(b),
    mode: 'active',
    createdAt: 1,
    ...over,
  }) as RestPeriod;

function setState(p: Record<string, unknown>) {
  __replaceStateForTests({ ...__getStateForTests(), restPeriods: [], injuries: [], ...p } as never);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  setState({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base = {
  allWorkouts: [] as Workout[],
  bodyKg: 80 as number | null,
  onOpenWorkout: () => undefined,
  prescribedDaysOverride: new Set<number>(),
  lookbackOverride: 0,
};
const tl = (props: Partial<React.ComponentProps<typeof HistoryTimeline>> = {}) =>
  render(<HistoryTimeline workouts={[]} activities={[]} {...base} {...props} />);
const dayStates = () =>
  [...document.querySelectorAll('.hist-tl-day')].map(
    (d) => /(?:^|\s)st-(\w+)/.exec(d.className)![1],
  );

describe('buildHistoryDays', () => {
  it('groups by local day, newest day first and earliest item first, skipping unfinished', () => {
    const days = buildHistoryDays(
      [
        wo('w2', at(28, 18)),
        wo('w1', at(28, 8)),
        wo('open', at(28, 9), { finishedAt: null }),
        wo('w0', at(27, 9)),
      ],
      [act('a1', at(28, 12)), act('a-open', at(28, 13), { finishedAt: null })],
      [sleep('s1', at(28, 7)), sleep('live', 0, { wake: null })],
    );
    expect(days).toHaveLength(2);
    expect(
      days[0].items.map((i) => (i.kind === 'w' ? i.w.id : i.kind === 'a' ? i.a.id : i.n.id)),
    ).toEqual(['s1', 'w1', 'a1', 'w2']);
    expect(days[0].ts).toBe(at(28, 18));
    expect(days[1].items).toHaveLength(1);
  });

  it('is empty without data', () => {
    expect(buildHistoryDays([], [])).toEqual([]);
  });
});

describe('HistoryTimeline', () => {
  it('renders nothing for an empty history', () => {
    const { container } = tl();
    expect(container.firstChild).toBeNull();
  });

  it('shows logged days newest first with a trained node, and "Today" for today', () => {
    tl({
      workouts: [wo('w1', at(30, 9)), wo('w2', at(28, 9))],
      activities: [act('a1', at(29, 9))],
    });
    expect(dayStates()).toEqual(['trained', 'logged', 'trained']);
    const dates = [...document.querySelectorAll('.hist-tl-day')].map((d) => d.textContent);
    expect(dates[0]).toContain('Today');
    expect(dates[1]).toContain('Tue');
    expect(dates[2]).toContain('Mon');
  });

  it('opens workouts, activities and sleeps through their handlers', () => {
    const onW = vi.fn();
    const onA = vi.fn();
    const onS = vi.fn();
    tl({
      workouts: [wo('w1', at(30, 9))],
      activities: [act('a1', at(30, 11))],
      sleeps: [sleep('s1', at(30, 6))],
      onOpenWorkout: onW,
      onOpenActivity: onA,
      onOpenSleep: onS,
    });
    fireEvent.click(screen.getByLabelText('Sleep'));
    fireEvent.click(screen.getByLabelText('Run'));
    fireEvent.click(document.querySelector('.hist-workout')!);
    expect(onS).toHaveBeenCalledWith('s1');
    expect(onA).toHaveBeenCalledWith('a1');
    expect(onW).toHaveBeenCalledWith('w1');
  });

  it('pages with maxDays / dayOffset', () => {
    const ws = [30, 29, 28, 27].map((d) => wo(`w${d}`, at(d, 9)));
    tl({ workouts: ws, maxDays: 2 });
    expect(document.querySelectorAll('.hist-tl-day')).toHaveLength(2);
    cleanup();
    tl({ workouts: ws, maxDays: 2, dayOffset: 2 });
    expect(document.querySelectorAll('.hist-tl-day')).toHaveLength(2);
    expect(document.querySelector('.hist-tl-day')!.textContent).not.toContain('Today');
    cleanup();
    tl({ workouts: ws, dayOffset: 3 });
    expect(document.querySelectorAll('.hist-tl-day')).toHaveLength(1);
  });

  it('limits to a day range (one week per page)', () => {
    const ws = [30, 29, 28, 27, 26].map((d) => wo(`w${d}`, at(d, 9)));
    tl({ workouts: ws, range: { fromDay: bucket(at(27)), toDay: bucket(at(29)) } });
    expect(document.querySelectorAll('.hist-tl-day')).toHaveLength(3);
  });

  it('marks a skipped program day as missed inside the lookback window only', () => {
    tl({
      workouts: [wo('w1', at(25, 9))],
      prescribedDaysOverride: new Set([1, 2, 3, 4, 5, 6, 7]),
      lookbackOverride: 7,
    });
    const states = dayStates();
    expect(states).toContain('missed');
    expect(states.filter((s) => s === 'trained')).toHaveLength(1);
    // today itself can never be "missed": the first (today) row is absent
    expect(document.querySelector('.hist-tl-day')!.textContent).not.toContain('Today');
    expect(document.querySelector('.st-missed')!.textContent).toContain('Missed');
  });

  it('shows planned rest on non-training weekdays within the program window', () => {
    tl({
      workouts: [wo('w1', at(25, 9))],
      prescribedDaysOverride: new Set([3]), // Wednesday only
      lookbackOverride: 7,
    });
    expect(dayStates()).toContain('rest');
    expect(document.querySelector('.st-rest')!.textContent).toContain('Rest day');
  });

  it('illness, time off and rest periods colour their days (client override, not editable)', () => {
    const periods = [
      restP('ill', at(29), at(29), { mode: 'illness' }),
      restP('off', at(28), at(28), { mode: 'off' }),
      restP('rest', at(27), at(27), { mode: 'active' }),
    ];
    tl({
      workouts: [wo('w0', at(25, 9))],
      restPeriodsOverride: periods,
      prescribedDaysOverride: new Set(),
      lookbackOverride: 5,
    });
    const states = dayStates();
    expect(states).toContain('illness');
    expect(states).toContain('vacation');
    expect(states).toContain('rest');
    // overrides disable the period rows: the only card is the logged workout's
    expect(document.querySelectorAll('.hist-day-card')).toHaveLength(1);
  });

  it('a workout wins over a covering rest period', () => {
    tl({
      workouts: [wo('w1', at(29, 9))],
      restPeriodsOverride: [restP('r', at(29), at(29), { mode: 'illness' })],
    });
    expect(dayStates()).toEqual(['trained']);
  });

  it('shows an injury day when nothing is logged and the injury covers it', () => {
    const inj = {
      id: 'i1',
      reason: 'injury',
      bodyPart: 'knee',
      side: 'left',
      muscles: [],
      stage: 'rest',
      startDay: bucket(at(28)),
      createdAt: 1,
    } as unknown as Injury;
    setState({ injuries: [inj] });
    tl({ workouts: [wo('w1', at(26, 9))] });
    expect(dayStates()).toContain('injury');
    expect(document.querySelector('.st-injury')!.textContent).toContain('Injury & rehab');
  });

  it('lists the covering periods and injuries as editable rows that open the edit sheet', () => {
    const inj = {
      id: 'i1',
      reason: 'injury',
      bodyPart: 'knee',
      side: 'left',
      muscles: [],
      stage: 'rest',
      startDay: bucket(at(30)),
      healedDay: null,
      createdAt: 1,
    } as unknown as Injury;
    setState({
      restPeriods: [
        restP('ill', at(29), at(30), { mode: 'illness', illnessKind: 'flu' as never }),
        restP('act', at(30), at(30), { mode: 'active' }),
      ],
      injuries: [inj],
    });
    tl({ workouts: [wo('w1', at(30, 9))] });
    const rows = [...document.querySelectorAll('.hist-tl-day')][0].querySelectorAll(
      '.hist-day-card',
    )[0].children;
    expect(rows.length).toBe(3);
    fireEvent.click(rows[0]);
    expect(JSON.parse(screen.getByTestId('edit-sheet').getAttribute('data-spec')!)).toEqual({
      kind: 'edit',
      periodId: 'ill',
    });
    fireEvent.click(screen.getByText('close edit'));
    expect(screen.queryByTestId('edit-sheet')).toBeNull();
    fireEvent.click(rows[2]);
    expect(JSON.parse(screen.getByTestId('edit-sheet').getAttribute('data-spec')!)).toEqual({
      kind: 'edit-injury',
      injuryId: 'i1',
    });
  });

  it('an open period runs through today', () => {
    setState({ restPeriods: [restP('o', at(26), at(26), { mode: 'illness', open: true })] });
    tl({ workouts: [wo('w1', at(25, 9))] });
    expect(dayStates().slice(0, 1)).toEqual(['illness']);
  });
});

describe('useDayBars', () => {
  it('maps day state to bar tone and level; future days are flat', () => {
    setState({ restPeriods: [restP('r', at(28), at(28), { mode: 'active' })] });
    const { result } = renderHook(() =>
      useDayBars([wo('w1', at(29, 9))], [act('a1', at(27, 9))], [sleep('s', at(26, 7))]),
    );
    const bar = result.current;
    expect(bar(bucket(at(29)))).toEqual({ tone: 'ok', level: 3 });
    expect(bar(bucket(at(27)))).toEqual({ tone: 'neutral', level: 1 });
    expect(bar(bucket(at(28)))).toEqual({ tone: 'active', level: 2 });
    expect(bar(bucket(at(20)))).toEqual({ level: 1 });
    expect(bar(bucket(at(30)) + 3)).toEqual({ level: 1 });
  });
});

describe('HistoryDay', () => {
  const hd = (props: Partial<React.ComponentProps<typeof HistoryDay>> = {}) =>
    render(
      <HistoryDay
        day={at(28, 15)}
        workouts={[]}
        activities={[]}
        allWorkouts={[]}
        bodyKg={null}
        onOpenWorkout={() => undefined}
        {...props}
      />,
    );

  it('renders the same row set as the timeline for that single day only', () => {
    hd({
      workouts: [wo('w1', at(28, 9)), wo('w-other', at(27, 9))],
      activities: [act('a1', at(28, 10))],
      sleeps: [sleep('s1', at(28, 6))],
    });
    expect(document.querySelectorAll('.hist-item')).toHaveLength(3);
    expect(document.querySelector('.hist-tl-day')!.className).toContain('st-trained');
  });

  it('shows the children placeholder only when nothing is logged, plus the aside', () => {
    hd({ children: <p>Nothing here</p>, aside: <span>day 3 of 6</span> });
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('day 3 of 6')).toBeTruthy();
    cleanup();
    hd({ workouts: [wo('w1', at(28, 9))], children: <p>Nothing here</p> });
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('labels today as Today', () => {
    hd({ day: at(30, 8), workouts: [wo('w1', at(30, 9))] });
    expect(document.querySelector('.hist-tl-day')!.textContent).toContain('Today');
  });
});

describe('rows', () => {
  it('WorkoutRow: a gym session shows its weekday title, duration, sets and tonnage', () => {
    const onOpen = vi.fn();
    render(<WorkoutRow w={wo('w1', at(28, 9))} allWorkouts={[]} onOpen={onOpen} />);
    const row = document.querySelector('.hist-workout') as HTMLElement;
    expect(row.textContent).toContain('Mon');
    expect(row.textContent).toContain('0 sets');
    expect(row.textContent).toContain('09:00');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith('w1');
  });

  it('WorkoutRow: a session without finish time omits the duration', () => {
    render(
      <WorkoutRow
        w={wo('w1', at(28, 9), { finishedAt: null })}
        allWorkouts={[]}
        onOpen={() => undefined}
      />,
    );
    expect(document.querySelector('.hist-workout')!.textContent).not.toMatch(/1h/);
  });

  it('WorkoutRow: a home set uses its own name and has no tonnage', () => {
    render(
      <WorkoutRow
        w={wo('h1', at(28, 9), { kind: 'home', dayName: 'Morning flow' })}
        allWorkouts={[]}
        onOpen={() => undefined}
      />,
    );
    const row = document.querySelector('.hist-home') as HTMLElement;
    expect(row.textContent).toContain('Morning flow');
    expect(row.textContent).not.toMatch(/kg/);
    cleanup();
    render(
      <WorkoutRow
        w={wo('h2', at(28, 9), { kind: 'home' })}
        allWorkouts={[]}
        onOpen={() => undefined}
      />,
    );
    expect(document.querySelector('.hist-home')!.textContent).toContain('Home set');
  });

  it('ActivityRow: names the type with minutes and is clickable only with a handler', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<ActivityRow a={act('a1', at(28, 9))} onOpen={onOpen} />);
    expect(screen.getByLabelText('Run').textContent).toContain('30 min');
    fireEvent.click(screen.getByLabelText('Run'));
    expect(onOpen).toHaveBeenCalledWith('a1');
    rerender(<ActivityRow a={act('a1', at(28, 9))} />);
    expect(
      document.querySelector('.hist-activity')!.querySelector('.uirow-chevron, [class*=chevron]'),
    ).toBeNull();
  });

  it('ActivityRow: an unknown type falls back to its key', () => {
    render(<ActivityRow a={act('a1', at(28, 9), { type: 'zorbing' })} />);
    expect(screen.getByLabelText('zorbing')).toBeTruthy();
  });

  it('SleepRow: night vs nap, the auto badge and the bedtime clock', () => {
    const { rerender } = render(<SleepRow n={sleep('s1', at(28, 7))} />);
    const row = () => document.querySelector('.cat-sleep') as HTMLElement;
    expect(row().textContent).toContain('Sleep');
    expect(row().textContent).toContain('23:00');
    expect(row().textContent).toContain('8:00');
    expect(row().textContent).not.toContain('auto');
    rerender(<SleepRow n={sleep('s1', at(28, 7), { source: 'auto' })} />);
    expect(row().textContent).toContain('auto');
    const napWake = at(28, 15);
    rerender(<SleepRow n={{ ...sleep('n1', napWake), bedtime: napWake - 3600000 }} />);
    expect(row().textContent).toContain('Nap');
    expect(row().textContent).toContain('1:00');
  });

  it('SleepRow: opens when a handler is given', () => {
    const onOpen = vi.fn();
    render(<SleepRow n={sleep('s1', at(28, 7))} onOpen={onOpen} />);
    fireEvent.click(screen.getByLabelText('Sleep'));
    expect(onOpen).toHaveBeenCalledWith('s1');
  });
});
