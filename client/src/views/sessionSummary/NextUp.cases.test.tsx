import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { nextUpOffPref } from '../../activityPrefs';
import { __getStateForTests } from '../../store';
import type { Activity, Exercise, Gym, Workout } from '../../types';
import { emptyState, freezeClock, makeShell, seed } from '../__fixtures__/viewKit';
import {
  NextUpCard,
  NextUpKeepsTiming,
  NextUpLiveBanner,
  NextUpPanel,
  NextUpQuiet,
  __resetNextUpForTests,
  clearSummaryReturn,
  markSummaryReturn,
  summaryReturnFor,
  useNextUp,
} from './NextUp';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const END = new Date(2026, 8, 26, 19, 48).getTime();
const START = END - 72 * MIN;
const NOW = END + 4 * MIN;

const lift = (muscle = 'chest'): Exercise =>
  ({
    id: `e-${muscle}`,
    name: 'Bench Press',
    position: 0,
    primaryMuscle: muscle,
    sets: [0, 1, 2].map((i) => ({
      id: `s${i}`,
      reps: 8,
      weight: 60,
      isWarmup: false,
      position: i,
    })),
  }) as Exercise;
const past = (i: number): Workout =>
  ({
    id: `w${i}`,
    startedAt: START - i * 3 * DAY,
    finishedAt: START - i * 3 * DAY + 60 * MIN,
    autoFinished: false,
    exercises: [lift()],
  }) as Workout;
const current = (over: Partial<Workout> = {}): Workout =>
  ({
    id: 'now',
    startedAt: START,
    finishedAt: END,
    autoFinished: false,
    exercises: [lift()],
    ...over,
  }) as Workout;
const history = Array.from({ length: 8 }, (_, k) => past(k + 1));
let seq = 0;
const after = (
  w: Workout,
  type: string,
  minutes: number,
  over: Partial<Activity> = {},
): Activity => {
  const startedAt = (w.finishedAt as number) + 10 * MIN;
  return {
    id: `a${++seq}`,
    type,
    category: type === 'walk' ? 'conditioning' : 'recovery',
    startedAt,
    finishedAt: startedAt + minutes * MIN,
    durationMin: minutes,
    effort: 'hard',
    ...over,
  } as Activity;
};
const saunaHabit = (): Activity[] =>
  [18, 20, 22, 20, 19, 25].map((m, k) => after(history[k], 'sauna', m));
const habits = (): Activity[] => [
  ...saunaHabit(),
  ...[10, 10, 10].map((m, k) => after(history[k + 2], 'mobility', m)),
  ...[20, 20, 20, 20].map((m, k) => after(history[k + 4], 'walk', m)),
];

function put(
  workouts: Workout[],
  activities: Activity[],
  extra: Record<string, unknown> = {},
  cur = current(),
) {
  seed({
    ...emptyState(),
    workouts: [cur, ...workouts],
    activities: [...activities].sort((a, b) => b.startedAt - a.startedAt),
    ...extra,
  });
}

type Shell = ReturnType<typeof makeShell>;
function Harness({
  w = current(),
  none = false,
  active = true,
  shell,
  web = false,
  panel = false,
}: {
  w?: Workout;
  none?: boolean;
  active?: boolean;
  shell: Shell;
  web?: boolean;
  panel?: boolean;
}) {
  const m = useNextUp(none ? undefined : w, active, shell);
  if (!m) return <p>no model</p>;
  if (panel) return <NextUpPanel m={m} />;
  return (
    <>
      <NextUpLiveBanner m={m} />
      <NextUpCard m={m} web={web} />
      <NextUpQuiet m={m} />
      <NextUpKeepsTiming m={m} />
      <button onClick={m.openNicotineSettings}>nic</button>
      <button onClick={m.openAlcoholSettings}>alc</button>
      <button onClick={m.openSupplementsSettings}>sup</button>
      <button onClick={m.openLogActivity}>log-activity</button>
      <button onClick={m.finish}>finish-fn</button>
      <button onClick={m.pause}>pause-fn</button>
      <button onClick={m.cancelLive}>cancel-fn</button>
      <button onClick={m.undoLogged}>undo-fn</button>
      <button onClick={() => m.top && m.start(m.top)}>start-fn</button>
    </>
  );
}
const go = (props: Partial<Parameters<typeof Harness>[0]> = {}) => {
  const shell = makeShell();
  const r = render(<Harness shell={shell} {...props} />);
  return { shell, ...r };
};
const acts = () => __getStateForTests().activities;
const click = (el: Element | null) => act(() => void fireEvent.click(el as Element));

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  localStorage.clear();
  nextUpOffPref.reset();
  __resetNextUpForTests();
  seq = 0;
});
afterEach(cleanup);

