import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { pinsPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { emptyState, setDesktop } from './__fixtures__/viewKit';
import {
  MIN,
  NOW,
  acts,
  at,
  click,
  history,
  lifted,
  live,
  put,
  resetSeq,
  tick,
  view,
} from './__fixtures__/logActivityKit';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  vi.setSystemTime(NOW);
  localStorage.clear();
  pinsPref.reset();
  setLocale('en');
  setDesktop(false);
  resetSeq();
  put(history());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Log activity (mobile): the hero', () => {
  it('Start from the hero begins the timer and moves to the activity page', () => {
    const { shell } = view();
    click(screen.getByText(en.actStart));
    expect(acts().find((a) => a.finishedAt === null)?.type).toBe('dance');
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({ screen: 'activity' });
  });

  it('hiding the hero removes it for today and the choice is remembered on the next visit', () => {
    view();
    click(screen.getByLabelText(en.laHide));
    expect(screen.queryByText('Dance?')).toBeNull();
    expect(JSON.parse(localStorage.getItem('spotter.la.hidden') as string).types).toEqual([
      'dance',
    ]);
    cleanup();
    view();
    expect(screen.queryByText('Dance?')).toBeNull();
  });

  it('a hidden choice from another day is forgotten', () => {
    localStorage.setItem('spotter.la.hidden', JSON.stringify({ day: 1, types: ['dance'] }));
    view();
    expect(screen.getByText('Dance?')).toBeTruthy();
  });

  it('the card of an activity already logged today shows "Done" and does nothing when tapped', () => {
    put([...history(), at(2025, 9, 27, 7, 0, 'sauna', 20)]);
    view();
    const done = screen.getByLabelText(en.laDoneAria('Sauna'));
    click(done);
    expect(acts().filter((a) => a.startedAt >= new Date(2025, 8, 27).getTime())).toHaveLength(1);
    expect(within(done).getByText(en.laDone)).toBeTruthy();
    expect(done.textContent).toContain(en.laLoggedAt('07:20'));
  });

  it('a suggestion card logs with one tap and offers Undo; after it the strip shows it as "Just now"', () => {
    view();
    const before = acts().length;
    click(screen.getByLabelText(/^Log Sauna/));
    expect(acts()).toHaveLength(before + 1);
    expect(screen.getByText(en.laJustNow)).toBeTruthy();
    click(screen.getByLabelText(en.laUndoAria('Sauna')));
    expect(acts()).toHaveLength(before);
  });

  it('the snackbar goes away by itself after five seconds', () => {
    view();
    click(screen.getByText('Log 2 h'));
    expect(screen.getByText(/logged$/)).toBeTruthy();
    tick(5100);
    expect(screen.queryByText(/logged$/)).toBeNull();
  });

  it('with a lifting session today the strip adds its minutes', () => {
    put([...history(), at(2025, 9, 27, 9, 0, 'run', 30)], { workouts: [lifted()] });
    view();
    expect(screen.getByText(en.laPlusLifting(60))).toBeTruthy();
    expect(screen.getByText(/· 1 activity$/)).toBeTruthy();
  });

  it('a row in the Today strip opens that activity for editing', () => {
    const run = at(2025, 9, 27, 9, 0, 'run', 30, { calories: 300 });
    put([...history(), run]);
    const { shell } = view();
    const row = screen.getByLabelText(/^Run, 30 min, .*\. Edit$/);
    expect(row.textContent).toContain('≈ 300');
    click(row);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'activity', editId: run.id });
  });

  it('an "other sport" logged under a name appears under that name', () => {
    put([...history(), at(2025, 9, 27, 9, 0, 'sport', 45, { note: 'Underwater hockey' })]);
    view();
    expect(screen.getByText(/^Underwater hockey · 45 min/)).toBeTruthy();
  });
});

describe('Log activity (mobile): pinned cards', () => {
  it('each card says when it was last logged, or "not yet"; a tap opens the quick log', () => {
    pinsPref.set(['run', 'yoga']);
    view();
    expect(screen.getByLabelText(en.laPinnedAria('Run', 'Thu'))).toBeTruthy();
    expect(screen.getByText(en.laNotYet)).toBeTruthy();
    click(screen.getByLabelText(en.laPinnedAria('Run', 'Thu')));
    expect(screen.getByRole('heading', { name: 'Run' })).toBeTruthy();
  });

  it('holding a card pins or unpins it and the tap that ends the hold does not open anything', () => {
    pinsPref.set(['run']);
    view();
    const card = screen.getByLabelText(en.laPinnedAria('Run', 'Thu'));
    fireEvent.pointerDown(card);
    tick(600);
    fireEvent.pointerUp(card);
    click(card);
    expect(pinsPref.get()).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Run' })).toBeNull();
  });

  it('releasing, leaving or cancelling before the hold ends does nothing', () => {
    pinsPref.set(['run']);
    view();
    const card = screen.getByLabelText(en.laPinnedAria('Run', 'Thu'));
    for (const ev of [fireEvent.pointerUp, fireEvent.pointerLeave, fireEvent.pointerCancel]) {
      fireEvent.pointerDown(card);
      tick(200);
      ev(card);
      tick(600);
    }
    expect(pinsPref.get()).toEqual(['run']);
    expect(fireEvent.contextMenu(card)).toBe(false);
  });

  it('the pin hint explains pinning when nothing is pinned', () => {
    view();
    expect(screen.getByRole('note').textContent).toContain(en.laPinHintRest);
  });
});

