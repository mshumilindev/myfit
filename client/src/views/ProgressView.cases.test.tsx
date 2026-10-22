import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import type { StoreState } from '../store';
import {
  coachOn,
  DAY,
  emptyState,
  freezeClock,
  history,
  makeShell,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ mine: { assignment: null as unknown, active: true } }));
vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => m.mine,
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));

import { ProgressView } from './ProgressView';

type Sub = 'progress' | 'trends' | 'activity';
type Seg = 'total' | 'muscle' | 'volume' | 'records';
type Lens = 'volume' | 'fatigue' | 'readiness';

const ownProgram = {
  program: {
    id: 'p1',
    name: 'Mine',
    weeks: 8,
    daysPerWeek: 3,
    status: 'active',
    authorId: 'u1',
    dayNames: {},
    targetMuscles: {},
    items: [],
    activities: [],
  },
  assignedBy: null,
  startedAt: NOW - 14 * DAY,
  week: 2,
  done: 0,
  total: 24,
};

const open = (
  o: {
    sub?: Sub;
    seg?: Seg;
    lens?: Lens;
    state?: StoreState;
    shell?: ReturnType<typeof makeShell>;
  } = {},
) => {
  if (o.state) seed(o.state);
  const shell = o.shell ?? makeShell();
  const onSeg = vi.fn();
  const onLens = vi.fn();
  const out = render(
    <ProgressView
      store={__getStateForTests() as never}
      shell={shell}
      sub={o.sub ?? 'progress'}
      seg={o.seg ?? 'total'}
      onSeg={onSeg}
      lens={o.lens ?? 'volume'}
      onLens={onLens}
    />,
  );
  return { ...out, shell, onSeg, onLens };
};
beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  m.mine = { assignment: null, active: true };
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgressView: sub tabs', () => {
  it('titles the screen per tab', () => {
    open();
    expect(document.querySelector('.pv-title')?.textContent).toBe(en.progress);
    cleanup();
    open({ sub: 'activity' });
    expect(document.querySelector('.pv-title')?.textContent).toBe(en.atrTitle);
    cleanup();
    open({ sub: 'trends' });
    expect(document.querySelector('.pv-title')?.textContent).toBe(en.trendsTab);
  });

  it('activity tab: no add-to-program button without an own program', () => {
    open({ sub: 'activity' });
    expect(document.querySelector('.atr')).not.toBeNull();
    expect(screen.queryByText(en.atrAddToProgram)).toBeNull();
    expect(screen.queryByRole('button', { name: /Show period|This week/ })).toBeNull();
  });

  it('activity tab: with an own program a frequent type opens the add sheet, which closes again', async () => {
    m.mine = { assignment: ownProgram, active: true };
    open({ sub: 'activity' });
    fireEvent.click(document.querySelectorAll('.atr .uirow')[0] as HTMLElement);
    fireEvent.click(screen.getByText(en.atrAddToProgram));
    const dialogs = () => document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    const before = dialogs().length;
    expect(before).toBe(2);
    const add = dialogs()[before - 1] as HTMLElement;
    expect(add.textContent).toContain(en.actType.run);
    fireEvent.click(within(add).getByRole('button', { name: en.cancel }));
    await waitFor(() => expect(dialogs().length).toBe(before - 1));
  });

  it('trends tab with the coach off shows no Atlas chat entry points', () => {
    open({ sub: 'trends' });
    expect(screen.queryByRole('button', { name: en.atlChatOpen })).toBeNull();
    expect(screen.queryByText(en.atlChatAsk)).toBeNull();
    expect(document.querySelector('.progress-alt-body.is-trends')).not.toBeNull();
  });

  it('trends tab with the coach on is titled Atlas and opens the coach from both entry points', () => {
    const { shell } = open({ sub: 'trends', state: coachOn(richState()) });
    expect(document.querySelector('.pv-title')?.textContent).toBe(en.atlasName);
    expect(document.querySelector('.atl-panel')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.atlChatOpen }));
    fireEvent.click(screen.getByText(en.atlChatAsk));
    expect(shell.calls.openOverlay).toHaveBeenCalledTimes(2);
    expect(shell.calls.openOverlay).toHaveBeenNthCalledWith(1, { screen: 'coach' });
    expect(shell.calls.openOverlay).toHaveBeenNthCalledWith(2, { screen: 'coach' });
  });
});

describe('ProgressView: locked (fewer than 3 finished workouts)', () => {
  it('empty account: a standalone empty state asking for 3 sessions, no range button, no chart', () => {
    open({ state: emptyState() });
    expect(screen.getByText(en.moreSessionsTitle(3))).toBeTruthy();
    expect(screen.getByText(en.progressLocked(0))).toBeTruthy();
    expect(document.querySelector('.progress-locked-empty.solo')).not.toBeNull();
    expect(document.querySelector('.bars')).toBeNull();
    expect(document.querySelectorAll('.unlock .dots .on').length).toBe(0);
    expect(document.querySelector('.pv-top .uibtn, .pv-top button.uibtn-secondary')).toBeNull();
  });

  it('two sessions this week: shows the weekly KPI, bars and 2 of 3 unlock dots', () => {
    const w = history(1).slice(-2);
    open({ state: { ...emptyState(), workouts: w } });
    expect(screen.getByText(en.moreSessionsTitle(1))).toBeTruthy();
    expect(screen.getByText(en.progressLocked(2))).toBeTruthy();
    expect(document.querySelector('.progress-weekly-panel .kpi .lab')?.textContent).toBe(
      en.volumeThisWeek,
    );
    expect(document.querySelectorAll('.bars .bar').length).toBe(10);
    expect(document.querySelectorAll('.unlock .dots .on').length).toBe(2);
    expect(document.querySelector('.progress-locked-empty.solo')).toBeNull();
  });

  it('one session that is not in the last 10 weeks: no chart, one dot', () => {
    const old = history(1)
      .slice(-1)
      .map((x) => ({ ...x, startedAt: NOW - 200 * DAY, finishedAt: NOW - 200 * DAY + 3600_000 }));
    open({ state: { ...emptyState(), workouts: old } });
    expect(document.querySelector('.progress-locked-empty.solo')).not.toBeNull();
    expect(document.querySelectorAll('.unlock .dots .on').length).toBe(1);
  });

  it('an unfinished session does not count toward the unlock', () => {
    const live = history(1)
      .slice(-1)
      .map((x) => ({ ...x, finishedAt: null }));
    open({ state: { ...emptyState(), workouts: live as never } });
    expect(screen.getByText(en.progressLocked(0))).toBeTruthy();
  });
});