describe('Next up: when there is nothing to show', () => {
  it('no model without a finished workout, while the summary is not active, or without a workout', () => {
    put(history, habits());
    expect(go({ w: current({ finishedAt: null }) }).container.textContent).toBe('no model');
    cleanup();
    expect(go({ active: false }).container.textContent).toBe('no model');
    cleanup();
    expect(go({ none: true }).container.textContent).toBe('no model');
  });

  it('with too little history only the quiet row is shown, and it opens Log activity', () => {
    put(history.slice(0, 2), []);
    const { shell } = go();
    expect(screen.queryByText(en.nuKicker)).toBeNull();
    expect(screen.getByText(en.nuAnything)).toBeTruthy();
    click(screen.getByText(en.nuLogActivity));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
    expect(summaryReturnFor('now')).toBe(true);
  });
});

describe('Next up: the suggestion card', () => {
  it('shows the habit with its reason, the strip and the alternatives; the web variant changes the kicker and footer', () => {
    put(history, habits());
    go({ web: true });
    expect(screen.getByText(en.nuKickerWeb)).toBeTruthy();
    expect(screen.getByText('Sauna · 20 min')).toBeTruthy();
    expect(screen.getByText(en.nuCountsRecovery)).toBeTruthy();
    expect(screen.queryByText(/^usually/)).toBeNull();
    expect(screen.getByLabelText(en.nuChipAria('Mobility', '10 min'))).toBeTruthy();
    cleanup();
    go({ web: false });
    expect(screen.getByText(en.nuKicker)).toBeTruthy();
    expect(screen.getByText(/^usually 18–25 min/)).toBeTruthy();
  });

  it('a habit with one fixed length prints that length alone, and a load activity counts as load', () => {
    put(
      history,
      [4, 5, 6, 7].map((k) => after(history[k], 'walk', 20)),
    );
    go();
    expect(screen.getByText(/^usually 20 min · /)).toBeTruthy();
    expect(screen.getByText(new RegExp(en.nuCountsLoad))).toBeTruthy();
  });

  it('Start begins a live activity and remembers the planned minutes for the banner', () => {
    put(history, habits());
    go();
    click(screen.getByText(en.nuStart('Sauna')));
    const live = acts().find((a) => a.finishedAt === null);
    expect(live?.type).toBe('sauna');
    expect(screen.getByText(en.nuOfApprox('20 min'))).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe(String(20 * 60));
    expect(screen.getByText(en.nuRunningRec('Sauna'))).toBeTruthy();
    expect(screen.getByText(en.nuRunningSub)).toBeTruthy();
    expect(screen.getByText(en.nuKeepsTiming('Sauna'))).toBeTruthy();
  });

  it('starting a second suggestion while one runs does nothing', () => {
    put(history, habits());
    go();
    click(screen.getByText(en.nuStart('Sauna')));
    expect(acts().filter((a) => a.finishedAt === null)).toHaveLength(1);
    expect(screen.queryByText(en.nuStart('Sauna'))).toBeNull();
  });

  it('Start and the alternative chips are off while another workout, a sleep or an unrelated activity is live', () => {
    put(history, habits(), {
      sleeps: [{ id: 's', date: 'd', bedtime: NOW - 3600_000, wake: null, source: 'live' }],
    });
    go();
    expect(
      (screen.getByText(en.nuStart('Sauna')).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText(en.nuChipAria('Mobility', '10 min')) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    put(history, [
      ...habits(),
      {
        ...after(history[0], 'run', 0),
        id: 'before',
        startedAt: START - MIN,
        finishedAt: null,
        category: 'conditioning',
      } as Activity,
    ]);
    go();
    expect(
      (screen.getByText(en.nuStart('Sauna')).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    put(history, habits(), {}, current());
    seed({
      ...__getStateForTests(),
      workouts: [current(), { ...past(20), finishedAt: null, id: 'open' }, ...history],
    });
    go();
    expect(
      (screen.getByText(en.nuStart('Sauna')).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('an alternative chip starts that activity instead', () => {
    put(history, habits());
    go();
    click(screen.getByLabelText(en.nuChipAria('Mobility', '10 min')));
    expect(acts().find((a) => a.finishedAt === null)?.type).toBe('mobility');
  });

  it('Log saves it from the workout finish with the last effort used, estimates calories and offers Undo', () => {
    put(history, habits());
    const { shell } = go();
    click(screen.getByLabelText(en.nuLogAria('Sauna', '20 min')));
    const a = acts().find((x) => x.startedAt === END);
    expect(a).toMatchObject({
      type: 'sauna',
      durationMin: 20,
      finishedAt: END + 20 * MIN,
      effort: 'hard',
    });
    const snack = shell.calls.snack.mock.calls[0][0];
    expect(snack.text).toBe(en.laLoggedToast('Sauna', '20 min'));
    act(() => snack.onUndo());
    expect(acts().find((x) => x.id === a?.id)).toBeUndefined();
  });

  it('with no earlier activity of that type, Log defaults to a moderate effort', () => {
    put(
      history,
      habits().map((a) => ({ ...a, effort: undefined }) as unknown as Activity),
    );
    go();
    click(screen.getByLabelText(en.nuLogAria('Sauna', '20 min')));
    expect(acts().find((x) => x.startedAt === END)?.effort).toBe('moderate');
  });

  it('after Log the card turns into a "logged" row; its Undo removes the entry', () => {
    put(history, habits());
    go();
    click(screen.getByLabelText(en.nuLogAria('Sauna', '20 min')));
    expect(screen.getByText(en.laLoggedToast('Sauna', '20 min'))).toBeTruthy();
    expect(screen.getByText(en.laAddedToRecovery)).toBeTruthy();
    click(screen.getByLabelText(en.laUndoAria('Sauna')));
    expect(acts().some((a) => a.startedAt === END)).toBe(false);
    expect(screen.getByText(en.nuStart('Sauna'))).toBeTruthy();
  });

  it('a logged load activity says it was added to load', () => {
    put(history, [
      ...[4, 5, 6, 7].map((k) => after(history[k], 'walk', 20)),
      after(current(), 'walk', 30),
    ]);
    go();
    expect(screen.getByText(en.laAddedToLoad)).toBeTruthy();
  });
});

describe('Next up: what counts as "just logged" and what may start', () => {
  it('an activity logged long after the workout is not the "logged right after" row', () => {
    put(history, [
      ...habits(),
      after(current(), 'walk', 20, {
        startedAt: END + 5 * 3600_000,
        finishedAt: END + 5 * 3600_000 + 20 * MIN,
      }),
    ]);
    go();
    expect(screen.queryByText(en.laAddedToLoad)).toBeNull();
    expect(screen.getByText(en.nuStart('Sauna'))).toBeTruthy();
  });

  it('starting through the model is refused while another workout is open', () => {
    put(history, habits());
    seed({
      ...__getStateForTests(),
      workouts: [...__getStateForTests().workouts, { ...past(20), id: 'open', finishedAt: null }],
    });
    go();
    click(screen.getByText('start-fn'));
    expect(acts().some((a) => a.finishedAt === null)).toBe(false);
  });
});

describe('Next up: the live banner', () => {
  const running = (over: Partial<Activity> = {}): Activity =>
    ({
      id: 'live',
      type: 'sauna',
      category: 'recovery',
      startedAt: END + MIN,
      finishedAt: null,
      durationMin: 0,
      runningSince: END + MIN,
      effort: 'moderate',
      ...over,
    }) as Activity;

  it('shows the elapsed time without a planned length when it was not started from a suggestion', () => {
    put(history.slice(0, 2), [running()]);
    go();
    expect(screen.getByText(/^Recovery · since/)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/^of ~/)).toBeNull();
  });

  it('Pause stops the clock and Resume starts it again; the banner says it is paused', () => {
    put(history.slice(0, 2), [running()]);
    go();
    click(screen.getByText(en.actPause));
    expect(acts()[0].runningSince).toBeNull();
    expect(screen.getByText(new RegExp(en.laPausedLower))).toBeTruthy();
    click(screen.getByText(en.actResume));
    expect(acts()[0].runningSince).not.toBeNull();
  });

  it('Finish saves the activity with an estimated energy and turns the card into the logged row', () => {
    put(history.slice(0, 2), [running({ type: 'run', category: 'conditioning' })], {
      bodyMetrics: {
        ...emptyState().bodyMetrics,
        weights: [{ id: 'wt', at: NOW - DAY, weight: 80 }],
      },
    });
    go();
    click(screen.getByText(en.actFinish));
    const done = acts()[0];
    expect(done.finishedAt).not.toBeNull();
    expect(done.calories).toBeGreaterThan(0);
  });

  it('the running card names a load activity differently and its X discards the timer', () => {
    put(history.slice(0, 2), [running({ type: 'run', category: 'conditioning' })]);
    go();
    expect(screen.getByText(en.nuRunningLoad('Run'))).toBeTruthy();
    click(screen.getByLabelText(en.nuCancelAria('Run')));
    expect(acts()).toHaveLength(0);
  });

  it('the model functions do nothing when nothing is live or logged', () => {
    put(history.slice(0, 2), []);
    go();
    for (const label of ['finish-fn', 'pause-fn', 'cancel-fn', 'undo-fn'])
      click(screen.getByText(label));
    expect(acts()).toHaveLength(0);
  });

  it('a live activity that started before the workout ended belongs to someone else', () => {
    put(history, habits(), {}, current());
    seed({
      ...__getStateForTests(),
      activities: [
        ...acts(),
        running({ id: 'old', startedAt: START - 10 * MIN, runningSince: START - 10 * MIN }),
      ],
    });
    go();
    expect(screen.queryByText(en.actPause)).toBeNull();
    expect(
      (screen.getByText(en.nuStart('Sauna')).closest('button') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('Next up: the options sheet', () => {
  const open = () => click(screen.getByLabelText(en.nuMoreAria));

  it('"Not today" hides the suggestion for this workout only and closes the sheet', () => {
    put(history, habits());
    go();
    open();
    expect(screen.getByText(en.nuNote(8))).toBeTruthy();
    click(screen.getByText(en.nuNotToday));
    expect(screen.queryByText('Sauna · 20 min')).toBeNull();
    expect(screen.getByText(en.nuAnything)).toBeTruthy();
    expect(screen.queryByText(en.nuNotToday)).toBeNull();
  });

  it('"Change to…" remembers the summary and opens Log activity', () => {
    put(history, habits());
    const { shell } = go();
    open();
    click(screen.getByText(en.nuChangeTo));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
    expect(summaryReturnFor('now')).toBe(true);
  });

  it('"Don\'t suggest" turns the type off once and Undo turns it back on', () => {
    put(history, habits());
    const { shell } = go();
    open();
    click(screen.getByText(en.nuDontSuggest('Sauna')));
    expect(nextUpOffPref.get()).toEqual(['sauna']);
    const snack = shell.calls.snack.mock.calls[0][0];
    expect(snack.text).toBe(en.nuOffToast('Sauna'));
    act(() => snack.onUndo());
    expect(nextUpOffPref.get()).toEqual([]);
  });

  it('asking twice does not list the type twice', () => {
    put(history, habits());
    nextUpOffPref.set(['sauna']);
    put(history, habits());
    const { shell } = go();
    expect(nextUpOffPref.get()).toEqual(['sauna']);
    expect(shell.calls.snack).toBeUndefined();
  });

  it('with no alternatives the sheet says nothing else will be offered', () => {
    put(history, saunaHabit());
    go();
    open();
    expect(screen.getByText(en.nuDontSuggestSubNone)).toBeTruthy();
  });
});

describe('Next up: facility suggestions and drill-ins', () => {
  const gym = {
    id: 'g1',
    name: 'Pool Gym',
    amenities: ['pool'],
    lat: 1,
    lng: 1,
    radiusM: 50,
  } as unknown as Gym;

  it("with no habit, the gym's pool is suggested with its own wording and note", () => {
    put(history.slice(0, 2), [], { gyms: [gym] }, current({ gymId: 'g1' }));
    go({ w: current({ gymId: 'g1' }) });
    expect(screen.getByText('Swim · 20 min')).toBeTruthy();
    const why = document.querySelector('.nu-why')?.textContent;
    expect(['light', 'moderate', 'hard'].map((l) => en.windReason('pool', l))).toContain(why);
    click(screen.getByLabelText(en.nuMoreAria));
    expect(screen.getByText(en.windNote)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a workout without a known gym still works; the settings shortcuts open the right health page', () => {
    put(history, habits());
    const { shell } = go();
    for (const [label, key] of [
      ['nic', 'nic'],
      ['alc', 'alc'],
      ['sup', 'sup'],
    ] as const) {
      click(screen.getByText(label));
      expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', [key]: 'calc' });
    }
    click(screen.getByText('log-activity'));
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'log-activity' });
  });
});

describe('Next up: the web panel', () => {
  it('lists what was done today newest first, with the habit card and a way to log something else', () => {
    put(history, habits(), {}, current({ dayName: 'Push' }));
    seed({
      ...__getStateForTests(),
      workouts: [
        ...__getStateForTests().workouts,
        {
          ...past(30),
          id: 'earlier',
          startedAt: END - 6 * 3600_000,
          finishedAt: END - 5 * 3600_000,
          dayName: '',
        },
      ],
    });
    const { shell } = go({ panel: true });
    expect(screen.getByRole('complementary', { name: en.nuTitle })).toBeTruthy();
    expect(screen.getByText(en.nuFromLast(8))).toBeTruthy();
    expect(screen.getByText('Sauna · 20 min')).toBeTruthy();
    const names = [...document.querySelectorAll('.nu-tl-n')].map((n) => n.textContent);
    expect(names).toEqual(['Push', en.laWorkoutLive]);
    click(screen.getByText(en.nuLogElse));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
  });

  it('an empty day shows no list, no "from last" count and, with nothing to suggest, no extra button', () => {
    put(history.slice(0, 2), [], {}, current());
    seed({ ...__getStateForTests(), workouts: [], activities: [] });
    go({ panel: true, w: current() });
    expect(document.querySelector('.nu-today')).toBeNull();
    expect(screen.queryByText(en.nuFromLast(2))).toBeNull();
    expect(screen.queryByText(en.nuLogElse)).toBeNull();
    expect(screen.getByText(en.nuAnything)).toBeTruthy();
  });

  it('activities of the day appear in the list with their length', () => {
    put(history.slice(0, 2), [after(current(), 'walk', 30)]);
    go({ panel: true });
    expect(document.body.textContent).toContain(en.actType.walk);
    expect(document.body.textContent).toContain('30 min');
  });
});

describe('Next up: returning to the summary', () => {
  it('the marker is per workout, expires after half an hour and can be cleared', () => {
    markSummaryReturn('a');
    expect(summaryReturnFor('a')).toBe(true);
    expect(summaryReturnFor('b')).toBe(false);
    freezeClock(NOW + 31 * MIN);
    expect(summaryReturnFor('a')).toBe(false);
    freezeClock(NOW);
    markSummaryReturn('a');
    clearSummaryReturn();
    expect(summaryReturnFor('a')).toBe(false);
  });
});