describe('Log activity (mobile): something is live', () => {
  it('a running activity: banner with the clock, pinned card marked live, lock bar, others dimmed', () => {
    pinsPref.set(['dance', 'run']);
    put([live(), ...history()]);
    view();
    expect(screen.getByText(en.laInProgressSince('18:40').replace('18:40', '17:58'))).toBeTruthy();
    expect(screen.getByLabelText(en.laLiveAria('Dance', '42:00'))).toBeTruthy();
    expect(screen.getByLabelText(en.laLockedAria('Run', 'Dance'))).toBeTruthy();
    expect(document.querySelector('.la-lockbar')?.textContent).toContain(
      en.startFinishFirst('Dance'),
    );
    expect(screen.getByText(en.laTapLogPast)).toBeTruthy();
    expect(screen.queryByText(en.actStart)).toBeNull();
  });

  it('Resume on the banner or the live card opens the activity page', () => {
    pinsPref.set(['dance']);
    put([live(), ...history()]);
    const { shell } = view();
    click(screen.getByText(en.actResume));
    click(screen.getByLabelText(en.laLiveAria('Dance', '42:00')));
    expect(shell.calls.openOverlay).toHaveBeenCalledTimes(2);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'activity' });
  });

  it('the clock moves every second while an activity runs', () => {
    put([live(), ...history()]);
    view();
    expect(screen.getByText(/42:00/)).toBeTruthy();
    tick(3000);
    expect(screen.getByText(/42:03/)).toBeTruthy();
  });

  it('a paused activity says so', () => {
    put([live('dance', { runningSince: null, accumulatedMs: 10 * MIN }), ...history()]);
    view();
    expect(screen.getByText(en.laPausedLower)).toBeTruthy();
  });

  it('Finish saves it with an estimate, announces it, and clears the banner', () => {
    put([live(), ...history()], {
      bodyMetrics: {
        ...emptyState().bodyMetrics,
        weights: [{ id: 'w', at: NOW - 1000, weight: 80 }],
      },
    });
    view();
    click(screen.getByText(en.actFinish));
    const done = acts().find((a) => a.id === 'live');
    expect(done?.finishedAt).not.toBeNull();
    expect(done?.calories).toBeGreaterThan(0);
    expect(screen.getByText(en.laFinishedToast('Dance', '42 min'))).toBeTruthy();
    expect(screen.queryByText(en.actResume)).toBeNull();
  });

  it('what usually follows is offered as a queue; queueing is remembered and un-queueing clears it', () => {
    put([live(), ...history()]);
    view();
    expect(screen.getByText(en.laAfterUsually('Dance'))).toBeTruthy();
    const row = screen.getByText(/^Sauna · 20 min/).closest('button') as HTMLElement;
    expect(row.getAttribute('aria-pressed')).toBe('false');
    click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(en.laQueued)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('spotter.la.queued') as string)).toEqual({
      type: 'sauna',
      liveId: 'live',
    });
    click(row);
    expect(localStorage.getItem('spotter.la.queued')).toBeNull();
  });

  it('finishing with a queued follower opens its quick log on the usual length', () => {
    put([live(), ...history()]);
    view();
    click(screen.getByText(/^Sauna · 20 min/).closest('button'));
    click(screen.getByText(en.actFinish));
    expect(screen.getByRole('heading', { name: 'Sauna' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '15' }).getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('spotter.la.queued')).toBeNull();
  });

  it('a queue left over from another activity is ignored', () => {
    localStorage.setItem(
      'spotter.la.queued',
      JSON.stringify({ type: 'sauna', liveId: 'someone-else' }),
    );
    put([live(), ...history()]);
    view();
    click(screen.getByText(/^Sauna · 20 min/).closest('button'));
    click(screen.getByText(en.actFinish));
    expect(screen.getByRole('heading', { name: 'Sauna' })).toBeTruthy();
  });

  it('a lifting session in progress: banner without Finish, Resume opens the session', () => {
    put(history(), { workouts: [{ ...lifted('open'), finishedAt: null, dayName: 'Push' }] });
    const { shell } = view();
    expect(screen.queryByText(en.actFinish)).toBeNull();
    click(screen.getByText(en.actResume));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: 'open' });
  });

  it('a lifting session with no day name is called by the default label', () => {
    put(history(), { workouts: [{ ...lifted('open'), finishedAt: null, dayName: '' }] });
    view();
    expect(document.querySelector('.la-lockbar')?.textContent).toContain(
      en.startFinishFirst(en.laWorkoutLive),
    );
  });

  it('a sleep in progress: banner named "Sleep", Resume opens the sleep page', () => {
    put(history(), {
      sleeps: [{ id: 's', date: 'd', bedtime: NOW - 3 * 3600_000, wake: null, source: 'live' }],
    });
    const { shell } = view();
    expect(document.querySelector('.la-lockbar')?.textContent).toContain(
      en.startFinishFirst(en.sleepTitle),
    );
    click(screen.getByText(en.actResume));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('starting is refused while something is live, even by a tap on the hero', () => {
    put(history(), { workouts: [{ ...lifted('open'), finishedAt: null }] });
    const { shell } = view();
    const start = screen.getByText(en.actStart).closest('button') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    click(start);
    expect(shell.calls.replaceOverlay).toBeUndefined();
    expect(acts().some((a) => a.finishedAt === null)).toBe(false);
  });
});

describe('Log activity (mobile): search', () => {
  const q = () => screen.getByPlaceholderText(en.laSearch) as HTMLInputElement;

  it('typing replaces the page with results; clearing brings it back', () => {
    view();
    fireEvent.change(q(), { target: { value: 'ten' } });
    expect(screen.getByRole('heading', { name: /2 matches for “ten”/ })).toBeTruthy();
    expect(screen.queryByText(en.laBrowse)).toBeNull();
    fireEvent.click(screen.getByLabelText(en.laClearSearch));
    expect(q().value).toBe('');
    expect(screen.getByText(en.laBrowse)).toBeTruthy();
  });

  it('a result opens the quick log; its pin button pins; a never-logged type says so', () => {
    view();
    fireEvent.change(q(), { target: { value: 'tennis' } });
    click(screen.getByLabelText(en.laPin('Tennis')));
    expect(pinsPref.get()).toEqual(['tennis']);
    click(screen.getByLabelText(/^Tennis, /));
    expect(screen.getByRole('heading', { name: 'Tennis' })).toBeTruthy();
    cleanup();
    view();
    fireEvent.change(q(), { target: { value: 'padel' } });
    expect(screen.getByLabelText(/^Padel, .*not logged yet/)).toBeTruthy();
  });

  it('a word that matches only another name is explained ("also covers")', () => {
    view();
    fireEvent.change(q(), { target: { value: 'jog' } });
    const row = screen.getByLabelText(/^Run, Jog, Conditioning, /);
    expect(row.textContent).toContain('Jog');
    expect(row.getAttribute('aria-label')).toContain(en.laResultLast('').trim());
  });

  it('"Log … as Other sport" opens the quick log under that name', () => {
    view();
    fireEvent.change(q(), { target: { value: 'quidditch' } });
    click(screen.getByLabelText(en.laLogAsOther('quidditch')));
    expect(screen.getByRole('heading', { name: 'quidditch' })).toBeTruthy();
    click(screen.getByRole('button', { name: /^Log it/ }));
    expect(acts().find((a) => a.note === 'quidditch')?.type).toBe('sport');
    expect(screen.getByText(/^quidditch · \d+ min logged/)).toBeTruthy();
  });
});

describe('Log activity (mobile): browsing', () => {
  it('a category row opens its page; the rows say what was last logged', () => {
    const { shell } = view();
    expect(screen.getByLabelText(/^Conditioning, \d+ types, last: Run/)).toBeTruthy();
    click(screen.getByLabelText(/^Recovery, /));
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({
      screen: 'log-activity',
      cat: 'recovery',
    });
  });

  it('while something is live the rows say only past logs are possible', () => {
    put([live(), ...history()]);
    view();
    expect(screen.getAllByText(en.laLogPastOnly).length).toBe(3);
    expect(screen.getByText(en.laStartLockedPast)).toBeTruthy();
  });

  it('first time: starters can be logged or pinned and the category rows show examples instead of history', () => {
    put([]);
    view();
    expect(screen.getByLabelText(/^Conditioning, \d+ types, Run, Walk, /)).toBeTruthy();
    click(screen.getByLabelText(en.laPin('Yoga')));
    expect(pinsPref.get()).toEqual(['yoga']);
    click(screen.getByLabelText(en.laQuickLogAria('Tennis')));
    expect(screen.getByRole('heading', { name: 'Tennis' })).toBeTruthy();
  });

  it('closing the sheet with Escape drops the quick log', () => {
    view();
    click(screen.getByLabelText(/^Recovery, /).closest('nav'));
    fireEvent.change(screen.getByPlaceholderText(en.laSearch), { target: { value: 'tennis' } });
    click(screen.getByLabelText(/^Tennis, /));
    expect(screen.getByRole('heading', { name: 'Tennis' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    tick(600);
    expect(screen.queryByRole('heading', { name: 'Tennis' })).toBeNull();
  });

  it('the back button closes the page', () => {
    const { onClose } = view();
    click(screen.getByLabelText(en.backAction));
    expect(onClose).toHaveBeenCalled();
  });
});
